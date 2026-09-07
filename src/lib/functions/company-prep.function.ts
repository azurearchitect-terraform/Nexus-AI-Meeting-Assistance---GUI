import { invoke } from "@tauri-apps/api/core";
import {
  CompanyIntel,
  ScrapeResult,
  normalizeCandidateQuestions,
  companyIntelPrompt,
  CandidateProfile,
} from "../company-intel";
import { fetchAIResponse } from "./ai-response.function";
import { TYPE_PROVIDER } from "@/types";
import { AI_PROVIDERS } from "@/config";

export const STORAGE_KEY_COMPANY_INTEL = "company_prep_data";
export const EVENT_COMPANY_INTEL_UPDATED = "nexus_company_intel_updated";

/**
 * Extracts and parses JSON from raw LLM text that may contain markdown fences or leading/trailing commentary.
 */
export function parseCompanyIntelJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Direct JSON parse
  try {
    return JSON.parse(trimmed);
  } catch {}

  // 2. Fenced code block ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {}
  }

  // 3. Balanced brace extraction
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {}
  }

  return null;
}

export function getLatestCompanyIntel(): CompanyIntel | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPANY_INTEL);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = CompanyIntel.safeParse(parsed);
    return result.success ? result.data : null;
  } catch (e) {
    console.error("Failed to load stored company intel:", e);
    return null;
  }
}

export function saveLatestCompanyIntel(intel: CompanyIntel | null): void {
  if (intel) {
    localStorage.setItem(STORAGE_KEY_COMPANY_INTEL, JSON.stringify(intel));
  } else {
    localStorage.removeItem(STORAGE_KEY_COMPANY_INTEL);
  }
  window.dispatchEvent(new CustomEvent(EVENT_COMPANY_INTEL_UPDATED, { detail: intel }));
}

export interface CompanyPrepData {
  companyName: string;
  roleTitle?: string;
  summary?: string;
  shortQuestions: string[];
  intel?: CompanyIntel | null;
}

export function getStoredCompanyPrep(): CompanyPrepData | null {
  const intel = getLatestCompanyIntel();
  if (!intel) return null;
  const questions = [...intel.questions, ...intel.hrQuestions].map((q) => q.question);
  return {
    companyName: intel.name ?? "",
    roleTitle: localStorage.getItem("company_prep_target_role") || "",
    summary: intel.coreBusiness ?? intel.goldenFormula ?? "",
    shortQuestions: questions,
    intel,
  };
}

export async function prepareCompanyPrep(
  companyUrl: string,
  _options?: { forceRefresh?: boolean }
): Promise<CompanyPrepData | null> {
  const targetRole = localStorage.getItem("company_prep_target_role") || "Senior Software Engineer";
  const experienceYears = Number(localStorage.getItem("company_prep_experience_years")) || 8;
  const jdText = localStorage.getItem("company_prep_jd") || null;

  const intel = await analyzeCompanySite({
    url: companyUrl,
    jdText,
    profile: {
      targetRole,
      experienceYears,
    },
  });

  const questions = [...intel.questions, ...intel.hrQuestions].map((q) => q.question);
  return {
    companyName: intel.name ?? "",
    roleTitle: targetRole,
    summary: intel.coreBusiness ?? intel.goldenFormula ?? "",
    shortQuestions: questions,
    intel,
  };
}

export interface AnalyzeCompanyParams {
  url: string;
  jdText?: string | null;
  profile?: CandidateProfile;
  provider?: TYPE_PROVIDER;
  selectedProvider?: {
    provider: string;
    variables: Record<string, string>;
  };
  onProgress?: (status: string) => void;
  signal?: AbortSignal;
}

