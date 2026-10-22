import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
} from "@/components";
import {
  SparklesIcon,
  BotIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  ClipboardPasteIcon,
  KeyIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useApp } from "@/contexts";
import {
  getPersistedProviderKey,
  persistProviderKey,
} from "@/lib/storage/provider-keys";

interface QuickAiSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ModelOption {
  id: string;
  name: string;
  tag?: string;
  description: string;
}

const GEMINI_MODELS: ModelOption[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    tag: "Recommended",
    description: "Latest flagship multimodal model — fast, intelligent, low latency",
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    tag: "Reasoning",
    description: "Hybrid reasoning and real-time coding assistance",
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    tag: "Multimodal",
    description: "Reliable, high throughput multimodal model",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    tag: "Fast",
    description: "High speed, lightweight responses",
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    tag: "Ultra-Fast",
    description: "Lowest latency and highest throughput",
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro (Preview)",
    tag: "Deep Reasoning",
    description: "Deep reasoning for complex algorithms and architectures",
  },
  {
    id: "gemini-3.5-transcribe",
    name: "Gemini 3.5 Transcribe",
    tag: "STT",
    description: "Specialized model for speech-to-text audio processing",
  },
];

const OPENAI_MODELS: ModelOption[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    tag: "Recommended",
    description: "High intelligence flagship multimodal model for complex queries",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    tag: "Fast & Efficient",
    description: "Lightweight, cost-effective model for instant answers",
  },
];

