import { z } from "zod";

export const RawInterviewMode = z.enum([
  "mixed",
  "behavioral",
  "technical",
  "system-design",
  "hr",
  "recruiter",
  "leadership",
]);
export type InterviewMode = z.infer<typeof RawInterviewMode>;

export function coerceInterviewMode(val: unknown): InterviewMode {
  if (typeof val !== "string") return "mixed";
  const s = val.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (s === "behavioral" || s.includes("behav") || s.includes("star")) return "behavioral";
  if (s === "technical" || s.includes("tech") || s.includes("engineer") || s.includes("code")) return "technical";
  if (s === "system-design" || s.includes("design") || s.includes("arch")) return "system-design";
  if (s === "hr" || s.includes("culture") || s.includes("fit")) return "hr";
  if (s === "recruiter" || s.includes("recruit") || s.includes("screen")) return "recruiter";
  if (s === "leadership" || s.includes("lead") || s.includes("exec") || s.includes("manage")) return "leadership";
  return "mixed";
}

export const InterviewMode = z.preprocess(coerceInterviewMode, RawInterviewMode);

export const StoryBankItem = z.object({
  id: z.string(),
  title: z.preprocess((v) => (v == null ? "Untitled Story" : String(v).trim() || "Untitled Story"), z.string()),
  summary: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().default("")),
  situation: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().default("")),
  task: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().default("")),
  action: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().default("")),
  result: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().default("")),
  metrics: z.preprocess(
    (v) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : typeof v === "string" && v.trim() ? [v.trim()] : []),
    z.array(z.string()).default([])
  ),
  tags: z.preprocess(
    (v) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : typeof v === "string" && v.trim() ? [v.trim()] : []),
    z.array(z.string()).default([])
  ),
  roleFocus: InterviewMode.default("mixed"),
  createdAt: z.number().default(() => Date.now()),
});
export type StoryBankItem = z.infer<typeof StoryBankItem>;

export const CoverageChecklistItem = z.object({
  label: z.string(),
  covered: z.boolean(),
  note: z.string().default(""),
});
export type CoverageChecklistItem = z.infer<typeof CoverageChecklistItem>;

export const FollowUpPrediction = z.object({
  question: z.string(),
  reason: z.string().default(""),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
});
export type FollowUpPrediction = z.infer<typeof FollowUpPrediction>;

export const InterviewCoachInsight = z.object({
  summary: z.string(),
  overallScore: z.number().min(0).max(100),
  structureScore: z.number().min(0).max(100),
  clarityScore: z.number().min(0).max(100),
  specificityScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(100),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  coachingTip: z.string().default(""),
  nextBestMove: z.string().default(""),
  suggestedStoryTags: z.array(z.string()).default([]),
  checklist: z.array(CoverageChecklistItem).default([]),
  likelyFollowUps: z.array(FollowUpPrediction).default([]),
  storyMatchHint: z.string().optional(),
});
export type InterviewCoachInsight = z.infer<typeof InterviewCoachInsight>;

export const InterviewDebrief = z.object({
  question: z.string(),
  answer: z.string(),
  mode: RawInterviewMode.default("mixed"),
  summary: z.string(),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  followUps: z.array(z.string()).default([]),
  storyTitle: z.string().optional(),
  createdAt: z.number().default(() => Date.now()),
});
export type InterviewDebrief = z.infer<typeof InterviewDebrief>;
