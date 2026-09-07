import { useState, useEffect, useContext } from "react";
import { listen } from "@tauri-apps/api/event";
import { AppContext } from "@/contexts/app.context";
import { safeLocalStorage } from "@/lib";
import { STORAGE_KEYS } from "@/config";
import {
  Button,
  Label,
  Slider,
  Switch,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectLabel,
  SelectGroup,
  Input,
} from "@/components";
import {
  ChevronDownIcon,
  SettingsIcon,
  WandIcon,
  RotateCcwIcon,
  ChevronUpIcon,
  CopyIcon,
  CheckIcon,
} from "lucide-react";
import { VadConfig } from "@/hooks/useSystemAudio";
import {
  getAllPrompts,
  getPromptTemplateById,
} from "@/lib/platform-instructions";
import {
  CompanyPrepData,
  getStoredCompanyPrep,
  prepareCompanyPrep,
} from "@/lib/functions";
import { cn } from "@/lib/utils";

// Sensitivity presets for simpler UX
const SENSITIVITY_PRESETS = {
  low: {
    sensitivity_rms: 0.015,
    noise_gate_threshold: 0.005,
    label: "Low",
    description: "Only picks up clear, loud speech",
  },
  normal: {
    sensitivity_rms: 0.012,
    noise_gate_threshold: 0.003,
    label: "Normal",
    description: "Balanced for typical conversations",
  },
  high: {
    sensitivity_rms: 0.008,
    noise_gate_threshold: 0.002,
    label: "High",
    description: "Picks up quieter speech",
  },
} as const;

type SensitivityPreset = keyof typeof SENSITIVITY_PRESETS;

interface SettingsPanelProps {
  // VAD Config
  vadConfig: VadConfig;
  onUpdateVadConfig: (config: VadConfig) => void;
  // Context settings
  useSystemPrompt: boolean;
  setUseSystemPrompt: (value: boolean) => void;
  contextContent: string;
  setContextContent: (content: string) => void;
}

