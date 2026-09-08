import { z } from "zod";

export const RawInterviewRound = z.enum(["recruiter", "hiring-manager", "technical", "executive"]);
export type InterviewRound = z.infer<typeof RawInterviewRound>;

export function coerceInterviewRound(val: unknown): InterviewRound {
  if (typeof val !== "string") return "hiring-manager";
  const s = val.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (s === "recruiter" || s.includes("recruit") || s.includes("talent") || s === "hr") return "recruiter";
  if (s === "technical" || s.includes("tech") || s.includes("engineer") || s.includes("arch") || s.includes("code")) return "technical";
  if (s === "executive" || s.includes("exec") || s.includes("lead") || s.includes("vp") || s.includes("director") || s.includes("founder") || s.includes("ceo") || s.includes("cto")) return "executive";
  if (s === "hiring-manager" || s.includes("hiring") || s.includes("manager") || s.includes("hm")) return "hiring-manager";
  return "hiring-manager";
}

export const InterviewRound = z.preprocess(coerceInterviewRound, RawInterviewRound);

export const RawIntelQuestionCategory = z.enum([
  "Architecture",
  "Infrastructure",
  "Security",
  "Operations",
  "Delivery",
  "Team",
  "Culture",
  "Growth",
  "Strategy",
  "Compensation",
]);
export type IntelQuestionCategory = z.infer<typeof RawIntelQuestionCategory>;

export function coerceIntelCategory(val: unknown): IntelQuestionCategory {
  if (typeof val !== "string") return "Team";
  const s = val.trim().toLowerCase();
  if (s.includes("arch") || s.includes("design") || s.includes("system") || s.includes("tech stack")) return "Architecture";
  if (s.includes("infra") || s.includes("cloud") || s.includes("devops") || s.includes("platform") || s.includes("k8s") || s.includes("kubernetes") || s.includes("sre") || s.includes("data") || s.includes("database") || s.includes("oracle")) return "Infrastructure";
  if (s.includes("sec") || s.includes("auth") || s.includes("priv") || s.includes("compli")) return "Security";
  if (s.includes("oper") || s.includes("relia") || s.includes("incid") || s.includes("oncall") || s.includes("monit")) return "Operations";
  if (s.includes("deliv") || s.includes("agile") || s.includes("ci") || s.includes("cd") || s.includes("releas") || s.includes("ship")) return "Delivery";
  if (s.includes("cult") || s.includes("value") || s.includes("workplace") || s.includes("remote") || s.includes("balanc")) return "Culture";
  if (s.includes("grow") || s.includes("career") || s.includes("learn") || s.includes("mentor") || s.includes("promo")) return "Growth";
  if (s.includes("strat") || s.includes("vision") || s.includes("busin") || s.includes("market") || s.includes("roadmap") || s.includes("exec")) return "Strategy";
  if (s.includes("comp") || s.includes("sal") || s.includes("pay") || s.includes("benefit") || s.includes("equity") || s.includes("bonus")) return "Compensation";
  if (s.includes("team") || s.includes("collab") || s.includes("peer") || s.includes("org")) return "Team";

  return "Team";
}

export const IntelQuestionCategory = z.preprocess(coerceIntelCategory, RawIntelQuestionCategory);

export const IntelQuestion = z.object({
  question: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()),
  context: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().default("")),
  suggestedPoints: z.preprocess(
    (v) => (Array.isArray(v) ? v.map((item) => String(item).trim()).filter(Boolean) : typeof v === "string" && v.trim() ? [v.trim()] : []),
    z.array(z.string()).default([])
  ),
  /** Which round to ask this in. Drives grouping in the prep UI. */
  round: InterviewRound.default("hiring-manager"),
  /** 1 = ask this first if you only get one question. Lower is more important. */
  priority: z.preprocess(
    (v) => {
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      return (n === 1 || n === 2 || n === 3) ? n : 2;
    },
    z.number().int().min(1).max(3).default(2)
  ),
  category: IntelQuestionCategory.default("Team"),
  expectedAnswer: z.preprocess((v) => (v == null ? undefined : String(v).trim()), z.string().optional()),
  /** What a weak or evasive answer sounds like, so the candidate can hear the risk. */
  redFlag: z.preprocess((v) => (v == null ? undefined : String(v).trim()), z.string().optional()),
  professionalExample: z.preprocess((v) => (v == null ? undefined : String(v).trim()), z.string().optional()),
});
export type IntelQuestion = z.infer<typeof IntelQuestion>;

