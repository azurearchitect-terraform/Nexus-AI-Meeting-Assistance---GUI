import { AI_PROVIDERS } from "@/config";

// ─── Thresholds ────────────────────────────────────────────────────────────────
// Anything under SHORT_THRESHOLD chars goes to Groq (fastest, free).
// Anything above LARGE_THRESHOLD chars goes to Gemini (huge context, cheap).
// In between → Gemini flash-lite as a cheap balanced option.
const SHORT_THRESHOLD = 600;   // ~150 words
const LARGE_THRESHOLD = 4000;  // ~1 000 words (meeting transcripts, docs)

// ─── Model definitions ─────────────────────────────────────────────────────────
const GROQ_PROVIDER_ID  = "groq";
const GEMINI_PROVIDER_ID = "gemini";
const OPENAI_PROVIDER_ID = "openai";

// Cheapest / fastest Gemini model that is currently live
const GEMINI_CHEAP_MODEL = "gemini-3.5-flash-lite";
const GROQ_FAST_MODEL    = "llama-3.1-8b-instant";
const OPENAI_SMART_MODEL = "gpt-4o";

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface AutoRouterKeys {
  groq?: string;
  gemini?: string;
  openai?: string;
}

export interface RoutedProvider {
  providerId: string;
  model: string;
  providerDef: any;
  apiKey: string;
  reason: string;
}

// ─── Helper ────────────────────────────────────────────────────────────────────
function isComplexQuery(message: string): boolean {
  const complexKeywords = [
    "code", "debug", "implement", "algorithm", "refactor", "architecture",
    "function", "class", "typescript", "javascript", "python", "sql",
    "error", "exception", "stack trace", "compile",
  ];
  const lower = message.toLowerCase();
  return complexKeywords.some((kw) => lower.includes(kw));
}

// ─── Main Router ───────────────────────────────────────────────────────────────
/**
 * Decides which provider + model to use based on:
 *   1. Message length (short → Groq, long → Gemini)
 *   2. Complexity keywords (coding → OpenAI if key available)
 *
 * Falls back gracefully if a preferred provider's key is missing.
 */
export function resolveAutoRoute(
  userMessage: string,
  history: any[],
  keys: AutoRouterKeys
): RoutedProvider | null {
  const totalText =
    userMessage + history.map((h) => h.content).join(" ");
  const totalLen = totalText.length;

  const hasGroq   = !!keys.groq?.trim();
  const hasGemini = !!keys.gemini?.trim();
  const hasOpenAI = !!keys.openai?.trim();

  const geminiDef = AI_PROVIDERS.find((p) => p.id === GEMINI_PROVIDER_ID);
  const groqDef   = AI_PROVIDERS.find((p) => p.id === GROQ_PROVIDER_ID);
  const openaiDef = AI_PROVIDERS.find((p) => p.id === OPENAI_PROVIDER_ID);

  // 1. Complex coding query → OpenAI (best reasoning), fallback Gemini, then Groq
  if (isComplexQuery(userMessage)) {
    if (hasOpenAI && openaiDef) {
      return {
        providerId: OPENAI_PROVIDER_ID,
        model: OPENAI_SMART_MODEL,
        providerDef: openaiDef,
        apiKey: keys.openai!,
        reason: `Routing to OpenAI (${OPENAI_SMART_MODEL}) — complex/coding query detected`,
      };
    }
    if (hasGemini && geminiDef) {
      return {
        providerId: GEMINI_PROVIDER_ID,
        model: GEMINI_CHEAP_MODEL,
        providerDef: geminiDef,
        apiKey: keys.gemini!,
        reason: `Routing to Gemini (${GEMINI_CHEAP_MODEL}) — complex query, OpenAI key not set`,
      };
    }
  }

  // 2. Short query → Groq (fastest, free tier)
  if (totalLen <= SHORT_THRESHOLD) {
    if (hasGroq && groqDef) {
      return {
        providerId: GROQ_PROVIDER_ID,
        model: GROQ_FAST_MODEL,
        providerDef: groqDef,
        apiKey: keys.groq!,
        reason: `Routing to Groq (${GROQ_FAST_MODEL}) — short query, fastest response`,
      };
    }
    // Groq not available, fall through to Gemini
  }

  // 3. Large context / long query → Gemini (1M token window, cheap)
  if (totalLen > LARGE_THRESHOLD || !hasGroq) {
    if (hasGemini && geminiDef) {
      return {
        providerId: GEMINI_PROVIDER_ID,
        model: GEMINI_CHEAP_MODEL,
        providerDef: geminiDef,
        apiKey: keys.gemini!,
        reason: `Routing to Gemini (${GEMINI_CHEAP_MODEL}) — large context or Groq unavailable`,
      };
    }
  }

  // 4. Medium query → Groq first, Gemini fallback
  if (hasGroq && groqDef) {
    return {
      providerId: GROQ_PROVIDER_ID,
      model: GROQ_FAST_MODEL,
      providerDef: groqDef,
      apiKey: keys.groq!,
      reason: `Routing to Groq (${GROQ_FAST_MODEL}) — medium query`,
    };
  }
  if (hasGemini && geminiDef) {
    return {
      providerId: GEMINI_PROVIDER_ID,
      model: GEMINI_CHEAP_MODEL,
      providerDef: geminiDef,
      apiKey: keys.gemini!,
      reason: `Routing to Gemini (${GEMINI_CHEAP_MODEL}) — Groq unavailable`,
    };
  }
  if (hasOpenAI && openaiDef) {
    return {
      providerId: OPENAI_PROVIDER_ID,
      model: OPENAI_SMART_MODEL,
      providerDef: openaiDef,
      apiKey: keys.openai!,
      reason: `Routing to OpenAI (${OPENAI_SMART_MODEL}) — only available key`,
    };
  }

  // No usable key found
  return null;
}

/**
 * Build a TYPE_PROVIDER-compatible object from a provider definition + chosen model.
 * This replaces the {{MODEL}} placeholder in the curl template with the actual model.
 */
export function buildRoutedProviderConfig(routed: RoutedProvider): {
  provider: any;
  selectedProvider: { provider: string; variables: Record<string, string> };
} {
  // Inject the chosen model directly into the curl template
  const patchedCurl = routed.providerDef.curl.replace(/{{MODEL}}/g, routed.model);
  const patchedDef  = { ...routed.providerDef, curl: patchedCurl };

  return {
    provider: patchedDef,
    selectedProvider: {
      provider: routed.providerId,
      variables: {
        API_KEY: routed.apiKey,
        MODEL: routed.model,
      },
    },
  };
}
