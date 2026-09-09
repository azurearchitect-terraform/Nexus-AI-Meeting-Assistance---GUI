import {
  CoverageChecklistItem,
  FollowUpPrediction,
  InterviewCoachInsight,
  InterviewDebrief,
  InterviewMode,
  StoryBankItem,
} from "./contracts";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((word) => word.length > 2);
}

export function similarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (!tokensA.size || !tokensB.size) return 0;
  let hit = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) hit++;
  }
  return hit / new Set([...tokensA, ...tokensB]).size;
}

export function matchStoryBank(
  question: string,
  answer: string,
  stories: StoryBankItem[]
): Array<StoryBankItem & { score: number; reason: string }> {
  const scored = stories
    .map((story) => {
      const haystack = [
        story.title,
        story.summary,
        story.situation,
        story.task,
        story.action,
        story.result,
        story.tags.join(" "),
        story.metrics.join(" "),
      ].join(" ");
      const score = Math.max(similarity(question, haystack), similarity(answer, haystack));
      const reason = story.tags.length
        ? `Matches: ${story.tags.slice(0, 3).join(", ")}`
        : "Matches your example bank";
      return { ...story, score, reason };
    })
    .filter((story) => story.score > 0.04)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return scored;
}

function hasAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

export function buildCoverageChecklist(
  question: string,
  answer: string,
  mode: InterviewMode
): CoverageChecklistItem[] {
  const normalized = `${question}\n${answer}`;
  const items: CoverageChecklistItem[] = [
    {
      label: "Answered the actual question",
      covered: similarity(question, answer) > 0.06,
      note: "Keep the answer anchored to the prompt.",
    },
    {
      label: "Clear structure",
      covered: answer.trim().split(/\s+/).filter(Boolean).length >= 20,
      note: "Lead with the headline, then expand.",
    },
    {
      label: "Situation or context",
      covered: hasAny(normalized, ["when ", "at ", "during ", "context", "situation", "project", "role", "team"]),
      note: "Set the scene in one sentence.",
    },
    {
      label: "Action you personally took",
      covered: hasAny(normalized, ["i led", "i owned", "i implemented", "i designed", "i built", "i drove", "i partnered", "i handled", "i wrote"]),
      note: "Use first-person ownership.",
    },
    {
      label: "Outcome or impact",
      covered: hasAny(normalized, ["result", "impact", "improved", "reduced", "increased", "saved", "delivered", "launched", "%", "sla", "revenue"]),
      note: "Close with measurable impact.",
    },
    {
      label: "Tradeoffs or reasoning",
      covered: hasAny(normalized, ["tradeoff", "because", "so that", "therefore", "however", "risk", "constraint", "alternative"]),
      note: "Show judgment, not just action.",
    },
  ];

  if (mode === "technical" || mode === "system-design") {
    items.push({
      label: "Architecture details",
      covered: hasAny(normalized, ["service", "api", "queue", "cache", "database", "network", "azure", "aws", "terraform", "security", "docker", "k8s"]),
      note: "Add concrete technical detail.",
    });
  }
  if (mode === "behavioral" || mode === "leadership" || mode === "recruiter") {
    items.push({
      label: "Collaboration or leadership",
      covered: hasAny(normalized, ["team", "stakeholder", "manager", "mentor", "coach", "cross-functional", "aligned", "consensus"]),
      note: "Include team context or leadership.",
    });
  }
  if (mode === "hr" || mode === "recruiter") {
    items.push({
      label: "Motivation / fit",
      covered: hasAny(normalized, ["why i want", "looking for", "fit", "excited", "interested", "culture", "value", "growth"]),
      note: "Keep it human and clear.",
    });
  }

  return items;
}

export function estimateScore(answer: string, checklist: CoverageChecklistItem[]): number {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const lengthScore = Math.min(25, Math.max(0, Math.round((words / 18) * 10)));
  const coveredCount = checklist.filter((item) => item.covered).length;
  const coverageScore = Math.round((coveredCount / Math.max(1, checklist.length)) * 75);
  return Math.min(100, lengthScore + coverageScore);
}

