import { useState, useEffect, useRef } from "react";
import { 
  Button, Markdown, 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose 
} from "@/components";
import { FollowUpPills } from "./FollowUpPills";
import { ActionToolbar } from "./ActionToolbar";
import { useApp as useAppHook } from "@/hooks";
import { useApp as useGlobalApp } from "@/contexts";
import { fetchAIResponse } from "@/lib/functions";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  SquareIcon,
  PauseIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SparklesIcon,
  MicIcon,
  Loader2,
  Trash2Icon,
  FileTextIcon,
  MicOff,
  CopyIcon,
  CheckIcon,
  Maximize2Icon,
  Minimize2Icon,
  HistoryIcon,
  TypeIcon
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel
} from "@/components/ui/select";
import { getAllPrompts } from "@/lib/platform-instructions";
import { PERSONAS } from "@/config/constants";
import { getAllPersistedProviderKeys, getPersistedProviderKey } from "@/lib/storage/provider-keys";

const FOLLOW_UPS: { label: string; icon?: "arrow" | "sparkles" }[] = [
  { label: "Fact Check", icon: "arrow" },
  { label: "Draft Reply", icon: "arrow" },
  { label: "Quote the annual rate", icon: "sparkles" },
  { label: "Summarize the value points", icon: "sparkles" },
  { label: "Draft the follow-up email", icon: "sparkles" },
];

