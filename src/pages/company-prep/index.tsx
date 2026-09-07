import React, { useState, useEffect } from "react";
import { PageLayout } from "@/layouts";
import {
  Briefcase,
  Loader2,
  AlertCircle,
  Check,
  Send,
  Globe,
  FileText,
  Code2,
  Heart,
  MessageCircleQuestion,
  Trash2,
  Sparkles,
  DollarSign,
  ShieldAlert,
  Star,
} from "lucide-react";
import {
  CompanyIntel,
  IntelQuestion,
  InterviewRound,
  getLatestCompanyIntel,
  saveLatestCompanyIntel,
  analyzeCompanySite,
  EVENT_COMPANY_INTEL_UPDATED,
} from "@/lib";
import { useApp } from "@/contexts";

const ROUND_LABELS: Record<InterviewRound, string> = {
  recruiter: "Recruiter / HR Screen",
  "hiring-manager": "Hiring Manager",
  technical: "Technical Panel",
  executive: "Executive / Final Round",
};

const ROUND_ORDER: InterviewRound[] = [
  "recruiter",
  "hiring-manager",
  "technical",
  "executive",
];

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        {icon} {label}
      </h4>
      {value?.trim() ? (
        <p className="text-sm leading-relaxed text-foreground bg-muted/30 p-3.5 rounded-xl border border-border/50">
          {value}
        </p>
      ) : (
        <p className="text-xs italic text-muted-foreground/60 bg-muted/20 p-3.5 rounded-xl border border-dashed border-border/40">
          Not found on their site — we won't guess. Paste details into the JD box to fill this in.
        </p>
      )}
    </div>
  );
}

