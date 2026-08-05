export type ApiValidationStatus = 'loading' | 'valid' | 'invalid' | 'missing' | 'unsupported';

export async function validateProvider(providerId: string, variables: Record<string, string>): Promise<ApiValidationStatus> {
  if (!providerId) return 'missing';
  
  if (providerId === "openai" || providerId === "openai-whisper") {
    const apiKey = variables.API_KEY || variables.api_key;
    if (!apiKey) return 'missing';
    
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });
      if (res.ok) return 'valid';
      if (res.status === 401) return 'invalid';
      return 'invalid';
    } catch (e) {
      return 'invalid';
    }
  }

  if (providerId === "gemini" || providerId === "gemini-stt" || providerId.startsWith("gemini")) {
    const apiKey = variables.API_KEY || variables.api_key;
    if (!apiKey) return 'missing';
    
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (res.ok) return 'valid';
      if (res.status === 400 || res.status === 401 || res.status === 403) return 'invalid';
      return 'invalid';
    } catch (e) {
      return 'invalid';
    }
  }

  if (providerId === "auto") {
    let keys: Record<string, string> = {};
    try {
      const keysStr = localStorage.getItem("provider_api_keys");
      if (keysStr) keys = JSON.parse(keysStr);
    } catch (e) {}
    const groqKey = variables.GROQ_KEY || keys["groq"] || "";
    const geminiKey = variables.GEMINI_KEY || keys["gemini"] || "";
    const openaiKey = variables.OPENAI_KEY || keys["openai"] || "";
    
    if (groqKey || geminiKey || openaiKey) return 'valid';
    return 'missing';
  }

  if (providerId === "groq" || providerId === "groq-stt" || providerId === "groq_whisper") {
    let apiKey = variables.API_KEY || variables.api_key;
    if (!apiKey) {
      try {
        const keysStr = localStorage.getItem("provider_api_keys");
        if (keysStr) {
          const keys = JSON.parse(keysStr);
          apiKey = keys["groq"] || "";
        }
      } catch (e) {}
    }
    if (!apiKey) return 'missing';
    
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });
      if (res.ok) return 'valid';
      return 'invalid';
    } catch (e) {
      return 'invalid';
    }
  }

  // Fallback for providers we don't have explicit validation checks for
  return 'unsupported';
}