export const ListenMode = () => {
  const [activeProfile, setActiveProfile] = useState<string>("auto");
  const [templates, setTemplates] = useState(getAllPrompts());
  const [textColor, setTextColor] = useState<string>("inherit");
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("base");
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const answerScrollRef = useRef<HTMLDivElement>(null);

  const TEXT_COLORS = [
    { label: "Default", value: "inherit", bg: "bg-foreground" },
    { label: "White", value: "#ffffff", bg: "bg-white" },
    { label: "Black", value: "#000000", bg: "bg-black" },
    { label: "Green", value: "#4ade80", bg: "bg-green-400" },
    { label: "Yellow", value: "#facc15", bg: "bg-yellow-400" },
  ];

  useEffect(() => {
    const handlePromptsUpdated = () => setTemplates(getAllPrompts());
    window.addEventListener("nexus_prompts_updated", handlePromptsUpdated);
    
    let unlisten: () => void;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("nexus_prompts_updated", handlePromptsUpdated).then(fn => {
        unlisten = fn;
      });
    });

    return () => {
      window.removeEventListener("nexus_prompts_updated", handlePromptsUpdated);
      if (unlisten) unlisten();
    };
  }, []);

  const { systemAudio } = useAppHook();
  const {
    capturing,
    isProcessing,
    isAIProcessing,
    lastTranscription,
    lastAIResponse,
    startCapture,
    stopCapture,
    recordingProgress,
    conversation,
    clearConversation,
    activePersonaName,
    usedLocalKnowledge,
    scanDocuments,
    isTestMicEnabled,
    setIsTestMicEnabled
  } = systemAudio;
  const { selectedAIProvider, selectedSttProvider } = useGlobalApp();

  const bank = getAllPersistedProviderKeys();
  const isAuto = selectedAIProvider?.provider === "auto";
  const hasAutoKey = isAuto && !!(
    selectedAIProvider?.variables?.GROQ_KEY || 
    selectedAIProvider?.variables?.GEMINI_KEY || 
    selectedAIProvider?.variables?.OPENAI_KEY ||
    bank["groq"] ||
    bank["gemini"] ||
    bank["openai"]
  );
  const currentAiKey = 
    selectedAIProvider?.variables?.api_key || 
    selectedAIProvider?.variables?.API_KEY || 
    selectedAIProvider?.variables?.apiKey ||
    getPersistedProviderKey(selectedAIProvider?.provider);
  const hasNormalKey = !isAuto && !!currentAiKey;
  const hasAiKey = hasAutoKey || hasNormalKey || selectedAIProvider?.provider === "local";

  const sttKey = 
    selectedSttProvider?.variables?.api_key || 
    selectedSttProvider?.variables?.API_KEY ||
    getPersistedProviderKey(selectedSttProvider?.provider) ||
    getPersistedProviderKey("groq-stt") ||
    bank["groq-stt"];
  const hasSttKey = 
    !!sttKey || 
    selectedSttProvider?.provider === "local" || 
    selectedSttProvider?.provider === "browser" || 
    selectedSttProvider?.provider === "none" ||
    !selectedSttProvider?.provider;

  const isAPIKeyMissing = !hasAiKey || !hasSttKey;

  useEffect(() => {
    // Update system audio context when profile changes
    const selectedTemplate = templates.find(t => t.id === activeProfile);
    const selectedPersona = PERSONAS.find(p => p.id === activeProfile);
    
    if (selectedTemplate) {
      systemAudio.setContextContent(selectedTemplate.prompt);
    } else if (selectedPersona) {
      systemAudio.setContextContent(selectedPersona.systemPrompt);
    } else if (activeProfile === "auto") {
      systemAudio.setContextContent("auto");
    }
  }, [activeProfile]);

  // Smooth line-by-line autoscroll during real-time streaming
  useEffect(() => {
    if (isAIProcessing && answerScrollRef.current) {
      answerScrollRef.current.scrollTop = answerScrollRef.current.scrollHeight;
    }
  }, [lastAIResponse, isAIProcessing]);

  const [isPaused, setIsPaused] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);

  const handleSummarizeMeeting = async () => {
    if (!conversation.messages || conversation.messages.length === 0) {
      setSummaryText("No meeting transcript found to summarize.");
      setShowSummaryModal(true);
      return;
    }

    setIsSummarizing(true);
    setShowSummaryModal(true);
    setSummaryText("Generating meeting minutes...");

    try {
      const messagesContent = conversation.messages
        .slice().reverse()
        .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
        .join("\n\n");

      const prompt = `You are an expert AI executive assistant. Please read the following transcript of a meeting and provide a well-structured summary. Focus on:
1. Key Discussions and Decisions
2. Action Items (who needs to do what)
3. Any other notable highlights

Please format this as a clean Markdown document.

Meeting Transcript:
${messagesContent}`;

      setSummaryText("");
      const aiResponseStream = fetchAIResponse({
        provider: selectedAIProvider?.provider as any,
        selectedProvider: selectedAIProvider as any,
        userMessage: prompt,
        systemPrompt: "You are an expert meeting assistant.",
      });
      
      let fullResponse = "";
      for await (const chunk of aiResponseStream) {
        fullResponse += chunk;
        setSummaryText(fullResponse);
      }
    } catch (e) {
      console.error("Failed to generate summary:", e);
      setSummaryText("Failed to generate summary. Please check your AI API key and connection.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleLibraryClick = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select Folder to Scan (PDFs/Resumes Supported)",
      });
      if (selectedPath) {
        const res = await scanDocuments(selectedPath as string);
        alert(res);
      }
    } catch (e: any) {
      alert("Error scanning documents: " + e.toString());
    }
  };

  const handleAttachClick = () => {
    const fileInput = document.getElementById("listen-file-upload");
    if (fileInput) fileInput.click();
  };

  const handleCaptureClick = async () => {
    try {
      await invoke("start_screen_capture");
    } catch (e) {
      console.error("Failed to capture screen:", e);
    }
  };

  const handleSelectionClick = async () => {
    try {
      await invoke("capture_selected_area");
    } catch (e) {
      console.error("Failed to capture area:", e);
    }
  };

  const handleFollowUpSelect = async (label: string) => {
    try {
      console.log("Follow up selected:", label);
    } catch (e) {
      console.error("Failed follow up:", e);
    }
  };

  const handleCopyLatestAnswer = () => {
    const latestAssistantMsg = conversation.messages.find(m => m.role === "assistant")?.content || lastAIResponse;
    if (latestAssistantMsg) {
      navigator.clipboard.writeText(latestAssistantMsg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Find latest user question
  const userMessages = conversation.messages.filter((msg: any) => msg.role === "user");
  const latestQuestion = userMessages.length > 0 ? userMessages[0].content : lastTranscription;
  const assistantMessages = conversation.messages.filter((msg: any) => msg.role === "assistant");

  // Font size classes
  const fontSizeClass = 
    fontSize === "sm" ? "text-xs leading-relaxed" :
    fontSize === "lg" ? "text-base leading-loose" :
    "text-sm leading-relaxed";

  return (
    <div className="flex flex-col h-full w-full overflow-hidden p-3 gap-2">
      {/* Top Header Toolbar */}
      {!isFocusMode && (
        <div className="flex flex-wrap items-center justify-between pb-2 border-b border-border/40 gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <Select value={activeProfile} onValueChange={setActiveProfile}>
              <SelectTrigger className="w-[170px] h-7 text-xs bg-muted/60 border-border/50 rounded-full focus:ring-0 shrink-0">
                <SelectValue placeholder="Select Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="auto">
                    <div className="flex items-center">
                      <SparklesIcon className="w-3.5 h-3.5 mr-2 text-primary" />
                      Auto (Dynamic Routing)
                    </div>
                  </SelectItem>
                  <SelectLabel className="mt-2">Templates</SelectLabel>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Expert Personas</SelectLabel>
                  {PERSONAS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1 flex-wrap shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 rounded-full text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                onClick={handleSummarizeMeeting}
                title="Summarize Meeting Minutes"
              >
                <FileTextIcon className="h-3.5 w-3.5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 rounded-full text-red-500 hover:text-red-600 hover:bg-red-500/10"
                onClick={() => {
                  if (window.confirm("Are you sure you want to clear the conversation?")) {
                    clearConversation();
                  }
                }}
                title="Clear Conversation"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>

              <Select value={textColor} onValueChange={setTextColor}>
                <SelectTrigger className="h-7 w-[85px] text-[10px] rounded-full border-border/50 focus:ring-0">
                  <SelectValue placeholder="Color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Text Color</SelectLabel>
                    {TEXT_COLORS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full border border-border/50 ${c.bg}`} />
                          {c.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Button 
                variant={capturing ? "default" : "ghost"} 
                size="sm" 
                className={`h-7 rounded-full px-2.5 text-xs ${capturing ? "bg-green-500 hover:bg-green-600 text-white" : "border border-border/50"}`}
                onClick={capturing ? stopCapture : startCapture}
              >
                <div className={`h-2 w-2 rounded-full ${capturing ? "bg-white animate-pulse" : "bg-muted-foreground"} mr-1.5`} />
                {capturing ? "Listening" : "System Audio"}
              </Button>

              <Button
                variant={isTestMicEnabled ? "default" : "outline"}
                size="sm"
                className={`h-7 text-[10px] rounded-full border-border/50 ${isTestMicEnabled ? 'bg-red-500 hover:bg-red-600 text-white' : 'text-muted-foreground'}`}
                onClick={() => setIsTestMicEnabled(!isTestMicEnabled)}
                title="Enable fallback microphone capture (for testing if system audio fails)"
              >
                {isTestMicEnabled ? <MicIcon className="h-3 w-3 mr-1" /> : <MicOff className="h-3 w-3 mr-1" />}
                Mic {isTestMicEnabled ? "ON" : "OFF"}
              </Button>

              {usedLocalKnowledge && (
                <div className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center shadow-sm">
                  📚 Local Knowledge
                </div>
              )}
              {activeProfile === "auto" && activePersonaName && (
                <div className="px-2 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center shadow-sm">
                  <SparklesIcon className="w-3 h-3 mr-1" />
                  {activePersonaName}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap shrink-0">
            <div className={`h-2 w-2 rounded-full ${capturing ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
            {capturing ? "listening" : "standby"}
          </div>
        </div>
      )}

      {/* Live Question Bar (Compact, Instant Zero-Latency Display) */}
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/40 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 shrink-0">
            <MicIcon className={`h-3.5 w-3.5 ${capturing ? "text-green-500 animate-pulse" : "text-muted-foreground"}`} />
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Question:
            </span>
          </div>
          <p className="text-xs font-medium text-foreground truncate select-text">
            {latestQuestion ? (
              latestQuestion
            ) : isProcessing ? (
              <span className="text-primary animate-pulse">Transcribing speech...</span>
            ) : (
              <span className="text-muted-foreground/60 italic">Waiting for speech / interviewer question...</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {userMessages.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setShowHistory(!showHistory)}
              title="Toggle previous questions history"
            >
              <HistoryIcon className="h-3 w-3 mr-1" />
              History ({userMessages.length})
              {showHistory ? <ChevronUpIcon className="h-3 w-3 ml-0.5" /> : <ChevronDownIcon className="h-3 w-3 ml-0.5" />}
            </Button>
          )}

          {isAIProcessing && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium border border-primary/20 animate-pulse">
              <SparklesIcon className="h-3 w-3" />
              Answering...
            </div>
          )}
        </div>
      </div>

      {/* Expanded History Drawer (if opened) */}
      {showHistory && (
        <div className="max-h-36 overflow-y-auto p-2.5 rounded-lg bg-background/80 border border-border/50 text-xs space-y-2 shrink-0 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center justify-between pb-1 border-b border-border/30 text-[10px] font-semibold text-muted-foreground uppercase">
            <span>Question History</span>
            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => setShowHistory(false)}>Close</Button>
          </div>
          {userMessages.map((msg: any, idx: number) => (
            <div key={msg.id || idx} className="flex gap-2 text-xs py-1 border-b border-border/10 last:border-0">
              <span className="text-muted-foreground font-mono text-[10px] w-12 shrink-0">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <p className="text-foreground/90 leading-snug">{msg.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Offline Mode Alert */}
      {isAPIKeyMissing && (
        <div className="flex items-center gap-2 px-3 py-1.5 border border-amber-500/20 bg-amber-500/5 rounded-lg text-amber-500 text-xs shrink-0">
          <span className="font-semibold">Offline Mode:</span>
          <span>Searching local scanned documents only. Configure API keys in Settings &rarr; AI Providers for full cloud brain.</span>
        </div>
      )}

      {/* Main Suggested Answer Panel (Vast, Primary Reading View) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-xl border border-border/50 bg-background/50 p-3 gap-2">
        {/* Panel Header with Space, Font Size, and Copy Controls */}
        <div className="flex items-center justify-between pb-2 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider flex items-center gap-1.5 text-foreground">
              SUGGESTED ANSWER
              {isAIProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Font Size Selector */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setFontSize(prev => prev === "sm" ? "base" : prev === "base" ? "lg" : "sm")}
              title="Cycle Font Size (Small, Normal, Large)"
            >
              <TypeIcon className="h-3 w-3 mr-1" />
              {fontSize.toUpperCase()}
            </Button>

            {/* Quick Copy Answer */}
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-[10px] rounded-full ${copied ? "text-green-500 bg-green-500/10" : "text-muted-foreground hover:text-foreground"}`}
              onClick={handleCopyLatestAnswer}
              title="Copy Suggested Answer to Clipboard"
            >
              {copied ? <CheckIcon className="h-3 w-3 mr-1 text-green-500" /> : <CopyIcon className="h-3 w-3 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>

            {/* Focus / Maximize Reading View */}
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-[10px] rounded-full ${isFocusMode ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setIsFocusMode(!isFocusMode)}
              title={isFocusMode ? "Exit Full Space View" : "Maximize Reading Space"}
            >
              {isFocusMode ? <Minimize2Icon className="h-3 w-3 mr-1" /> : <Maximize2Icon className="h-3 w-3 mr-1" />}
              {isFocusMode ? "Standard View" : "Max Space"}
            </Button>
          </div>
        </div>

        {/* Real-time Line-by-Line Streaming Answer Container */}
        <div 
          ref={answerScrollRef}
          className={`flex-1 overflow-y-auto pr-1 flex flex-col gap-4 ${fontSizeClass}`}
          style={{ color: textColor !== 'inherit' ? textColor : undefined }}
        >
          {/* Prior Assistant Answers */}
          {assistantMessages.map((msg: any, index: number) => (
            <div key={msg.id || index} className="pb-3 border-b border-border/10 last:border-0 last:pb-0">
              <Markdown>{msg.content}</Markdown>
            </div>
          ))}

          {/* Live Streaming Assistant Answer */}
          {isAIProcessing && lastAIResponse && (
            <div className="pb-3 border-b border-border/10 last:border-0 last:pb-0">
              <Markdown isStreaming={true}>{lastAIResponse}</Markdown>
              <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-1 align-middle" />
            </div>
          )}

          {/* Waiting State */}
          {!isAIProcessing && !lastAIResponse && assistantMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/50 py-12 gap-2">
              <SparklesIcon className="h-8 w-8 opacity-40 animate-pulse" />
              <p className="text-xs">AI will stream line-by-line suggested answers here as speech is detected...</p>
            </div>
          )}
        </div>

        {/* Compact Follow-Up Pills */}
        <div className="shrink-0 pt-1 border-t border-border/30">
          <FollowUpPills items={FOLLOW_UPS} onSelect={handleFollowUpSelect} />
        </div>
      </div>

      {/* Summary Dialog */}
      <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b border-border/10 bg-muted/20">
            <DialogTitle>Meeting Minutes</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4 prose prose-sm dark:prose-invert max-w-none">
            {isSummarizing ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p>Generating summary and extracting action items...</p>
              </div>
            ) : (
              <Markdown>{summaryText}</Markdown>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/10 bg-muted/20 sm:justify-between">
            <DialogClose asChild>
              <Button variant="ghost">Close</Button>
            </DialogClose>
            <Button 
              onClick={() => {
                navigator.clipboard.writeText(summaryText);
              }}
              disabled={isSummarizing || !summaryText}
            >
              Copy to Clipboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        
      <input
        type="file"
        id="listen-file-upload"
        multiple
        accept="image/*"
        className="hidden"
        onChange={() => {}}
      />

      {/* Bottom Action Toolbar & Audio Controls */}
      {!isFocusMode && (
        <div className="flex flex-col gap-1.5 shrink-0 pt-1">
          <ActionToolbar 
            onCapture={handleCaptureClick}
            onSelection={handleSelectionClick}
            onAttach={handleAttachClick}
            onLibrary={handleLibraryClick}
          />

          <div className="flex items-center gap-3">
            {/* Audio Wave Visualizer */}
            <div className="flex-1 h-9 bg-green-500/10 rounded-lg flex items-center justify-center border border-green-500/20 overflow-hidden relative">
              <div className="w-full flex items-center justify-center gap-0.5 px-3 z-10 h-full py-1">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1 bg-green-500 rounded-full transition-all duration-75" 
                    style={{ height: capturing ? `${Math.max(15, Math.random() * (recordingProgress || 100))}%` : '15%' }} 
                  />
                ))}
              </div>
            </div>

            <Button 
              variant="outline" 
              size="sm"
              className={`rounded-full border-border/50 bg-background/50 h-8 px-3 cursor-pointer text-xs ${isPaused ? "bg-amber-500/20 text-amber-500 border-amber-500/30" : ""}`}
              onClick={() => {
                if (capturing) {
                  stopCapture();
                  setIsPaused(true);
                } else if (isPaused) {
                  startCapture();
                  setIsPaused(false);
                } else {
                  startCapture();
                }
              }}
            >
              <PauseIcon className="h-3.5 w-3.5 mr-1.5" />
              {isPaused ? "Resume" : "Pause"}
            </Button>

            <Button 
              variant="destructive" 
              size="sm"
              className="rounded-full h-8 px-3 bg-red-950/50 text-red-500 border border-red-500/20 hover:bg-red-950 cursor-pointer text-xs"
              onClick={() => {
                stopCapture();
                setIsPaused(false);
              }}
            >
              <SquareIcon className="h-3 w-3 mr-1.5 fill-current" />
              Stop
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

