export const SPEECH_MERGE_DELAY_MS = 2300;
export const INCOMPLETE_SPEECH_MERGE_DELAY_MS = 3800;

const NON_ACTIONABLE_PHRASES = new Set([
  "ah",
  "all right",
  "also",
  "alright",
  "awesome",
  "bye",
  "cool",
  "correct",
  "exactly",
  "fine",
  "goodbye",
  "got it",
  "great",
  "hello",
  "hey",
  "hi",
  "hmm",
  "mhm",
  "mm",
  "mm hmm",
  "no",
  "nope",
  "oh",
  "okay",
  "okay then",
  "ok",
  "perfect",
  "right",
  "so",
  "sure",
  "thanks",
  "thank you",
  "uh",
  "uh huh",
  "um",
  "understood",
  "yeah",
  "yep",
  "yes",
  "yup",
]);

const NON_SPEECH_LABELS = new Set([
  "applause",
  "background noise",
  "breathing",
  "cough",
  "coughing",
  "coughs",
  "inaudible",
  "laughter",
  "music",
  "noise",
  "silence",
  "sneeze",
  "sneezing",
  "throat clearing",
]);

const DANGLING_WORDS = new Set([
  "a",
  "about",
  "also",
  "an",
  "and",
  "as",
  "at",
  "because",
  "but",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
  "like",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "then",
  "to",
  "using",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
]);

const QUESTION_LEAD =
  /^(?:can|could|describe|did|do|does|explain|give|have|how|is|tell|walk|was|were|what|when|where|which|who|why|will|would)\b/i;
const SCENARIO_LEAD =
  /^(?:assume|consider|given|imagine|let(?:'s| us) say|picture|scenario|suppose)\b/i;
const COMPARISON_FILLERS = new Set(["ah", "er", "hmm", "like", "uh", "um"]);

export function normalizeSpeechText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function comparableSpeech(text: string): string {
  return normalizeSpeechText(text)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function comparisonWords(text: string): string[] {
  return comparableSpeech(text)
    .split(" ")
    .filter((word) => word && !COMPARISON_FILLERS.has(word));
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

export function areSpeechSegmentsEquivalent(
  first: string,
  second: string
): boolean {
  const firstWords = comparisonWords(first);
  const secondWords = comparisonWords(second);
  if (firstWords.length === 0 || secondWords.length === 0) return false;

  const shorterLength = Math.min(firstWords.length, secondWords.length);
  const longerLength = Math.max(firstWords.length, secondWords.length);
  if (shorterLength / longerLength < 0.75) return false;

  const commonLength = longestCommonSubsequenceLength(firstWords, secondWords);
  return commonLength / longerLength >= 0.86;
}

function dedupeRepeatedSentences(text: string): string {
  const sentences = normalizeSpeechText(text).split(/(?<=[?!.])\s+/);
  if (sentences.length < 2) return sentences[0] || "";

  const uniqueSentences: string[] = [];
  for (const sentence of sentences) {
    const words = comparisonWords(sentence);
    const isRepeated =
      words.length >= 6 &&
      uniqueSentences.some((existing) =>
        areSpeechSegmentsEquivalent(existing, sentence)
      );
    if (!isRepeated) uniqueSentences.push(sentence);
  }

  return uniqueSentences.join(" ");
}

export function isActionableSpeech(text: string): boolean {
  const normalized = normalizeSpeechText(text);
  if (!normalized) return false;

  if (
    /^(?:pluely stt error|transcription failed|no transcription found)\b/i.test(
      normalized
    )
  ) {
    return false;
  }

  const unwrapped = normalized
    .replace(/^[[(]\s*/, "")
    .replace(/\s*[\])]?[.!?]*$/, "");
  const comparable = comparableSpeech(unwrapped);
  if (!comparable) return false;

  if (
    NON_ACTIONABLE_PHRASES.has(comparable) ||
    NON_SPEECH_LABELS.has(comparable)
  ) {
    return false;
  }

  const words = comparable.split(" ");
  return !words.every(
    (word) =>
      NON_ACTIONABLE_PHRASES.has(word) || NON_SPEECH_LABELS.has(word)
  );
}

export function mergeSpeechSegments(current: string, incoming: string): string {
  const existing = dedupeRepeatedSentences(current);
  const next = dedupeRepeatedSentences(incoming);

  if (!existing) return next;
  if (!next) return existing;
  if (areSpeechSegmentsEquivalent(existing, next)) return existing;

  const existingWords = existing.split(" ");
  const incomingWords = next.split(" ");
  const comparableExisting = existingWords.map(comparableSpeech);
  const comparableIncoming = incomingWords.map(comparableSpeech);
  const maxOverlap = Math.min(
    comparableExisting.length,
    comparableIncoming.length,
    16
  );

  let overlap = 0;
  for (let size = maxOverlap; size > 0; size -= 1) {
    const existingTail = comparableExisting.slice(-size).join(" ");
    const incomingHead = comparableIncoming.slice(0, size).join(" ");
    if (existingTail === incomingHead) {
      overlap = size;
      break;
    }
  }

  if (overlap === incomingWords.length) return existing;
  return `${existing} ${incomingWords.slice(overlap).join(" ")}`;
}

export function getSpeechMergeDelay(text: string): number {
  const normalized = normalizeSpeechText(text);
  if (!normalized) return SPEECH_MERGE_DELAY_MS;
  if (SCENARIO_LEAD.test(normalized) && !normalized.includes("?")) {
    return INCOMPLETE_SPEECH_MERGE_DELAY_MS;
  }
  if (/[?!.]["')\]]?$/.test(normalized)) return SPEECH_MERGE_DELAY_MS;
  if (/[,;:—–-]$|\.\.\.$/.test(normalized)) {
    return INCOMPLETE_SPEECH_MERGE_DELAY_MS;
  }

  const words = comparableSpeech(normalized).split(" ").filter(Boolean);
  const finalWord = words[words.length - 1] || "";
  if (
    DANGLING_WORDS.has(finalWord) ||
    (QUESTION_LEAD.test(normalized) && words.length < 8)
  ) {
    return INCOMPLETE_SPEECH_MERGE_DELAY_MS;
  }

  return SPEECH_MERGE_DELAY_MS;
}
