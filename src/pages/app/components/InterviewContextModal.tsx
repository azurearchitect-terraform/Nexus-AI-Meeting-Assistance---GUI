import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, Button, Switch, Label, Input, Textarea } from "@/components";
import { STORAGE_KEYS } from "@/config/constants";
import { BriefcaseIcon, SparklesIcon } from "lucide-react";

export const InterviewContextModal = ({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) => {
  const [isHintMode, setIsHintMode] = useState(false);
  const [targetCompany, setTargetCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  useEffect(() => {
    if (open) {
      const savedStyle = localStorage.getItem(STORAGE_KEYS.RESPONSE_STYLE);
      setIsHintMode(savedStyle === "hint");
      setTargetCompany(localStorage.getItem(STORAGE_KEYS.TARGET_COMPANY) || "");
      setJobDescription(localStorage.getItem(STORAGE_KEYS.JOB_DESCRIPTION) || "");
    }
  }, [open]);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEYS.RESPONSE_STYLE, isHintMode ? "hint" : "script");
    if (targetCompany.trim()) {
      localStorage.setItem(STORAGE_KEYS.TARGET_COMPANY, targetCompany.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.TARGET_COMPANY);
    }
    if (jobDescription.trim()) {
      localStorage.setItem(STORAGE_KEYS.JOB_DESCRIPTION, jobDescription.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.JOB_DESCRIPTION);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-primary" />
            Advanced Interview Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
          {/* Hint Mode Toggle */}
          <div className="flex flex-row items-center justify-between rounded-lg border border-border/50 p-4 bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">Hint Mode (Teleprompter)</Label>
              <p className="text-xs text-muted-foreground">
                Instead of a full paragraph, the AI will provide 3-5 punchy keywords/metrics to guide your answer naturally.
              </p>
            </div>
            <Switch
              checked={isHintMode}
              onCheckedChange={setIsHintMode}
            />
          </div>

          {/* Company Context */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <BriefcaseIcon className="w-4 h-4 text-primary" />
                Target Company & Role Context
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
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
