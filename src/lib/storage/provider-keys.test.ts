import { describe, expect, it, beforeEach } from "vitest";

// In-memory mock for localStorage in node test environment
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, String(value)),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
};
globalThis.localStorage = localStorageMock as any;

import {
  persistProviderKey,
  getPersistedProviderKey,
  getAllPersistedProviderKeys,
} from "./provider-keys";

describe("provider-keys storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty string when no key is persisted", () => {
    expect(getPersistedProviderKey("gemini")).toBe("");
    expect(getPersistedProviderKey("openai")).toBe("");
  });

  it("persists and retrieves Gemini and OpenAI keys independently", () => {
    persistProviderKey("gemini", "AIzaSyTest12345");
    persistProviderKey("openai", "sk-proj-testOpenAi67890");

    expect(getPersistedProviderKey("gemini")).toBe("AIzaSyTest12345");
    expect(getPersistedProviderKey("openai")).toBe("sk-proj-testOpenAi67890");

    const all = getAllPersistedProviderKeys();
    expect(all["gemini"]).toBe("AIzaSyTest12345");
    expect(all["openai"]).toBe("sk-proj-testOpenAi67890");
  });

  it("trims whitespace from API keys", () => {
    persistProviderKey("gemini", "   AIzaSyTrimmedKey   ");
    expect(getPersistedProviderKey("gemini")).toBe("AIzaSyTrimmedKey");
  });

  it("deletes key if empty or whitespace provided", () => {
    persistProviderKey("gemini", "AIzaSyTest12345");
    expect(getPersistedProviderKey("gemini")).toBe("AIzaSyTest12345");

    persistProviderKey("gemini", "");
    expect(getPersistedProviderKey("gemini")).toBe("");

    persistProviderKey("openai", "sk-test");
    persistProviderKey("openai", "   ");
    expect(getPersistedProviderKey("openai")).toBe("");
  });

  it("also supports Gemini STT key slot without overwriting Gemini AI key", () => {
    persistProviderKey("gemini", "AIzaSyAiKey");
    persistProviderKey("gemini-stt", "AIzaSySttKey");

    expect(getPersistedProviderKey("gemini")).toBe("AIzaSyAiKey");
    expect(getPersistedProviderKey("gemini-stt")).toBe("AIzaSySttKey");
  });
});
