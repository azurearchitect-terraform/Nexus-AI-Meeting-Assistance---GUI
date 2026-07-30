import { invoke } from "@tauri-apps/api/core";

export interface MemoryChunk {
  id: string;
  content: string;
  metadata?: string;
  score: number;
}

export async function searchLocalMemory(
  query: string,
  limit: number = 5
): Promise<MemoryChunk[]> {
  try {
    return await invoke<MemoryChunk[]>("search_memory", { query, limit });
  } catch (error) {
    console.error("Failed to search local memory:", error);
    return [];
  }
}

export async function storeLocalMemory(
  content: string,
  metadata?: string
): Promise<string | null> {
  try {
    return await invoke<string>("store_memory", { content, metadata });
  } catch (error) {
    console.error("Failed to store local memory:", error);
    return null;
  }
}
