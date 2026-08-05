import { PERSONAS, DEFAULT_SYSTEM_PROMPT } from "@/config";

/**
 * Ultra-fast, zero-latency prompt & persona router.
 * Evaluates transcript intent locally in < 0.1ms without blocking network roundtrips.
 */
export async function routePrompt(
  transcript: string,
  _selectedProvider?: { provider: string; variables: Record<string, string> }
): Promise<{ systemPrompt: string; personaName: string }> {
  if (!transcript || transcript.trim() === "") {
    return { systemPrompt: DEFAULT_SYSTEM_PROMPT, personaName: PERSONAS[0].name };
  }

  const text = transcript.toLowerCase();

  // 1. Amazon Leadership Principles
  if (
    text.includes("amazon") ||
    text.includes("customer obsession") ||
    text.includes("ownership") ||
    text.includes("dive deep") ||
    text.includes("bias for action") ||
    text.includes("earn trust") ||
    text.includes("tell me about a time you had a conflict") ||
    text.includes("tell me about a failure") ||
    text.includes("deliver results")
  ) {
    const p = PERSONAS.find((x) => x.id === "amazon_interview_mode");
    if (p) return { systemPrompt: p.systemPrompt, personaName: p.name };
  }

  // 2. Google Interview Mode
  if (
    text.includes("google") ||
    text.includes("distributed system") ||
    text.includes("scale to billions") ||
    text.includes("mapreduce") ||
    text.includes("paxos") ||
    text.includes("raft") ||
    text.includes("bigtable") ||
    text.includes("spanner")
  ) {
    const p = PERSONAS.find((x) => x.id === "google_interview_mode");
    if (p) return { systemPrompt: p.systemPrompt, personaName: p.name };
  }

  // 3. Meta Interview Mode
  if (
    text.includes("meta") ||
    text.includes("facebook") ||
    text.includes("move fast") ||
    text.includes("product sense") ||
    text.includes("hackathon")
  ) {
    const p = PERSONAS.find((x) => x.id === "meta_interview_mode");
    if (p) return { systemPrompt: p.systemPrompt, personaName: p.name };
  }

  // 4. Microsoft Interview Mode
  if (
    text.includes("microsoft") ||
    text.includes("cloud adoption framework") ||
    text.includes("caf") ||
    text.includes("well-architected") ||
    text.includes("waf") ||
    text.includes("entra id") ||
    text.includes("azure active directory")
  ) {
    const p = PERSONAS.find((x) => x.id === "microsoft_interview_mode");
    if (p) return { systemPrompt: p.systemPrompt, personaName: p.name };
  }

  // 5. Executive / C-Level (CEO / CTO / Director)
  if (
    text.includes("revenue") ||
    text.includes("roi") ||
    text.includes("p&l") ||
    text.includes("board of directors") ||
    text.includes("market positioning") ||
    text.includes("investors")
  ) {
    const p = PERSONAS.find((x) => x.id === "ceo") || PERSONAS.find((x) => x.id === "cto");
    if (p) return { systemPrompt: p.systemPrompt, personaName: p.name };
  }

  if (
    text.includes("technology strategy") ||
    text.includes("enterprise architecture") ||
    text.includes("cybersecurity vision") ||
    text.includes("ai adoption") ||
    text.includes("cto")
  ) {
    const p = PERSONAS.find((x) => x.id === "cto");
    if (p) return { systemPrompt: p.systemPrompt, personaName: p.name };
  }

  if (
    text.includes("kpi") ||
    text.includes("headcount") ||
    text.includes("organizational growth") ||
    text.includes("risk management") ||
    text.includes("engineering director")
  ) {
    const p = PERSONAS.find((x) => x.id === "director_of_engineering");
    if (p) return { systemPrompt: p.systemPrompt, personaName: p.name };
  }

  // 6. Management & Leadership (EM / Senior EM)
  if (
    text.includes("managing managers") ||
    text.includes("org scaling") ||
    text.includes("cross-functional") ||
    text.includes("delivery strategy")
  ) {
    const p = PERSONAS.find((x) => x.id === "senior_engineering_manager");
    if (p) return { systemPrompt: p.systemPrompt, personaName: p.name };
  }

  if (
    text.includes("team leadership") ||
    text.includes("how do you handle underperformance") ||
    text.includes("sprint planning") ||
    text.includes("agile execution") ||
    text.includes("hiring process") ||
    text.includes("1 on 1") ||
    text.includes("one on one")
  ) {
    const p = PERSONAS.find((x) => x.id === "engineering_manager");
    if (p) return { systemPrompt: p.systemPrompt, personaName: p.name };
  }

  // 7. Principal Cloud Architect & Enterprise Strategy
  if (
    text.includes("landing zone") ||
    text.includes("landing zones") ||
    text.includes("finops") ||
    text.includes("multi-region") ||
    text.includes("multi-cloud") ||
    text.includes("governance") ||
    text.includes("platform engineering") ||
    text.includes("enterprise modernization")
  ) {
    const p = PERSONAS.find((x) => x.id === "principal_cloud_architect");
    if (p) return { systemPrompt: p.systemPrompt, personaName: p.name };
  }

  // 8. Azure Solutions Architect (Default for technical/architecture/infrastructure)
  const defaultPersona = PERSONAS[0];
  return {
    systemPrompt: defaultPersona?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    personaName: defaultPersona?.name || "Azure Solutions Architect",
  };
}

