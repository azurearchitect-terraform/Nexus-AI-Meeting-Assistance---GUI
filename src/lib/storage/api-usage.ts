export interface ApiUsageRecord {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: string; // ISO String
}

const STORAGE_KEY = "nexus_api_usage_records";

export const getApiUsageRecords = (): ApiUsageRecord[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to parse API usage records:", error);
    return [];
  }
};

export const saveApiUsageRecord = (record: Omit<ApiUsageRecord, "timestamp">) => {
  const records = getApiUsageRecords();
  records.push({
    ...record,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  
  // Dispatch a custom event so other windows (like dashboard) can listen for updates
  window.dispatchEvent(new CustomEvent("api-usage-updated"));
};

export const clearApiUsageRecords = () => {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("api-usage-updated"));
};
