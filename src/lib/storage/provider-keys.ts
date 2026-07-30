/**
 * provider-keys.ts
 *
 * Stores API keys for each provider independently so they survive
 * switching to Auto mode (which overwrites the single selected-provider slot).
 *
 * Schema stored in localStorage under PROVIDER_API_KEYS:
 *   { groq: "gsk_...", gemini: "AIza...", openai: "sk-..." }
 */
import { STORAGE_KEYS } from "@/config";

type ProviderKeyMap = Record<string, string>;

function load(): ProviderKeyMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROVIDER_API_KEYS);
    if (!raw) return {};
    return JSON.parse(raw) as ProviderKeyMap;
  } catch {
    return {};
  }
}

function save(map: ProviderKeyMap) {
  try {
    localStorage.setItem(STORAGE_KEYS.PROVIDER_API_KEYS, JSON.stringify(map));
  } catch {}
}

/** Call this whenever a provider's API key is saved by the user. */
export function persistProviderKey(providerId: string, apiKey: string) {
  if (!providerId || !apiKey?.trim()) return;
  const map = load();
  map[providerId] = apiKey.trim();
  save(map);
}

/** Retrieve a stored key for a given provider (e.g. "groq", "gemini", "openai"). */
export function getPersistedProviderKey(providerId: string): string {
  return load()[providerId] ?? "";
}

/** Return all stored provider keys at once. */
export function getAllPersistedProviderKeys(): ProviderKeyMap {
  return load();
}