export function likelyFollowUps(
  question: string,
  answer: string,
  mode: InterviewMode
): FollowUpPrediction[] {
  const normalized = `${question} ${answer}`.toLowerCase();
  const list: FollowUpPrediction[] = [];
  const push = (questionText: string, reason: string, priority: "high" | "medium" | "low" = "medium") => {
    list.push({ question: questionText, reason, priority });
  };

  if (hasAny(normalized, ["architecture", "design", "system", "scale", "distributed", "microservice"])) {
    push("How did you handle the tradeoffs?", "Interviewer will likely test architecture decision boundaries.", "high");
    push("What was the hardest bottleneck or constraint?", "Tests production realism and operational depth.", "medium");
  }
  if (hasAny(normalized, ["conflict", "challenge", "failure", "mistake", "disagree"])) {
    push("What did you learn from that experience?", "Standard behavioral follow-up testing self-awareness.", "high");
    push("What would you do differently now?", "Shows career growth and reflection.", "medium");
  }
  if (hasAny(normalized, ["cost", "budget", "roi", "savings", "finops"])) {
    push("What specific metrics did you use to track impact?", "Expect quantification requests.", "high");
    push("How did you gain stakeholder buy-in?", "Cost optimization requires cross-functional alignment.", "medium");
  }
  if (mode === "hr" || mode === "recruiter") {
    push("What kind of work environment enables you to perform at your best?", "HR explores culture alignment and team fit.", "medium");
  }

  if (!list.length) {
    push("Can you walk me through one specific example?", "Interviewer will want deeper concrete evidence.", "high");
    push("What was the tangible business impact?", "Outcome quantification is the most common follow-up.", "medium");
  }

  return list.slice(0, 3);
}

export function buildInterviewCoachInsight(
  question: string,
  answer: string,
  mode: InterviewMode,
  stories: StoryBankItem[]
): InterviewCoachInsight {
  const checklist = buildCoverageChecklist(question, answer, mode);
  const score = estimateScore(answer, checklist);
  const matched = matchStoryBank(question, answer, stories);
  const storyMatchHint = matched[0]
    ? `${matched[0].title} (${Math.round(matched[0].score * 100)}% match)`
    : undefined;

  const strengths: string[] = [];
  const gaps: string[] = [];

  if (checklist[0]?.covered) strengths.push("You answered the question directly.");
  else gaps.push("Lead with the headline answer before elaborating.");

  if (checklist.some((item) => item.label === "Outcome or impact" && item.covered)) {
    strengths.push("You included measurable outcome or impact.");
  } else {
    gaps.push("Add a metric, SLA, or concrete business outcome.");
  }

  if (checklist.some((item) => item.label === "Action you personally took" && item.covered)) {
    strengths.push("Your personal technical ownership is evident.");
  } else {
    gaps.push("Clarify what you personally built vs. team contribution.");
  }

  if (checklist.some((item) => item.label === "Tradeoffs or reasoning" && item.covered)) {
    strengths.push("Your architectural trade-offs are visible.");
  } else {
    gaps.push("Explain why you chose that approach over viable alternatives.");
  }

  const coachingTip = gaps[0] || "Answer is well structured and specific.";
  const nextBestMove = matched[0]
    ? `Anchor the next point to your story: "${matched[0].title}".`
    : "Use one specific concrete example and close with verified impact.";

  return {
    summary: `Score ${score}/100. ${coachingTip}`,
    overallScore: score,
    structureScore: checklist[1]?.covered ? 85 : 55,
    clarityScore: checklist[0]?.covered ? 85 : 55,
    specificityScore: checklist.some((item) => item.label === "Outcome or impact" && item.covered) ? 85 : 50,
    confidenceScore: checklist.some((item) => item.label === "Clear structure" && item.covered) ? 80 : 50,
    strengths: strengths.slice(0, 4),
    gaps: gaps.slice(0, 4),
    coachingTip,
    nextBestMove,
    suggestedStoryTags: matched[0]?.tags.slice(0, 4) ?? [],
    checklist,
    likelyFollowUps: likelyFollowUps(question, answer, mode),
    storyMatchHint,
  };
}

export function buildDebriefFromInsight(
  question: string,
  answer: string,
  mode: InterviewMode,
  insight: InterviewCoachInsight,
  storyTitle?: string
): InterviewDebrief {
  return {
    question,
    answer,
    mode,
    summary: insight.summary,
    strengths: insight.strengths.slice(0, 3),
    improvements: insight.gaps.slice(0, 3),
    followUps: insight.likelyFollowUps.map((item) => item.question).slice(0, 3),
    storyTitle,
    createdAt: Date.now(),
  };
}