export const QuickAiSettingsModal = ({
  open,
  onOpenChange,
}: QuickAiSettingsModalProps) => {
  const {
    selectedAIProvider,
    onSetSelectedAIProvider,
    selectedSttProvider,
    onSetSelectedSttProvider,
  } = useApp();

  const [activeTab, setActiveTab] = useState<"gemini" | "openai">(() => {
    return selectedAIProvider?.provider === "openai" ? "openai" : "gemini";
  });

  // Gemini state
  const [geminiModel, setGeminiModel] = useState<string>("gemini-3.8-flash");
  const [geminiKey, setGeminiKey] = useState<string>("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [syncGeminiStt, setSyncGeminiStt] = useState(true);

  // OpenAI state
  const [openaiModel, setOpenaiModel] = useState<string>("gpt-4o");
  const [openaiKey, setOpenaiKey] = useState<string>("");
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  // Status feedback
  const [feedback, setFeedback] = useState<string | null>(null);

  // Sync state whenever modal opens or active provider changes
  useEffect(() => {
    if (open) {
      const currentProvider = selectedAIProvider?.provider;
      if (currentProvider === "openai") {
        setActiveTab("openai");
      } else if (currentProvider === "gemini") {
        setActiveTab("gemini");
      }

      // Load Gemini values
      const storedGeminiKey =
        getPersistedProviderKey("gemini") ||
        (selectedAIProvider?.provider === "gemini"
          ? selectedAIProvider.variables?.API_KEY ||
            selectedAIProvider.variables?.api_key ||
            ""
          : "");
      setGeminiKey(storedGeminiKey);

      const activeGeminiModel =
        selectedAIProvider?.provider === "gemini"
          ? selectedAIProvider.variables?.MODEL ||
            selectedAIProvider.variables?.model ||
            "gemini-3.8-flash"
          : "gemini-3.8-flash";
      setGeminiModel(activeGeminiModel);

      // Load OpenAI values
      const storedOpenaiKey =
        getPersistedProviderKey("openai") ||
        (selectedAIProvider?.provider === "openai"
          ? selectedAIProvider.variables?.API_KEY ||
            selectedAIProvider.variables?.api_key ||
            ""
          : "");
      setOpenaiKey(storedOpenaiKey);

      const activeOpenaiModel =
        selectedAIProvider?.provider === "openai"
          ? selectedAIProvider.variables?.MODEL ||
            selectedAIProvider.variables?.model ||
            "gpt-4o"
          : "gpt-4o";
      setOpenaiModel(activeOpenaiModel);

      setFeedback(null);
    }
  }, [open, selectedAIProvider]);

  const handlePaste = async (target: "gemini" | "openai") => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (target === "gemini") {
          setGeminiKey(text.trim());
        } else {
          setOpenaiKey(text.trim());
        }
      }
    } catch (e) {
      console.warn("Clipboard paste failed:", e);
    }
  };

  const handleApplySettings = (targetProvider: "gemini" | "openai") => {
    // 1. Save keys to persistent store
    if (geminiKey.trim()) {
      persistProviderKey("gemini", geminiKey.trim());
      if (syncGeminiStt) {
        persistProviderKey("gemini-stt", geminiKey.trim());
      }
    }

    if (openaiKey.trim()) {
      persistProviderKey("openai", openaiKey.trim());
    }

    // 2. Activate target provider
    if (targetProvider === "gemini") {
      const keyToUse = geminiKey.trim() || getPersistedProviderKey("gemini");
      onSetSelectedAIProvider({
        provider: "gemini",
        variables: {
          API_KEY: keyToUse,
          api_key: keyToUse,
          model: geminiModel,
          MODEL: geminiModel,
        },
      });

      if (syncGeminiStt && selectedSttProvider?.provider === "gemini-stt") {
        onSetSelectedSttProvider({
          provider: "gemini-stt",
          variables: {
            ...selectedSttProvider.variables,
            API_KEY: keyToUse,
            api_key: keyToUse,
          },
        });
      }

      setFeedback("Google Gemini settings updated & active!");
    } else {
      const keyToUse = openaiKey.trim() || getPersistedProviderKey("openai");
      onSetSelectedAIProvider({
        provider: "openai",
        variables: {
          API_KEY: keyToUse,
          api_key: keyToUse,
          model: openaiModel,
          MODEL: openaiModel,
        },
      });

      setFeedback("OpenAI (GPT) settings updated & active!");
    }

    setTimeout(() => {
      onOpenChange(false);
    }, 900);
  };

  const maskKey = (key: string): string => {
    if (!key) return "Not configured";
    if (key.length <= 8) return "••••••••";
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  const isGeminiActive = selectedAIProvider?.provider === "gemini";
  const isOpenaiActive = selectedAIProvider?.provider === "openai";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full bg-background/95 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-2xl p-0 overflow-hidden z-[99999]">
        {/* Header */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <SlidersHorizontalIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>AI Models &amp; API Keys</span>
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                  Overlay Quick Config
                </span>
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground">
                Switch providers, select models, or configure keys directly on this screen.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Selectors */}
        <div className="px-5 pt-3">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/40">
            <button
              type="button"
              onClick={() => setActiveTab("gemini")}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "gemini"
                  ? "bg-background text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <SparklesIcon className="h-3.5 w-3.5 text-blue-400" />
              <span>Google Gemini</span>
              {isGeminiActive && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-400 font-bold">
                  Active
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("openai")}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "openai"
                  ? "bg-background text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BotIcon className="h-3.5 w-3.5 text-emerald-400" />
              <span>OpenAI (GPT)</span>
              {isOpenaiActive && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                  Active
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="px-5 py-3 space-y-4 max-h-[60vh] overflow-y-auto">
          {activeTab === "gemini" ? (
            <div className="space-y-3.5">
              {/* Gemini Models Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                    Select Gemini Model
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {geminiModel}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {GEMINI_MODELS.map((m) => {
                    const isSelected = geminiModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setGeminiModel(m.id)}
                        className={`text-left p-2 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? "bg-primary/10 border-primary/50 text-foreground shadow-xs font-medium"
                            : "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-foreground">
                              {m.name}
                            </span>
                            {m.tag && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/15 text-primary border border-primary/25 font-medium">
                                {m.tag}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate leading-relaxed">
                            {m.description}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <CheckIcon className="h-2.5 w-2.5 text-primary-foreground stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gemini API Key */}
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                    <KeyIcon className="h-3 w-3 text-primary" />
                    <span>Gemini API Key</span>
                  </label>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                      geminiKey.trim()
                        ? "bg-green-500/15 text-green-400 border border-green-500/30"
                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {geminiKey.trim() ? maskKey(geminiKey) : "Missing Key"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Input
                      type={showGeminiKey ? "text" : "password"}
                      placeholder="AIzaSy..."
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="h-8 text-xs font-mono pr-8 bg-muted/40 border-border/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      title={showGeminiKey ? "Hide API key" : "Show API key"}
                    >
                      {showGeminiKey ? (
                        <EyeOffIcon className="h-3.5 w-3.5" />
                      ) : (
                        <EyeIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePaste("gemini")}
                    className="h-8 px-2 text-xs gap-1 border-border/60 hover:bg-muted cursor-pointer shrink-0"
                    title="Paste from clipboard"
                  >
                    <ClipboardPasteIcon className="h-3.5 w-3.5" />
                    <span>Paste</span>
                  </Button>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="checkbox"
                    id="sync-gemini-stt"
                    checked={syncGeminiStt}
                    onChange={(e) => setSyncGeminiStt(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                  />
                  <label
                    htmlFor="sync-gemini-stt"
                    className="text-[10px] text-muted-foreground cursor-pointer select-none"
                  >
                    Also use this API key for Gemini STT (Live Audio Transcription)
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* OpenAI Models Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                    Select OpenAI Model
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {openaiModel}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {OPENAI_MODELS.map((m) => {
                    const isSelected = openaiModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setOpenaiModel(m.id)}
                        className={`text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? "bg-primary/10 border-primary/50 text-foreground shadow-xs font-medium"
                            : "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-foreground">
                              {m.name}
                            </span>
                            {m.tag && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">
                                {m.tag}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate leading-relaxed">
                            {m.description}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <CheckIcon className="h-2.5 w-2.5 text-primary-foreground stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* OpenAI API Key */}
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                    <KeyIcon className="h-3 w-3 text-primary" />
                    <span>OpenAI API Key</span>
                  </label>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                      openaiKey.trim()
                        ? "bg-green-500/15 text-green-400 border border-green-500/30"
                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {openaiKey.trim() ? maskKey(openaiKey) : "Missing Key"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Input
                      type={showOpenaiKey ? "text" : "password"}
                      placeholder="sk-proj-..."
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      className="h-8 text-xs font-mono pr-8 bg-muted/40 border-border/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      title={showOpenaiKey ? "Hide API key" : "Show API key"}
                    >
                      {showOpenaiKey ? (
                        <EyeOffIcon className="h-3.5 w-3.5" />
                      ) : (
                        <EyeIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePaste("openai")}
                    className="h-8 px-2 text-xs gap-1 border-border/60 hover:bg-muted cursor-pointer shrink-0"
                    title="Paste from clipboard"
                  >
                    <ClipboardPasteIcon className="h-3.5 w-3.5" />
                    <span>Paste</span>
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground pt-0.5">
                  Keys are stored locally in your encrypted app storage and never shared.
                </p>
              </div>
            </div>
          )}

          {feedback && (
            <div className="p-2 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs flex items-center gap-1.5 animate-in fade-in">
              <ShieldCheckIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-border/40 bg-muted/20 flex sm:justify-between items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8 cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleApplySettings(activeTab)}
            className="text-xs h-8 px-4 font-semibold gap-1.5 shadow-sm cursor-pointer"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            <span>
              {activeTab === "gemini"
                ? isGeminiActive
                  ? "Save & Apply Gemini"
                  : "Switch to Gemini"
                : isOpenaiActive
                ? "Save & Apply OpenAI"
                : "Switch to OpenAI"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