export const SettingsPanel = ({
  vadConfig,
  onUpdateVadConfig,
  useSystemPrompt,
  setUseSystemPrompt,
  contextContent,
  setContextContent,
}: SettingsPanelProps) => {
  const appContext = useContext(AppContext);
  const companyUrl = appContext?.companyUrl || "";
  const setCompanyUrl = appContext?.setCompanyUrl || (() => {});

  const [isOpen, setIsOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [templates, setTemplates] = useState(getAllPrompts());
  const [companyPrep, setCompanyPrep] = useState<CompanyPrepData | null>(
    () => getStoredCompanyPrep()
  );
  const [isPreparingCompany, setIsPreparingCompany] = useState(false);
  const [companyPrepError, setCompanyPrepError] = useState("");
  const [targetRole, setTargetRole] = useState(
    safeLocalStorage.getItem(STORAGE_KEYS.TARGET_ROLE) || ""
  );
  const [jobDescription, setJobDescription] = useState(
    safeLocalStorage.getItem(STORAGE_KEYS.JOB_DESCRIPTION) || ""
  );
  const [copiedQuestionIndex, setCopiedQuestionIndex] = useState<number | null>(null);

  useEffect(() => {
    const handlePromptsUpdated = () => setTemplates(getAllPrompts());
    window.addEventListener("nexus_prompts_updated", handlePromptsUpdated);
    
    let unlisten: (() => void) | undefined;
    listen("nexus_prompts_updated", handlePromptsUpdated).then(fn => {
      unlisten = fn;
    });

    return () => {
      window.removeEventListener("nexus_prompts_updated", handlePromptsUpdated);
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    const url = companyUrl.trim();
    if (!url) {
      setCompanyPrep(null);
      setCompanyPrepError("");
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsPreparingCompany(true);
      setCompanyPrepError("");
      try {
        const prep = await prepareCompanyPrep(url);
        if (!isCancelled) {
          setCompanyPrep(prep);
        }
      } catch (error) {
        if (!isCancelled) {
          setCompanyPrepError("Could not prepare company details right now.");
        }
      } finally {
        if (!isCancelled) {
          setIsPreparingCompany(false);
        }
      }
    }, 900);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [companyUrl, targetRole, jobDescription]);

  const handleCopyQuestion = async (question: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(question);
      setCopiedQuestionIndex(idx);
      setTimeout(() => setCopiedQuestionIndex(null), 1400);
    } catch {
      setCompanyPrepError("Could not copy question. Clipboard permission denied.");
    }
  };

  const handleRefreshCompanyPrep = async () => {
    if (!companyUrl.trim()) return;
    setIsPreparingCompany(true);
    setCompanyPrepError("");
    try {
      const prep = await prepareCompanyPrep(companyUrl, { forceRefresh: true });
      setCompanyPrep(prep);
    } catch {
      setCompanyPrepError("Could not refresh company details.");
    } finally {
      setIsPreparingCompany(false);
    }
  };

  // Determine current sensitivity preset based on values
  const getCurrentPreset = (): SensitivityPreset | "custom" => {
    for (const [key, preset] of Object.entries(SENSITIVITY_PRESETS)) {
      if (
        Math.abs(vadConfig.sensitivity_rms - preset.sensitivity_rms) < 0.001 &&
        Math.abs(vadConfig.noise_gate_threshold - preset.noise_gate_threshold) <
          0.001
      ) {
        return key as SensitivityPreset;
      }
    }
    return "custom";
  };

  const currentPreset = getCurrentPreset();

  const handlePresetChange = (preset: SensitivityPreset) => {
    const presetValues = SENSITIVITY_PRESETS[preset];
    onUpdateVadConfig({
      ...vadConfig,
      sensitivity_rms: presetValues.sensitivity_rms,
      noise_gate_threshold: presetValues.noise_gate_threshold,
    });
  };

  const handleTemplateSelection = (templateId: string) => {
    const template = getPromptTemplateById(templateId);
    if (template) {
      setContextContent(template.prompt);
      setSelectedTemplate("");
    }
  };

  const handleResetDefaults = () => {
    const defaultConfig: VadConfig = {
      enabled: vadConfig.enabled, // Keep current mode
      hop_size: 1024,
      sensitivity_rms: 0.012,
      peak_threshold: 0.035,
      silence_chunks: 45,
      min_speech_chunks: 7,
      pre_speech_chunks: 12,
      noise_gate_threshold: 0.003,
      max_recording_duration_secs: 180,
    };
    onUpdateVadConfig(defaultConfig);
  };

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
      {/* Settings Header - Always visible */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Settings</span>
        </div>
        <ChevronDownIcon
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Settings Content */}
      {isOpen && (
        <div className="px-3 pb-3 space-y-4">
          {/* Recording Settings Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Recording
            </h4>

            {/* Sensitivity Presets - Only for VAD mode */}
            {vadConfig.enabled && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Speech Sensitivity
                </Label>
                <div className="flex gap-2">
                  {(
                    Object.entries(SENSITIVITY_PRESETS) as [
                      SensitivityPreset,
                      (typeof SENSITIVITY_PRESETS)[SensitivityPreset]
                    ][]
                  ).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePresetChange(key)}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                        currentPreset === key
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-accent"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {currentPreset === "custom"
                    ? "Custom sensitivity values"
                    : SENSITIVITY_PRESETS[currentPreset as SensitivityPreset]
                        .description}
                </p>
              </div>
            )}

            {/* Max Duration - Only for Manual mode */}
            {!vadConfig.enabled && (
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center justify-between">
                  <span>Max Recording Duration</span>
                  <span className="text-muted-foreground font-normal">
                    {Math.round(vadConfig.max_recording_duration_secs / 60)} min
                  </span>
                </Label>
                <Slider
                  value={[vadConfig.max_recording_duration_secs / 60]}
                  onValueChange={([value]) =>
                    onUpdateVadConfig({
                      ...vadConfig,
                      max_recording_duration_secs: Math.round(value * 60),
                    })
                  }
                  min={1}
                  max={3}
                  step={0.5}
                  className="w-full"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                  Automatically format answers clearly when asked a complex question
                </p>
              </div>
            )}
          </div>

          {/* Company Context */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <Label className="text-xs font-medium">Target Company URL</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  For "Reverse Interview" questions
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 text-[10px]"
                disabled={isPreparingCompany || !companyUrl.trim()}
                onClick={handleRefreshCompanyPrep}
              >
                {isPreparingCompany ? "Preparing..." : "Refresh Prep"}
              </Button>
            </div>
            <Input
              placeholder="https://example.com"
              className="h-7 text-xs bg-muted/30"
              value={companyUrl}
              onChange={(e) => {
                setCompanyUrl(e.target.value);
                safeLocalStorage.setItem(STORAGE_KEYS.COMPANY_URL, e.target.value);
              }}
            />

            <div className="mt-2 grid gap-2">
              <Input
                placeholder="Target role title (e.g. Principal Cloud Architect)"
                className="h-7 text-xs bg-muted/30"
                value={targetRole}
                onChange={(e) => {
                  setTargetRole(e.target.value);
                  safeLocalStorage.setItem(STORAGE_KEYS.TARGET_ROLE, e.target.value);
                }}
              />
              <Textarea
                placeholder="Paste job description or core responsibilities"
                className="min-h-16 resize-none text-xs bg-muted/30"
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  safeLocalStorage.setItem(STORAGE_KEYS.JOB_DESCRIPTION, e.target.value);
                }}
              />
            </div>

            <div className="mt-2 rounded-md border border-border/50 bg-background/40 p-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Auto Company Prep
              </p>

              {companyPrepError && (
                <p className="mt-1 text-[10px] text-red-500">{companyPrepError}</p>
              )}

              {!companyPrepError && isPreparingCompany && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Fetching company details and preparing interviewer questions...
                </p>
              )}

              {!companyPrepError && !isPreparingCompany && companyPrep && (
                <>
                  <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">
                    {companyPrep.summary || "Company details prepared."}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {companyPrep.shortQuestions.slice(0, 5).map((question: string, idx: number) => (
                      <div key={`${question}-${idx}`} className="flex items-start gap-1.5">
                        <p className="text-[10px] text-foreground/90 flex-1 leading-snug">
                          {idx + 1}. {question}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-5 px-1.5"
                          onClick={() => void handleCopyQuestion(question, idx)}
                        >
                          {copiedQuestionIndex === idx ? (
                            <CheckIcon className="w-3 h-3" />
                          ) : (
                            <CopyIcon className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!companyPrepError && !isPreparingCompany && !companyPrep && companyUrl.trim() && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Add a valid URL to generate company prep.
                </p>
              )}
            </div>
          </div>

          {/* Context Section */}
          <div className="space-y-3 pt-3 border-t border-border/50">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              AI Context
            </h4>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-xs font-medium">Use System Prompt</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {useSystemPrompt
                    ? "Using default prompt from settings"
                    : "Using custom context below"}
                </p>
              </div>
              <Switch
                checked={useSystemPrompt}
                onCheckedChange={setUseSystemPrompt}
              />
            </div>

            {/* Custom Context */}
            {!useSystemPrompt && (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <Select
                    value={selectedTemplate}
                    onValueChange={handleTemplateSelection}
                  >
                    <SelectTrigger className="w-auto h-7 text-xs">
                      <WandIcon className="w-3 h-3 mr-1.5" />
                      <SelectValue placeholder="Templates" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="text-xs py-1">
                          Quick-fill a template
                        </SelectLabel>
                        {templates.map((template) => (
                          <SelectItem
                            key={template.id}
                            value={template.id}
                            className="text-xs"
                          >
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="Enter custom system prompt and context..."
                  value={contextContent}
                  onChange={(e) => setContextContent(e.target.value)}
                  className="min-h-24 resize-none text-xs"
                />
              </div>
            )}
          </div>

          {/* Advanced Settings Toggle */}
          <div className="pt-3 border-t border-border/50">
            <button
              type="button"
              className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>Advanced Settings</span>
              {showAdvanced ? (
                <ChevronUpIcon className="w-3 h-3" />
              ) : (
                <ChevronDownIcon className="w-3 h-3" />
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4">
                {/* Reset button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResetDefaults}
                  className="w-full text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                >
                  <RotateCcwIcon className="w-3 h-3 mr-1.5" />
                  Restore VAD Defaults
                </Button>

                {/* VAD-specific advanced settings */}
                {vadConfig.enabled && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium flex items-center justify-between">
                        <span>Speech Sensitivity (Raw)</span>
                        <span className="text-muted-foreground font-normal">
                          {(vadConfig.sensitivity_rms * 1000).toFixed(1)}
                        </span>
                      </Label>
                      <Slider
                        value={[vadConfig.sensitivity_rms * 1000]}
                        onValueChange={([value]) =>
                          onUpdateVadConfig({
                            ...vadConfig,
                            sensitivity_rms: value / 1000,
                          })
                        }
                        min={1}
                        max={20}
                        step={0.5}
                        className="w-full"
                      />
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        <strong>Impact:</strong> Controls how loud you must speak to trigger recording. <br/>
                        <strong>Min (1.0):</strong> Hyper-sensitive. Will trigger on faint whispers or heavy breathing.<br/>
                        <strong>Max (20.0):</strong> Very deaf. Requires shouting directly into the microphone.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium flex items-center justify-between">
                        <span>Silence Duration</span>
                        <span className="text-muted-foreground font-normal">
                          {(
                            (vadConfig.silence_chunks * vadConfig.hop_size) /
                            44100
                          ).toFixed(1)}
                          s
                        </span>
                      </Label>
                      <Slider
                        value={[vadConfig.silence_chunks]}
                        onValueChange={([value]) =>
                          onUpdateVadConfig({
                            ...vadConfig,
                            silence_chunks: Math.round(value),
                          })
                        }
                        min={20}
                        max={180}
                        step={5}
                        className="w-full"
                      />
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        <strong>Impact:</strong> How long the AI waits after you stop speaking before it replies.<br/>
                        <strong>Min (0.4s):</strong> Extremely fast. Will cut you off if you pause for breath.<br/>
                        <strong>Max (4.1s):</strong> Very slow. You will wait a long time for the AI to reply.
                      </p>
                    </div>
                  </>
                )}

                {/* Noise gate - both modes */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center justify-between">
                    <span>Noise Gate</span>
                    <span className="text-muted-foreground font-normal">
                      {(vadConfig.noise_gate_threshold * 1000).toFixed(1)}
                    </span>
                  </Label>
                  <Slider
                    value={[vadConfig.noise_gate_threshold * 1000]}
                    onValueChange={([value]) =>
                      onUpdateVadConfig({
                        ...vadConfig,
                        noise_gate_threshold: value / 1000,
                      })
                    }
                    min={0}
                    max={10}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    <strong>Impact:</strong> Aggressively mutes background noise (fans, hums).<br/>
                    <strong>Min (0.0):</strong> Off. All background noise is fed into the AI.<br/>
                    <strong>Max (10.0):</strong> High gating. May accidentally mute the start of your words.
                  </p>
                </div>
              </div>


            )}
          </div>
        </div>
      )}
    </div>
  );
};