function QuestionCard({
  q,
  index,
  accent,
}: {
  q: IntelQuestion;
  index: number;
  accent: "default" | "purple";
}) {
  const isTop = q.priority === 1;
  const ring =
    accent === "purple"
      ? "border-purple-500/20 bg-purple-500/[0.02]"
      : "border-border bg-card/50";

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 transition-colors ${
        isTop ? "border-amber-500/50 bg-amber-500/[0.06]" : ring
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-[11px] font-semibold text-primary">
          {index + 1}
        </span>
        <h5 className="text-sm font-semibold text-foreground leading-snug flex-1">
          {q.question}
        </h5>
        {isTop && (
          <span className="flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500 shrink-0">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> ASK THIS
          </span>
        )}
      </div>

      <div className="pl-7 space-y-2.5">
        <div className="rounded-lg bg-muted/40 p-3 border border-border/40">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
            Why Ask This
          </p>
          <p className="text-xs text-foreground/80 leading-relaxed mt-0.5">
            {q.context}
          </p>
        </div>

        {q.expectedAnswer && (
          <div className="rounded-lg bg-emerald-500/[0.08] p-3 border border-emerald-500/20">
            <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider">
              A Strong Answer Sounds Like
            </p>
            <p className="text-xs text-emerald-500/90 leading-relaxed mt-0.5">
              {q.expectedAnswer}
            </p>
          </div>
        )}

        {q.redFlag && (
          <div className="rounded-lg bg-destructive/[0.08] p-3 border border-destructive/20">
            <p className="text-[10px] text-destructive font-semibold uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Red Flag
            </p>
            <p className="text-xs text-destructive/90 leading-relaxed mt-0.5">
              {q.redFlag}
            </p>
          </div>
        )}

        {q.suggestedPoints && q.suggestedPoints.length > 0 && (
          <div className="rounded-lg bg-muted/40 p-3 border border-border/40">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Follow-Up Threads
            </p>
            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1 mt-1 leading-relaxed">
              {q.suggestedPoints.map((point, pIdx) => (
                <li key={pIdx}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

const CompanyPrep = () => {
  const { selectedAIProvider } = useApp();

  const [url, setUrl] = useState("");
  const [targetRole, setTargetRole] = useState(() => {
    return localStorage.getItem("company_prep_target_role") || "Senior Software Engineer";
  });
  const [experienceYears, setExperienceYears] = useState<number>(() => {
    const val = localStorage.getItem("company_prep_experience_years");
    return val ? Number(val) : 8;
  });
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [intel, setIntel] = useState<CompanyIntel | null>(() => getLatestCompanyIntel());
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      setIntel(e.detail ?? getLatestCompanyIntel());
    };
    window.addEventListener(EVENT_COMPANY_INTEL_UPDATED, handleUpdate);
    return () => window.removeEventListener(EVENT_COMPANY_INTEL_UPDATED, handleUpdate);
  }, []);

  const handleInvestigate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setIntel(null);
    setSavedSuccess(false);

    localStorage.setItem("company_prep_target_role", targetRole);
    localStorage.setItem("company_prep_experience_years", String(experienceYears));

    try {
      const result = await analyzeCompanySite({
        url: url.trim(),
        jdText: jdText.trim() || null,
        profile: {
          targetRole: targetRole.trim(),
          experienceYears,
        },
        provider: selectedAIProvider?.provider as any,
        selectedProvider: selectedAIProvider as any,
        onProgress: (status) => setStatusText(status),
      });

      setIntel(result);
      setStatusText("");
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    saveLatestCompanyIntel(null);
    setIntel(null);
    setUrl("");
    setJdText("");
  };

  return (
    <PageLayout
      title="Company Intelligence & Interview Prep"
      description="Crawl company websites safely to generate grounded company intelligence, tailored answer keys, and round-specific questions."
    >
      <div className="max-w-5xl mx-auto py-6 space-y-8">
        {/* Form Card */}
        <form
          onSubmit={handleInvestigate}
          className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-primary" /> Company Website URL
            </label>
            <input
              type="text"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              placeholder="e.g. stripe.com or https://stripe.com"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                Target Role
              </label>
              <input
                type="text"
                maxLength={120}
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                disabled={loading}
                placeholder="e.g. Senior Backend Engineer"
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                Experience (Years)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={experienceYears}
                onChange={(e) => setExperienceYears(Number(e.target.value))}
                disabled={loading}
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" /> Job Description (Optional)
            </label>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              disabled={loading}
              placeholder="Paste the Job Description or role requirements to align interviewer questions and technical expectations..."
              rows={4}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>{statusText || "Processing..."}</span>
              </div>
            ) : (
              <div />
            )}

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all active:scale-[0.98] shadow-sm"
            >
              <Send className="h-4 w-4" />
              Investigate Website
            </button>
          </div>
        </form>

        {/* Error State */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <h4 className="font-semibold">Investigation Failed</h4>
              <p className="mt-0.5 text-destructive/80 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Success Feedback */}
        {savedSuccess && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-500">
            <Check className="h-5 w-5" />
            <p className="text-sm font-medium">
              Company Profile synthesized and persisted successfully! Available in Dashboard and Overlay.
            </p>
          </div>
        )}

        {/* Results */}
        {intel && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              {/* Header */}
              <div className="border-b border-border bg-muted/20 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-primary">
                    {intel.name ?? "Company (Unidentified)"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Grounded Company Intelligence Profile
                  </p>
                </div>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                  title="Delete this company profile"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Intel Profile
                </button>
              </div>

              {/* Quality Warning */}
              {intel.sourceQuality !== "rich" && (
                <div className="flex items-start gap-2.5 border-b border-amber-500/30 bg-amber-500/10 px-6 py-3.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                  <p className="text-xs text-amber-500 leading-relaxed font-medium">
                    {intel.sourceQuality === "failed"
                      ? "No readable content could be recovered from this site — it may be JavaScript-heavy or blocked automated requests. Company facts were strictly left blank rather than invented. Questions below are grounded in your role and JD."
                      : "Only limited content was recovered. Company fields without direct evidence were left blank. Adding a job description above will strengthen the profile."}
                  </p>
                </div>
              )}

              {/* Company Facts */}
              <div className="p-6 space-y-6">
                <Field
                  icon={<Globe className="h-4 w-4 text-primary" />}
                  label="Core Business & Revenue Drivers"
                  value={intel.coreBusiness}
                />
                <Field
                  icon={<Code2 className="h-4 w-4 text-primary" />}
                  label="Technical Landscape & Culture"
                  value={intel.technicalLandscape}
                />
                <Field
                  icon={<Briefcase className="h-4 w-4 text-primary" />}
                  label="Recent News & Strategic Developments"
                  value={intel.recentNews}
                />
                <Field
                  icon={<Heart className="h-4 w-4 text-primary" />}
                  label="Why It Matters To You"
                  value={intel.whyItMatters}
                />

                {/* Golden Formula Pitch */}
                {intel.goldenFormula && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-2">
                    <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                      The Golden Formula (60-90s Spoken Pitch)
                    </h4>
                    <p className="text-sm leading-relaxed text-amber-500/90 italic">
                      "{intel.goldenFormula}"
                    </p>
                  </div>
                )}

                {/* Tech Stack */}
                {intel.techStack && intel.techStack.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Code2 className="h-4 w-4 text-primary" /> Core Tech Stack &amp; Keywords
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {intel.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="rounded-lg border border-border bg-muted/40 px-2.5 py-1 font-mono text-xs text-foreground font-medium"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Expected Interviewer Questions from JD */}
            {intel.jdInterviewQuestions && intel.jdInterviewQuestions.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="text-base font-bold text-foreground">
                    Expected Interviewer Questions (Role / JD)
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  High-probability questions the interviewers are likely to ask you, along with structured answer keys:
                </p>

                <div className="space-y-3 pt-1">
                  {intel.jdInterviewQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-primary/20 bg-primary/[0.03] p-5 space-y-3 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 flex-1">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-xs font-bold text-primary">
                            {idx + 1}
                          </span>
                          <h5 className="text-sm font-semibold text-foreground leading-snug">
                            {q.question}
                          </h5>
                        </div>
                        <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary font-semibold shrink-0">
                          {q.category}
                        </span>
                      </div>

                      <div className="pl-7">
                        <div className="rounded-lg bg-muted/40 p-3.5 border border-border/40 space-y-1">
                          <p className="text-[10px] text-primary font-bold uppercase tracking-wider">
                            Suggested Answer Key
                          </p>
                          <p className="text-xs text-foreground/80 leading-relaxed">
                            {q.suggestedAnswer}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Salary Negotiation Strategy */}
            {intel.salaryNegotiationStrategy && (
              <div className="space-y-2 pt-2">
                <h4 className="text-sm font-bold text-emerald-500 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-500" /> Salary Negotiation Strategy
                </h4>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                  <p className="text-xs leading-relaxed text-emerald-500/95 font-medium">
                    {intel.salaryNegotiationStrategy}
                  </p>
                </div>
              </div>
            )}

            {/* Candidate Questions Grouped by Round */}
            <div className="space-y-4 pt-2">
              <div>
                <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                  <MessageCircleQuestion className="h-4 w-4 text-primary" />
                  "Do You Have Any Questions For Us?"
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Questions calibrated for {targetRole} ({experienceYears} yrs exp). The amber
                  <span className="mx-1 inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-500">
                    <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> ASK THIS
                  </span>
                  tag marks the highest-priority question to ask first if time is short.
                </p>
              </div>

              {ROUND_ORDER.map((round) => {
                const inRound = [...intel.questions, ...intel.hrQuestions]
                  .filter((q) => q.round === round)
                  .sort((a, b) => a.priority - b.priority);

                if (inRound.length === 0) return null;

                return (
                  <div key={round} className="space-y-3">
                    <div className="flex items-center gap-2 pt-1">
                      <span className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        {ROUND_LABELS[round]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {inRound.length} question{inRound.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {inRound.map((q, idx) => (
                        <QuestionCard
                          key={`${round}-${idx}`}
                          q={q}
                          index={idx}
                          accent={round === "recruiter" ? "purple" : "default"}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default CompanyPrep;
