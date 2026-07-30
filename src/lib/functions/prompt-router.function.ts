import { PERSONAS, DEFAULT_SYSTEM_PROMPT } from "@/config";
import { getByPath } from "./common.function";
export async function routePrompt(transcript: string, selectedProvider: { provider: string; variables: Record<string, string> }): Promise<{ systemPrompt: string, personaName: string }> {
  if (!transcript || transcript.trim() === "") {
    return { systemPrompt: DEFAULT_SYSTEM_PROMPT, personaName: "Default Assistant" };
  }

  const personaDescriptions = PERSONAS.map(p => `- ID: ${p.id}, Name: ${p.name}, Description: ${p.description}`).join("\n");

  const routerSystemPrompt = `You are an intelligent intent router. 
Analyze the following transcript and determine the best persona to handle the response.

Available Personas:
${personaDescriptions}

Respond ONLY with a valid JSON object containing exactly one key "persona_id" with the ID of the chosen persona.
Example: {"persona_id": "azure_architect"}`;

  try {
    const apiKey = selectedProvider.variables.api_key;
    if (!apiKey) {
      console.warn("[Router] No API key found, returning default prompt");
      return { systemPrompt: DEFAULT_SYSTEM_PROMPT, personaName: "Default Assistant" };
    }

    if (selectedProvider.provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // Using cheap router model as requested
          messages: [
            { role: "system", content: routerSystemPrompt },
            { role: "user", content: transcript }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = getByPath(data, "choices[0].message.content");
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.persona_id) {
            const matchedPersona = PERSONAS.find(p => p.id === parsed.persona_id);
            if (matchedPersona) {
              console.log(`[Router] Matched Persona: ${matchedPersona.name}`);
              return { systemPrompt: matchedPersona.systemPrompt, personaName: matchedPersona.name };
            }
          }
        }
      }
    } else if (selectedProvider.provider === "gemini") {
      // Use cheapest/fastest stable model
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: routerSystemPrompt }] },
          contents: [{ role: "user", parts: [{ text: transcript }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = getByPath(data, "candidates[0].content.parts[0].text");
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.persona_id) {
            const matchedPersona = PERSONAS.find(p => p.id === parsed.persona_id);
            if (matchedPersona) {
              console.log(`[Router] Matched Persona: ${matchedPersona.name}`);
              return { systemPrompt: matchedPersona.systemPrompt, personaName: matchedPersona.name };
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("[Router] Failed to route prompt:", e);
  }

  return { systemPrompt: DEFAULT_SYSTEM_PROMPT, personaName: "Default Assistant" };
}
