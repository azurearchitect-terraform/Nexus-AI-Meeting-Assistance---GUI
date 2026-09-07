import { useState, useEffect } from "react";
import {
  Briefcase,
  Globe,
  Code2,
  Star,
  ShieldAlert,
  DollarSign,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components";
import {
  CompanyIntel,
  InterviewRound,
  getLatestCompanyIntel,
  saveLatestCompanyIntel,
  EVENT_COMPANY_INTEL_UPDATED,
} from "@/lib";

const ROUNDS: { id: InterviewRound; label: string }[] = [
  { id: "recruiter", label: "Recruiter" },
  { id: "hiring-manager", label: "Hiring Manager" },
  { id: "technical", label: "Technical" },
  { id: "executive", label: "Executive" },
];

export const IntelMode = () => {
  const [intel, setIntel] = useState<CompanyIntel | null>(() => getLatestCompanyIntel());
  const [activeSection, setActiveSection] = useState<"pitch" | "questions" | "jd" | "salary">("pitch");
  const [selectedRound, setSelectedRound] = useState<InterviewRound>("hiring-manager");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      setIntel(e.detail ?? getLatestCompanyIntel());
    };
    window.addEventListener(EVENT_COMPANY_INTEL_UPDATED, handleUpdate);
    return () => window.removeEventListener(EVENT_COMPANY_INTEL_UPDATED, handleUpdate);
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openDashboard = async () => {
    try {
      await invoke("open_dashboard");
    } catch (e) {
      console.error("Failed to open dashboard:", e);
    }
  };

  if (!intel) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center select-none">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-4 shadow-sm">
          <Briefcase className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-foreground">No Company Intel Profile Loaded</h3>
        <p className="mt-2 max-w-sm text-xs text-muted-foreground leading-relaxed">
          Crawl a company website in the Dashboard to unlock tailored company intelligence, the Golden Formula pitch, and round-specific end-of-interview questions.
        </p>
        <Button
          onClick={openDashboard}
          className="mt-6 flex items-center gap-2 rounded-xl text-xs font-semibold px-4 py-2"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open Dashboard → Company Prep
        </Button>
      </div>
    );
  }

  const allQuestions = [...intel.questions, ...intel.hrQuestions];
  const roundQuestions = allQuestions
    .filter((q) => q.round === selectedRound)
    .sort((a, b) => a.priority - b.priority);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background/50">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Briefcase className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-bold text-foreground truncate">
            {intel.name ?? "Company Intel"}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              intel.sourceQuality === "rich"
                ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                : intel.sourceQuality === "thin"
                ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                : "bg-destructive/15 text-destructive border border-destructive/30"
            }`}
          >
            {intel.sourceQuality} crawl
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={openDashboard}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="Edit in Dashboard"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Dashboard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => saveLatestCompanyIntel(null)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            title="Clear Intel Profile"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Quality Warning if not rich */}
      {intel.sourceQuality !== "rich" && (
        <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-[11px] text-amber-500">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {intel.sourceQuality === "failed"
              ? "Crawl recovered no site prose. Ungrounded company facts were left blank."
              : "Thin crawl recovered minimal prose. Facts left blank rather than invented."}
          </span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-border/40 px-3 py-1.5 bg-background/30 shrink-0">
        <button
          onClick={() => setActiveSection("pitch")}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
            activeSection === "pitch"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          Pitch &amp; Facts
        </button>
        <button
          onClick={() => setActiveSection("questions")}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
            activeSection === "questions"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          Questions to Ask ({allQuestions.length})
        </button>
        {intel.jdInterviewQuestions.length > 0 && (
          <button
            onClick={() => setActiveSection("jd")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              activeSection === "jd"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            Role Questions ({intel.jdInterviewQuestions.length})
          </button>
        )}
        {intel.salaryNegotiationStrategy && (
          <button
            onClick={() => setActiveSection("salary")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              activeSection === "salary"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            Salary Strategy
          </button>
        )}
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* SECTION 1: PITCH & FACTS */}
        {activeSection === "pitch" && (
          <div className="space-y-4">
            {intel.goldenFormula ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
                    The Golden Formula (60-90s Spoken Pitch)
                  </h4>
                  <button
                    onClick={() => handleCopy(intel.goldenFormula!, "pitch")}
                    className="flex items-center gap-1 text-[10px] text-amber-500/80 hover:text-amber-500"
                  >
                    {copiedId === "pitch" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedId === "pitch" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-amber-500/95 italic font-medium">
                  "{intel.goldenFormula}"
                </p>
              </div>
            ) : (
              <p className="italic text-muted-foreground/60 p-3 rounded-lg border border-dashed border-border/50">
                Golden formula unavailable due to lack of grounded company content.
              </p>
            )}

            {intel.coreBusiness && (
              <div className="rounded-xl border border-border bg-card/60 p-3 space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Globe className="h-3 w-3 text-primary" /> Core Business &amp; Customers
                </h4>
                <p className="text-xs leading-relaxed text-foreground/90">{intel.coreBusiness}</p>
              </div>
            )}

            {intel.technicalLandscape && (
              <div className="rounded-xl border border-border bg-card/60 p-3 space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Code2 className="h-3 w-3 text-primary" /> Tech Environment &amp; Culture
                </h4>
                <p className="text-xs leading-relaxed text-foreground/90">{intel.technicalLandscape}</p>
              </div>
            )}

            {intel.techStack && intel.techStack.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Evidenced Tech Stack
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {intel.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-foreground font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: CANDIDATE QUESTIONS TO ASK */}
        {activeSection === "questions" && (
          <div className="space-y-3">
            {/* Round pills */}
            <div className="flex items-center gap-1 pb-1 border-b border-border/30">
              {ROUNDS.map((r) => {
                const count = allQuestions.filter((q) => q.round === r.id).length;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRound(r.id)}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                      selectedRound === r.id
                        ? "bg-muted text-foreground border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r.label} ({count})
                  </button>
                );
              })}
            </div>

            {roundQuestions.length === 0 ? (
              <p className="italic text-muted-foreground/60 py-4 text-center">
                No questions tailored for this round.
              </p>
            ) : (
              roundQuestions.map((q, idx) => {
                const isTop = q.priority === 1;
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3 space-y-2 transition-colors ${
                      isTop
                        ? "border-amber-500/50 bg-amber-500/[0.06]"
                        : "border-border/60 bg-card/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-[10px] font-bold text-primary">
                          {idx + 1}
                        </span>
                        <h5 className="text-xs font-semibold text-foreground leading-snug">
                          {q.question}
                        </h5>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isTop && (
                          <span className="flex items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-bold text-amber-500">
                            <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> ASK THIS
                          </span>
                        )}
                        <button
                          onClick={() => handleCopy(q.question, `q-${selectedRound}-${idx}`)}
                          className="p-1 text-muted-foreground hover:text-foreground rounded"
                          title="Copy question"
                        >
                          {copiedId === `q-${selectedRound}-${idx}` ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="pl-6 space-y-1.5 text-[11px]">
                      <p className="text-muted-foreground/80 leading-relaxed">
                        <span className="font-semibold text-foreground/80">Context:</span> {q.context}
                      </p>

                      {q.expectedAnswer && (
                        <div className="rounded bg-emerald-500/[0.08] p-2 border border-emerald-500/20 text-emerald-500/90 leading-relaxed">
                          <span className="font-bold">Strong answer sounds like:</span> {q.expectedAnswer}
                        </div>
                      )}

                      {q.redFlag && (
                        <div className="rounded bg-destructive/[0.08] p-2 border border-destructive/20 text-destructive/90 leading-relaxed flex items-start gap-1">
                          <ShieldAlert className="h-3 w-3 shrink-0 mt-0.5" />
                          <span><span className="font-bold">Red Flag:</span> {q.redFlag}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* SECTION 3: EXPECTED QUESTIONS FROM JD */}
        {activeSection === "jd" && (
          <div className="space-y-3">
            {intel.jdInterviewQuestions.map((q, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border/60 bg-card/40 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-[10px] font-bold text-primary">
                      {idx + 1}
                    </span>
                    <h5 className="text-xs font-semibold text-foreground leading-snug">
                      {q.question}
                    </h5>
                  </div>
                  <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary font-semibold shrink-0">
                    {q.category}
                  </span>
                </div>

                <div className="pl-6">
                  <div className="rounded bg-muted/40 p-2.5 border border-border/40 text-[11px] space-y-0.5">
                    <p className="font-bold text-primary uppercase text-[9px] tracking-wider">Suggested Answer Key</p>
                    <p className="text-foreground/80 leading-relaxed">{q.suggestedAnswer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SECTION 4: SALARY STRATEGY */}
        {activeSection === "salary" && (
          <div className="space-y-2">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
              <h4 className="text-xs font-bold text-emerald-500 flex items-center gap-1.5 uppercase tracking-wider">
                <DollarSign className="h-4 w-4 text-emerald-500" /> Negotiation Playbook
              </h4>
              <p className="text-xs leading-relaxed text-emerald-500/95 font-medium">
                {intel.salaryNegotiationStrategy}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
