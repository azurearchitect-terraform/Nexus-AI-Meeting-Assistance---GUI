import { StoryBankItem, InterviewDebrief, InterviewMode } from "./contracts";

export const STORAGE_KEY_STORY_BANK = "nexus_story_bank";
export const STORAGE_KEY_INTERVIEW_DEBRIEFS = "nexus_interview_debriefs";
export const STORAGE_KEY_INTERVIEW_MODE = "nexus_interview_mode";
export const EVENT_STORY_BANK_UPDATED = "nexus_story_bank_updated";

export const uid = (prefix = "story"): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadStoryBank(): StoryBankItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STORY_BANK);
    if (!raw) return [];
    const parsed = safeJson<unknown[]>(raw, []);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const res = StoryBankItem.safeParse(item);
        return res.success ? res.data : null;
      })
      .filter((item): item is StoryBankItem => item !== null);
  } catch (e) {
    console.error("Failed to load story bank:", e);
    return [];
  }
}

export function saveStoryBank(stories: StoryBankItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_STORY_BANK, JSON.stringify(stories));
    window.dispatchEvent(new CustomEvent(EVENT_STORY_BANK_UPDATED, { detail: stories }));
  } catch (e) {
    console.error("Failed to save story bank:", e);
  }
}

export function addStoryItem(story: Omit<StoryBankItem, "id" | "createdAt">): StoryBankItem {
  const next: StoryBankItem = {
    ...story,
    id: uid("story"),
    createdAt: Date.now(),
  };
  const current = loadStoryBank();
  const updated = [...current, next];
  saveStoryBank(updated);
  return next;
}

export function updateStoryItem(id: string, partial: Partial<StoryBankItem>): StoryBankItem | null {
  const current = loadStoryBank();
  let updatedItem: StoryBankItem | null = null;
  const next = current.map((item) => {
    if (item.id === id) {
      updatedItem = { ...item, ...partial };
      return updatedItem;
    }
    return item;
  });
  if (updatedItem) {
    saveStoryBank(next);
  }
  return updatedItem;
}

export function deleteStoryItem(id: string): void {
  const current = loadStoryBank();
  const next = current.filter((item) => item.id !== id);
  saveStoryBank(next);
}

export function loadInterviewDebriefs(): InterviewDebrief[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INTERVIEW_DEBRIEFS);
    if (!raw) return [];
    const parsed = safeJson<unknown[]>(raw, []);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const res = InterviewDebrief.safeParse(item);
        return res.success ? res.data : null;
      })
      .filter((item): item is InterviewDebrief => item !== null);
  } catch (e) {
    console.error("Failed to load debriefs:", e);
    return [];
  }
}

export function saveInterviewDebriefs(items: InterviewDebrief[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_INTERVIEW_DEBRIEFS, JSON.stringify(items.slice(-50)));
  } catch (e) {
    console.error("Failed to save debriefs:", e);
  }
}

export function loadInterviewMode(): InterviewMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INTERVIEW_MODE);
    if (!raw) return "mixed";
    return InterviewMode.parse(raw);
  } catch {
    return "mixed";
  }
}

export function saveInterviewMode(mode: InterviewMode): void {
  try {
    localStorage.setItem(STORAGE_KEY_INTERVIEW_MODE, mode);
  } catch (e) {
    console.error("Failed to save interview mode:", e);
  }
}
