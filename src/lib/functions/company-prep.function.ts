import { invoke } from "@tauri-apps/api/core";
import {
  CompanyIntel,
  IntelQuestion,
  JdInterviewQuestion,
  ScrapeResult,
  normalizeCandidateQuestions,
  companyIntelPrompt,
  aiCompanyIntelPrompt,
  CandidateProfile,
} from "../company-intel";
import { fetchAIResponse } from "./ai-response.function";
import { TYPE_PROVIDER } from "@/types";
import { AI_PROVIDERS } from "@/config";

export const STORAGE_KEY_COMPANY_INTEL = "company_prep_data";
export const EVENT_COMPANY_INTEL_UPDATED = "nexus_company_intel_updated";

function tryParseJson(str: string): unknown | null {
  try {
    return JSON.parse(str);
  } catch {
    try {
      // Remove trailing commas before } or ]
      const cleaned = str.replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

/**
 * Extracts and parses JSON from raw LLM text that may contain markdown fences or leading/trailing commentary.
 */
export function parseCompanyIntelJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Direct JSON parse
  const direct = tryParseJson(trimmed);
  if (direct) return direct;

  // 2. Fenced code block ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    const fenced = tryParseJson(fenceMatch[1].trim());
    if (fenced) return fenced;
  }

  // 3. Balanced brace extraction
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const braced = tryParseJson(trimmed.slice(start, end + 1));
    if (braced) return braced;
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

  // Resolve provider and selectedProvider before any AI call
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

  // Determine whether we have usable website content or need AI general-knowledge fallback
  const hasUsableContent = scrape.quality !== "failed" && scrape.text.trim().length > 200;

  let raw: string;
  let sourceQuality: "rich" | "thin" | "failed" | "ai_generated";

  if (hasUsableContent) {
    onProgress?.(
      `Crawl completed (${scrape.quality.toUpperCase()}, ${scrape.pages_crawled} page(s)). Synthesizing grounded company intel...`
    );
    sourceQuality = scrape.quality;

    const { system, user } = companyIntelPrompt(scrape.text, jdText ?? null, profile, scrape.quality);

    const stream = fetchAIResponse({
      provider: resolvedProvider,
      selectedProvider: resolvedSelectedProvider,
      systemPrompt: system,
      userMessage: user,
      signal,
    });

    raw = "";
    for await (const chunk of stream) {
      if (signal?.aborted) throw new Error("Analysis aborted by user");
      raw += chunk;
    }
  } else {
    // Scrape failed or returned no usable content — use AI general knowledge fallback
    onProgress?.(
      "Website could not be crawled. Generating company intelligence from general knowledge..."
    );

    // Extract domain and company name from URL
    let domain = "";
    let companyName = "";
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname.replace(/^www\./, "");
      // Derive company name from domain: e.g. "stripe.com" -> "Stripe"
      companyName = domain
        .split(".")
        .slice(0, -1)
        .join(".")
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    } catch {
      domain = url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      companyName = domain;
    }

    sourceQuality = "ai_generated";

    const { system, user } = aiCompanyIntelPrompt(companyName, domain, jdText ?? null, profile);

    const stream = fetchAIResponse({
      provider: resolvedProvider,
      selectedProvider: resolvedSelectedProvider,
      systemPrompt: system,
      userMessage: user,
      signal,
    });

    raw = "";
    for await (const chunk of stream) {
      if (signal?.aborted) throw new Error("Analysis aborted by user");
      raw += chunk;
    }
  }

  if (!raw.trim()) {
    throw new Error("No response received from AI model. Please verify your AI provider and API key in Settings.");
  }

  if (raw.includes("API Key Missing") || raw.includes("No API keys found") || raw.startsWith("⚠️")) {
    throw new Error(raw.replace(/^⚠️\s*/, "").trim());
  }

  onProgress?.("Validating intelligence schema...");
  const parsed = parseCompanyIntelJson(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI returned invalid JSON for company intelligence profile");
  }

  const parsedObj = (parsed && typeof parsed === "object") ? (parsed as Record<string, any>) : {};
  const validation = CompanyIntel.safeParse({
    ...parsedObj,
    sourceQuality,
  });

  let intel: CompanyIntel;
  if (validation.success) {
    intel = validation.data;
  } else {
    console.warn("Zod schema validation issues, applying safe fallback defaults:", validation.error.issues);
    const p = parsedObj;
    intel = {
      name: typeof p.name === "string" && p.name.trim() ? p.name.trim() : null,
      coreBusiness: typeof p.coreBusiness === "string" && p.coreBusiness.trim() ? p.coreBusiness.trim() : null,
      technicalLandscape: typeof p.technicalLandscape === "string" && p.technicalLandscape.trim() ? p.technicalLandscape.trim() : null,
      recentNews: typeof p.recentNews === "string" && p.recentNews.trim() ? p.recentNews.trim() : null,
      whyItMatters: typeof p.whyItMatters === "string" && p.whyItMatters.trim() ? p.whyItMatters.trim() : null,
      goldenFormula: typeof p.goldenFormula === "string" && p.goldenFormula.trim() ? p.goldenFormula.trim() : null,
      techStack: Array.isArray(p.techStack) ? p.techStack.filter((x: any) => typeof x === "string" && x.trim()).map((x: string) => x.trim()) : [],
      questions: [],
      jdInterviewQuestions: [],
      hrQuestions: [],
      salaryNegotiationStrategy: typeof p.salaryNegotiationStrategy === "string" && p.salaryNegotiationStrategy.trim() ? p.salaryNegotiationStrategy.trim() : null,
      sourceQuality,
    };

    if (Array.isArray(p.questions)) {
      for (const q of p.questions) {
        if (!q || typeof q !== "object") continue;
        const itemResult = IntelQuestion.safeParse(q);
        if (itemResult.success && itemResult.data.question.trim()) {
          intel.questions.push(itemResult.data);
        }
      }
    }
    if (Array.isArray(p.hrQuestions)) {
      for (const q of p.hrQuestions) {
        if (!q || typeof q !== "object") continue;
        const itemResult = IntelQuestion.safeParse(q);
        if (itemResult.success && itemResult.data.question.trim()) {
          intel.hrQuestions.push(itemResult.data);
        }
      }
    }
    if (Array.isArray(p.jdInterviewQuestions)) {
      for (const q of p.jdInterviewQuestions) {
        if (!q || typeof q !== "object") continue;
        const itemResult = JdInterviewQuestion.safeParse(q);
        if (itemResult.success && itemResult.data.question.trim()) {
          intel.jdInterviewQuestions.push(itemResult.data);
        }
      }
    }
  }

  // De-duplicate and ensure strictly one priority 1 per round
  intel.questions = normalizeCandidateQuestions(intel.questions);
  intel.hrQuestions = normalizeCandidateQuestions(intel.hrQuestions);

  saveLatestCompanyIntel(intel);
  return intel;
}
