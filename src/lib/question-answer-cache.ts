export const DEFAULT_QUESTION_CACHE_THRESHOLD = 0.8;

const FILLER_WORDS = new Set([
  "ah",
  "basically",
  "er",
  "hmm",
  "like",
  "literally",
  "uh",
  "um",
]);

export interface CacheableMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface CachedAnswerMatch {
  question: string;
  answer: string;
  similarity: number;
}

function normalizedQuestionWords(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word && !FILLER_WORDS.has(word));
}

function longestCommonSubsequenceLength(
  first: string[],
  second: string[]
): number {
  const previous = new Array<number>(second.length + 1).fill(0);
  const current = new Array<number>(second.length + 1).fill(0);

  for (const firstWord of first) {
    for (let index = 1; index <= second.length; index += 1) {
      current[index] =
        firstWord === second[index - 1]
          ? previous[index - 1] + 1
          : Math.max(previous[index], current[index - 1]);
    }

    for (let index = 0; index <= second.length; index += 1) {
      previous[index] = current[index];
      current[index] = 0;
    }
  }

  return previous[second.length];
}

function tokenDiceCoefficient(first: string[], second: string[]): number {
  const firstCounts = new Map<string, number>();
  for (const word of first) {
    firstCounts.set(word, (firstCounts.get(word) || 0) + 1);
  }

  let sharedWords = 0;
  for (const word of second) {
    const count = firstCounts.get(word) || 0;
    if (count > 0) {
      sharedWords += 1;
      firstCounts.set(word, count - 1);
    }
  }

  return (2 * sharedWords) / (first.length + second.length);
}

export function calculateQuestionSimilarity(
  firstQuestion: string,
  secondQuestion: string
): number {
  const firstWords = normalizedQuestionWords(firstQuestion);
  const secondWords = normalizedQuestionWords(secondQuestion);
  if (firstWords.length === 0 || secondWords.length === 0) return 0;

  const orderedSimilarity =
    longestCommonSubsequenceLength(firstWords, secondWords) /
    Math.max(firstWords.length, secondWords.length);
  const tokenSimilarity = tokenDiceCoefficient(firstWords, secondWords);

  return Math.max(orderedSimilarity, tokenSimilarity);
}

export function findCachedAnswer(
  question: string,
  messages: CacheableMessage[],
  threshold = DEFAULT_QUESTION_CACHE_THRESHOLD
): CachedAnswerMatch | null {
  const chronologicalMessages = [...messages].sort(
    (first, second) => (first.timestamp || 0) - (second.timestamp || 0)
  );
  let bestMatch: CachedAnswerMatch | null = null;

  for (let index = 0; index < chronologicalMessages.length; index += 1) {
    const candidate = chronologicalMessages[index];
    if (candidate.role !== "user" || !candidate.content.trim()) continue;

    const answer = chronologicalMessages[index + 1];
    if (answer?.role !== "assistant" || !answer.content.trim()) continue;

    const similarity = calculateQuestionSimilarity(
      question,
      candidate.content
    );
    if (
      similarity >= threshold &&
      (!bestMatch || similarity > bestMatch.similarity)
    ) {
      bestMatch = {
        question: candidate.content,
        answer: answer.content,
        similarity,
      };
    }
  }

  return bestMatch;
}