export async function analyzeCompanySite(params: AnalyzeCompanyParams): Promise<CompanyIntel> {
  const { url, jdText = null, profile, provider, selectedProvider, onProgress, signal } = params;

  onProgress?.("Connecting to website and crawling pages safely...");
  let scrape: ScrapeResult;
  try {
    scrape = await invoke<ScrapeResult>("scrape_company", { payload: url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to crawl company website: ${message}`);
  }

  if (signal?.aborted) {
    throw new Error("Analysis aborted by user");
  }

  onProgress?.(
    `Crawl completed (${scrape.quality.toUpperCase()}, ${scrape.pages_crawled} page(s)). Synthesizing grounded company intel...`
  );

  let resolvedSelectedProvider = selectedProvider;
  if (!resolvedSelectedProvider || !resolvedSelectedProvider.provider) {
    try {
      const saved = localStorage.getItem("selected_ai_provider");
      if (saved) {
        resolvedSelectedProvider = JSON.parse(saved);
      }
    } catch {}
    if (!resolvedSelectedProvider || !resolvedSelectedProvider.provider) {
      resolvedSelectedProvider = { provider: "auto", variables: {} };
    }
  }

  let resolvedProvider: TYPE_PROVIDER | undefined = provider;
  if (!resolvedProvider || typeof resolvedProvider !== "object" || !("curl" in resolvedProvider)) {
    const providerId =
      (typeof resolvedProvider === "string" ? resolvedProvider : (resolvedProvider as any)?.id) ||
      resolvedSelectedProvider.provider;
    resolvedProvider = AI_PROVIDERS.find((p) => p.id === providerId) || AI_PROVIDERS[0];
  }

  const { system, user } = companyIntelPrompt(scrape.text, jdText ?? null, profile, scrape.quality);

  const stream = fetchAIResponse({
    provider: resolvedProvider,
    selectedProvider: resolvedSelectedProvider,
    systemPrompt: system,
    userMessage: user,
    signal,
  });

  let raw = "";
  for await (const chunk of stream) {
    if (signal?.aborted) throw new Error("Analysis aborted by user");
    raw += chunk;
  }

  if (!raw.trim()) {
    throw new Error("No response received from AI model. Please verify your AI provider and API key in Settings.");
  }

  if (raw.includes("API Key Missing") || raw.includes("No API keys found") || raw.startsWith("⚠️")) {
    throw new Error(raw.replace(/^⚠️\s*/, "").trim());
  }

  onProgress?.("Validating grounded intelligence schema...");
  const parsed = parseCompanyIntelJson(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI returned invalid JSON for company intelligence profile");
  }

  let intel: CompanyIntel;
  try {
    intel = CompanyIntel.parse({
      ...(parsed as object),
      sourceQuality: scrape.quality,
    });
  } catch (validationErr) {
    console.warn("Zod schema validation error, falling back to safe parsing:", validationErr);
    // If strict parse failed, construct safe defaults with available fields
    const p = parsed as any;
    intel = CompanyIntel.parse({
      name: typeof p.name === "string" ? p.name : null,
      coreBusiness: typeof p.coreBusiness === "string" ? p.coreBusiness : null,
      technicalLandscape: typeof p.technicalLandscape === "string" ? p.technicalLandscape : null,
      recentNews: typeof p.recentNews === "string" ? p.recentNews : null,
      whyItMatters: typeof p.whyItMatters === "string" ? p.whyItMatters : null,
      goldenFormula: typeof p.goldenFormula === "string" ? p.goldenFormula : null,
      techStack: Array.isArray(p.techStack) ? p.techStack.filter((x: any) => typeof x === "string") : [],
      questions: Array.isArray(p.questions) ? p.questions : [],
      jdInterviewQuestions: Array.isArray(p.jdInterviewQuestions) ? p.jdInterviewQuestions : [],
      hrQuestions: Array.isArray(p.hrQuestions) ? p.hrQuestions : [],
      salaryNegotiationStrategy: typeof p.salaryNegotiationStrategy === "string" ? p.salaryNegotiationStrategy : null,
      sourceQuality: scrape.quality,
    });
  }

  // De-duplicate and ensure strictly one priority 1 per round
  intel.questions = normalizeCandidateQuestions(intel.questions);
  intel.hrQuestions = normalizeCandidateQuestions(intel.hrQuestions);

  saveLatestCompanyIntel(intel);
  return intel;
}
