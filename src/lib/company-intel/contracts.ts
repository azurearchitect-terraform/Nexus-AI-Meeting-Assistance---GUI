import { z } from "zod";

export const InterviewRound = z.enum(["recruiter", "hiring-manager", "technical", "executive"]);
export type InterviewRound = z.infer<typeof InterviewRound>;

export const IntelQuestionCategory = z.enum([
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
export type IntelQuestionCategory = z.infer<typeof IntelQuestionCategory>;

export const IntelQuestion = z.object({
  question: z.string(),
  context: z.string(),
  suggestedPoints: z.array(z.string()).default([]),
  /** Which round to ask this in. Drives grouping in the prep UI. */
  round: InterviewRound.default("hiring-manager"),
  /** 1 = ask this first if you only get one question. Lower is more important. */
  priority: z.number().int().min(1).max(3).default(2),
  category: IntelQuestionCategory.default("Team"),
  expectedAnswer: z.string().optional(),
  /** What a weak or evasive answer sounds like, so the candidate can hear the risk. */
  redFlag: z.string().optional(),
  professionalExample: z.string().optional(),
});
export type IntelQuestion = z.infer<typeof IntelQuestion>;

/**
 * Live end-of-interview question. Shares the round/priority/redFlag vocabulary
 * with IntelQuestion so the prep-time and live generators cannot drift.
 */
export const EndInterviewQuestion = z.object({
  question: z.string(),
  context: z.string().default(""),
  round: InterviewRound.default("hiring-manager"),
  priority: z.number().int().min(1).max(3).default(2),
  category: IntelQuestionCategory.default("Team"),
  followUpNote: z.string().default(""),
  expectedAnswer: z.string().default(""),
  redFlag: z.string().default(""),
  professionalExample: z.string().default(""),
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
  question: z.string(),
  category: z.string().default("Architecture"),
  suggestedAnswer: z.string(),
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

/**
 * Prose fields are nullable with NO defaults on purpose. A default here silently
 * fabricates research the crawler never found, and the UI then renders it as
 * fact. `null` means "not found" and must be surfaced as such.
 */
export const CompanyIntel = z.object({
  name: z.string().nullable().default(null),
  coreBusiness: z.string().nullable().default(null),
  technicalLandscape: z.string().nullable().default(null),
  recentNews: z.string().nullable().default(null),
  whyItMatters: z.string().nullable().default(null),
  goldenFormula: z.string().nullable().default(null),
  techStack: z.array(z.string()).default([]),
  questions: z.array(IntelQuestion).default([]),
  jdInterviewQuestions: z.array(JdInterviewQuestion).default([]),
  hrQuestions: z.array(IntelQuestion).default([]),
  salaryNegotiationStrategy: z.string().nullable().default(null),
  /** Provenance for the UI, so a thin crawl is visibly labelled. */
  sourceQuality: ScrapeQuality.default("rich"),
});
export type CompanyIntel = z.infer<typeof CompanyIntel>;
