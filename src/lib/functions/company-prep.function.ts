import { STORAGE_KEYS } from "@/config";
import { safeLocalStorage } from "@/lib";
import { fetchCompanyContext } from "./company-context.function";

const PREP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface CompanyPrepData {
  sourceUrl: string;
  companyName: string;
  roleTitle: string;
  jobDescription: string;
  context: string;
  summary: string;
  shortQuestions: string[];
  fetchedAt: number;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function tryParseUrl(url: string): URL | null {
  try {
    return new URL(normalizeUrl(url));
  } catch {
    return null;
  }
}

function inferCompanyName(url: string): string {
  const parsed = tryParseUrl(url);
  if (!parsed) return "the company";

  const host = parsed.hostname
    .replace(/^www\./i, "")
    .split(".")[0]
    ?.trim();

  if (!host) return "the company";

  return host
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildSummary(context: string): string {
  const text = context.replace(/\s+/g, " ").trim();
  if (!text) return "";

  const sentenceCandidates = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  if (sentenceCandidates.length === 0) {
    return text.substring(0, 400);
  }

  const summary = sentenceCandidates.slice(0, 4).join(" ");
  return summary.substring(0, 700);
}

function compactText(text: string, maxLength: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.substring(0, maxLength)}...`;
}

function extractRoleKeywords(jobDescription: string): string[] {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "will", "you", "your",
    "our", "are", "have", "has", "their", "about", "into", "across", "team", "role",
    "years", "experience", "work", "using", "skills", "ability", "including", "strong",
  ]);

  const words = jobDescription
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));

  const frequency = new Map<string, number>();
  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);
}

function buildShortQuestions(
  companyName: string,
  roleTitle: string,
  jobDescription: string
): string[] {
  const effectiveRole = roleTitle.trim() || "this role";
  const jdKeywords = extractRoleKeywords(jobDescription);
  const keywordPrompt = jdKeywords.length > 0 ? jdKeywords.join(", ") : "the key responsibilities";

  return [
    `For the ${effectiveRole} role, how do you define success in the first 90 days at ${companyName}?`,
    `Which immediate projects would I own first in the ${effectiveRole} position?`,
    `From the JD emphasis on ${keywordPrompt}, what does strong execution look like on your team?`,
    "How are architecture and technical trade-off decisions typically made here?",
    "What differentiates top performers in this role by month six?",
  ];
}

function normalizeCacheText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function getStoredCompanyPrep(): CompanyPrepData | null {
  const raw = safeLocalStorage.getItem(STORAGE_KEYS.COMPANY_PREP_DATA);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CompanyPrepData;
    if (!parsed?.sourceUrl || !parsed?.fetchedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearStoredCompanyPrep(): void {
  safeLocalStorage.removeItem(STORAGE_KEYS.COMPANY_PREP_DATA);
}

export async function prepareCompanyPrep(
  companyUrl: string,
  options?: { forceRefresh?: boolean }
): Promise<CompanyPrepData | null> {
  const normalizedUrl = normalizeUrl(companyUrl);
  if (!normalizedUrl) return null;

  const cached = getStoredCompanyPrep();
  const now = Date.now();
  const roleTitle = safeLocalStorage.getItem(STORAGE_KEYS.TARGET_ROLE) || "";
  const jobDescription = safeLocalStorage.getItem(STORAGE_KEYS.JOB_DESCRIPTION) || "";
  const normalizedRole = normalizeCacheText(roleTitle);
  const normalizedJd = normalizeCacheText(jobDescription);

  if (
    !options?.forceRefresh &&
    cached &&
    cached.sourceUrl === normalizedUrl &&
    normalizeCacheText(cached.roleTitle || "") === normalizedRole &&
    normalizeCacheText(cached.jobDescription || "") === normalizedJd &&
    now - cached.fetchedAt < PREP_CACHE_TTL_MS
  ) {
    return cached;
  }

  const context = await fetchCompanyContext(normalizedUrl);
  if (!context.trim()) {
    return cached && cached.sourceUrl === normalizedUrl ? cached : null;
  }

  const companyName = inferCompanyName(normalizedUrl);
  const summary = buildSummary(context);
  const shortQuestions = buildShortQuestions(companyName, roleTitle, compactText(jobDescription, 700));

  const snapshot: CompanyPrepData = {
    sourceUrl: normalizedUrl,
    companyName,
    roleTitle: compactText(roleTitle, 120),
    jobDescription: compactText(jobDescription, 1200),
    context,
    summary,
    shortQuestions,
    fetchedAt: now,
  };

  safeLocalStorage.setItem(
    STORAGE_KEYS.COMPANY_PREP_DATA,
    JSON.stringify(snapshot)
  );

  return snapshot;
}