/**
 * Live end-of-interview question. Shares the round/priority/redFlag vocabulary
 * with IntelQuestion so the prep-time and live generators cannot drift.
 */
export const EndInterviewQuestion = z.object({
  question: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()),
  context: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().default("")),
  round: InterviewRound.default("hiring-manager"),
  priority: z.preprocess(
    (v) => {
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      return (n === 1 || n === 2 || n === 3) ? n : 2;
    },
    z.number().int().min(1).max(3).default(2)
  ),
  category: IntelQuestionCategory.default("Team"),
  followUpNote: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().default("")),
  expectedAnswer: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().default("")),
  redFlag: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().default("")),
  professionalExample: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().default("")),
});
export type EndInterviewQuestion = z.infer<typeof EndInterviewQuestion>;

/** Normalizes a question list: drops blanks, de-duplicates, and enforces one priority-1 per round. */
export function normalizeCandidateQuestions<T extends { question: string; round: InterviewRound; priority: number }>(
  questions: T[],
): T[] {
  const seen = new Set<string>();
  const priorityOneByRound = new Set<InterviewRound>();

  return questions
    .filter((item) => {
      const text = item.question?.trim();
      if (!text) return false;
      // Collapse to alphanumeric words so paraphrase-level repeats still collide.
      const fingerprint = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    })
    .map((item) => {
      if (item.priority !== 1) return item;
      if (priorityOneByRound.has(item.round)) return { ...item, priority: 2 };
      priorityOneByRound.add(item.round);
      return item;
    });
}

export const JdInterviewQuestion = z.object({
  question: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()),
  category: z.preprocess((v) => (v == null ? "Architecture" : String(v).trim() || "Architecture"), z.string().default("Architecture")),
  suggestedAnswer: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().default("")),
});
export type JdInterviewQuestion = z.infer<typeof JdInterviewQuestion>;

/**
 * How much usable content the crawler actually recovered. Mirrors the Rust
 * `ScrapeQuality` enum. The prompt uses it to decide whether the model is
 * allowed to describe the company at all, rather than inventing a profile.
 */
export const ScrapeQuality = z.enum(["rich", "thin", "failed"]);
export type ScrapeQuality = z.infer<typeof ScrapeQuality>;

export const ScrapeResult = z.object({
  text: z.string(),
  quality: ScrapeQuality,
  pages_crawled: z.number().int(),
  host: z.string(),
});
export type ScrapeResult = z.infer<typeof ScrapeResult>;

const nullableString = z.preprocess(
  (v) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null),
  z.string().nullable().default(null)
);

const stringArray = z.preprocess(
  (v) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : []),
  z.array(z.string()).default([])
);

const questionsArray = z.preprocess((v) => {
  if (!Array.isArray(v)) return [];
  return v
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const q = (item as any).question || (item as any).q || (item as any).text || "";
      return {
        ...item,
        question: typeof q === "string" ? q : String(q || ""),
      };
    })
    .filter((item) => item.question.trim().length > 0);
}, z.array(IntelQuestion).default([]));

const jdQuestionsArray = z.preprocess((v) => {
  if (!Array.isArray(v)) return [];
  return v
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const q = (item as any).question || (item as any).q || (item as any).text || "";
      const a = (item as any).suggestedAnswer || (item as any).answer || "";
      return {
        ...item,
        question: typeof q === "string" ? q : String(q || ""),
        suggestedAnswer: typeof a === "string" ? a : String(a || ""),
      };
    })
    .filter((item) => item.question.trim().length > 0);
}, z.array(JdInterviewQuestion).default([]));

/**
 * Prose fields are nullable with NO defaults on purpose. A default here silently
 * fabricates research the crawler never found, and the UI then renders it as
 * fact. `null` means "not found" and must be surfaced as such.
 */
export const CompanyIntel = z.object({
  name: nullableString,
  coreBusiness: nullableString,
  technicalLandscape: nullableString,
  recentNews: nullableString,
  whyItMatters: nullableString,
  goldenFormula: nullableString,
  techStack: stringArray,
  questions: questionsArray,
  jdInterviewQuestions: jdQuestionsArray,
  hrQuestions: questionsArray,
  salaryNegotiationStrategy: nullableString,
  /** Provenance for the UI, so a thin crawl is visibly labelled. */
  sourceQuality: ScrapeQuality.default("rich"),
});
export type CompanyIntel = z.infer<typeof CompanyIntel>;
