import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, Button, Switch, Label, Input, Textarea } from "@/components";
import { STORAGE_KEYS } from "@/config/constants";
import { BriefcaseIcon, SparklesIcon, CopyIcon, CheckIcon, MessageCircleQuestionIcon, FileTextIcon, UsersIcon } from "lucide-react";
import { getStoredCompanyPrep, prepareCompanyPrep, CompanyPrepData } from "@/lib/functions";

type Tab = "context" | "questions" | "hr";

const HR_QUESTIONS = [
  "Tell me about yourself.",
  "Why are you interested in this role?",
  "Why are you leaving your current position?",
  "What is your greatest strength?",
  "What is your biggest weakness?",
  "Where do you see yourself in 5 years?",
  "Describe a challenging situation and how you handled it.",
  "Tell me about a time you failed and what you learned.",
  "How do you handle conflict with a coworker?",
  "Why should we hire you over other candidates?",
  "What are your salary expectations?",
  "Do you have any questions for us?",
];

export const InterviewContextModal = ({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) => {
  const [activeTab, setActiveTab] = useState<Tab>("context");
  const [isHintMode, setIsHintMode] = useState(false);
  const [targetCompany, setTargetCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [companyPrep, setCompanyPrep] = useState<CompanyPrepData | null>(null);
  const [isPrepping, setIsPrepping] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedHrIdx, setCopiedHrIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      const savedStyle = localStorage.getItem(STORAGE_KEYS.RESPONSE_STYLE);
      setIsHintMode(savedStyle === "hint");
      setTargetCompany(localStorage.getItem(STORAGE_KEYS.TARGET_COMPANY) || "");
      setTargetRole(localStorage.getItem(STORAGE_KEYS.TARGET_ROLE) || "");
      setJobDescription(localStorage.getItem(STORAGE_KEYS.JOB_DESCRIPTION) || "");
      setCompanyPrep(getStoredCompanyPrep());
    }
  }, [open]);

  const handleSave = async () => {
    localStorage.setItem(STORAGE_KEYS.RESPONSE_STYLE, isHintMode ? "hint" : "script");
    if (targetCompany.trim()) {
      localStorage.setItem(STORAGE_KEYS.TARGET_COMPANY, targetCompany.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.TARGET_COMPANY);
    }
    if (targetRole.trim()) {
      localStorage.setItem(STORAGE_KEYS.TARGET_ROLE, targetRole.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.TARGET_ROLE);
    }
    if (jobDescription.trim()) {
      localStorage.setItem(STORAGE_KEYS.JOB_DESCRIPTION, jobDescription.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.JOB_DESCRIPTION);
    }

    const companyUrl = localStorage.getItem(STORAGE_KEYS.COMPANY_URL) || "";
    if (companyUrl.trim()) {
      setIsPrepping(true);
      const prep = await prepareCompanyPrep(companyUrl, { forceRefresh: true }).catch(() => null);
      setCompanyPrep(prep);
      setIsPrepping(false);
    }

    onOpenChange(false);
  };

  const copyQuestion = async (text: string, idx: number, setter: (v: number | null) => void) => {
    await navigator.clipboard.writeText(text);
    setter(idx);
    setTimeout(() => setter(null), 1200);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "context", label: "Context", icon: <FileTextIcon className="w-3.5 h-3.5" /> },
    { id: "questions", label: "Questions to Ask", icon: <MessageCircleQuestionIcon className="w-3.5 h-3.5" /> },
    { id: "hr", label: "HR Questions", icon: <UsersIcon className="w-3.5 h-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-primary" />
            Interview Prep
          </DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex border-b border-border/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* ── Context Tab ── */}
          {activeTab === "context" && (
            <>
              <div className="flex flex-row items-center justify-between rounded-lg border border-border/50 p-4 bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">Hint Mode (Teleprompter)</Label>
                  <p className="text-xs text-muted-foreground">
                    Instead of a full paragraph, the AI will provide 3-5 punchy keywords/metrics to guide your answer naturally.
                  </p>
                </div>
                <Switch checked={isHintMode} onCheckedChange={setIsHintMode} />
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <BriefcaseIcon className="w-4 h-4 text-primary" />
                    Target Company & Role
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    The AI will dynamically inject this context into its brain to tailor answers to the company's core values.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-xs font-semibold">Target Company Name</Label>
                  <Input
                    id="companyName"
                    placeholder="e.g. Amazon, Google, Microsoft"
                    value={targetCompany}
                    onChange={(e) => setTargetCompany(e.target.value)}
                    className="bg-muted/30"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="roleTitle" className="text-xs font-semibold">Target Role Title</Label>
                  <Input
                    id="roleTitle"
                    placeholder="e.g. Principal Cloud Architect"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="bg-muted/30"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobDescription" className="text-xs font-semibold">Job Description / Core Values</Label>
                  <Textarea
                    id="jobDescription"
                    placeholder="Paste the job description or the company's core values here (e.g. 'Customer Obsession', 'Bias for Action')..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="h-32 bg-muted/30 resize-none text-xs"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── Questions to Ask Tab ── */}
          {activeTab === "questions" && (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <MessageCircleQuestionIcon className="w-4 h-4 text-primary" />
                  Questions to Ask the Interviewer
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Role-specific questions generated from your company, role, and job description. Click the copy icon to grab one.
                </p>
              </div>

              {companyPrep && companyPrep.shortQuestions.length > 0 ? (
                <>
                  {companyPrep.companyName && (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                      Tailored for {companyPrep.companyName}{companyPrep.roleTitle ? ` — ${companyPrep.roleTitle}` : ""}
                    </p>
                  )}
                  <div className="space-y-2">
                    {companyPrep.shortQuestions.map((q: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 group rounded-md p-2 hover:bg-muted/30 transition-colors">
                        <p className="text-xs text-foreground leading-snug flex-1">
                          {idx + 1}. {q}
                        </p>
                        <button
                          type="button"
                          className="shrink-0 mt-0.5 p-1 rounded hover:bg-muted transition-colors"
                          onClick={() => void copyQuestion(q, idx, setCopiedIdx)}
                          title="Copy question"
                        >
                          {copiedIdx === idx ? <CheckIcon className="h-3.5 w-3.5 text-green-500" /> : <CopyIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-8 text-muted-foreground/50 space-y-2">
                  <BriefcaseIcon className="h-8 w-8" />
                  <p className="text-xs">No questions generated yet.</p>
                  <p className="text-[11px]">Go to the <strong>Context</strong> tab, fill in company/role details, and save to generate role-specific questions.</p>
                </div>
              )}
            </div>
          )}

          {/* ── HR Questions Tab ── */}
          {activeTab === "hr" && (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-primary" />
                  Common HR & Behavioral Questions
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Standard questions frequently asked by HR recruiters and hiring managers. Copy any to prepare your answer.
                </p>
              </div>

              <div className="space-y-2">
                {HR_QUESTIONS.map((q, idx) => (
                  <div key={idx} className="flex items-start gap-2 group rounded-md p-2 hover:bg-muted/30 transition-colors">
                    <p className="text-xs text-foreground leading-snug flex-1">
                      {idx + 1}. {q}
                    </p>
                    <button
                      type="button"
                      className="shrink-0 mt-0.5 p-1 rounded hover:bg-muted transition-colors"
                      onClick={() => void copyQuestion(q, idx, setCopiedHrIdx)}
                      title="Copy question"
                    >
                      {copiedHrIdx === idx ? <CheckIcon className="h-3.5 w-3.5 text-green-500" /> : <CopyIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={() => void handleSave()} disabled={isPrepping}>
            {isPrepping ? "Preparing..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
