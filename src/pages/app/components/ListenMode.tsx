import { useState, useEffect } from "react";
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
  MessageCircleIcon,
  SquareIcon,
  PauseIcon,
  ChevronDownIcon,
  SparklesIcon,
  MicIcon,
  Loader2,
  Trash2Icon,
  FileTextIcon,
  MicOff
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

  // Removed auto-start: user must explicitly click "System Audio" to start capturing.

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
        provider: selectedAIProvider?.provider as any, // the context types should match
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
      // Trigger prompt router / AI response for the follow-up query
      console.log("Follow up selected:", label);
    } catch (e) {
      console.error("Failed follow up:", e);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden p-4">
      {/* Profiles / Settings / Control Header (Fixed & Locked) */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-border/50 gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <Select value={activeProfile} onValueChange={setActiveProfile}>
            <SelectTrigger className="w-[180px] h-8 text-xs bg-muted border-none rounded-full focus:ring-0 shrink-0">
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

          {/* Locked Control Toolbar (Next to Auto Dynamic Routing) */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded-full text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
              onClick={handleSummarizeMeeting}
              title="Summarize Meeting"
            >
              <FileTextIcon className="h-4 w-4" />
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
              <Trash2Icon className="h-4 w-4" />
            </Button>

            <Select value={textColor} onValueChange={setTextColor}>
              <SelectTrigger className="h-7 w-[95px] text-[10px] rounded-full border-border/50 focus:ring-0">
                <SelectValue placeholder="Color" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Text Color</SelectLabel>
                  {TEXT_COLORS.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full border border-border/50 ${c.bg}`} />
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
              {capturing ? "Stop Listening" : "System Audio"}
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
                📚 Local Knowledge Used
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

      {/* Main Content Area (Split 50/50 between Question Panel and Answer Panel) */}
      <div className="flex-1 flex flex-col min-h-0 py-2 gap-3 overflow-hidden">
        {/* Transcript / Question Panel */}
        <div className="flex-[0.3] flex flex-col min-h-0 border-b border-border/40 pb-2 overflow-hidden">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground tracking-widest py-1 shrink-0">
            <div className="flex items-center gap-2">
              <MicIcon className={`h-3.5 w-3.5 ${capturing ? "text-green-500" : "text-muted-foreground"}`} />
              <span>TRANSCRIPT · QUESTION PANEL</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pt-1 pr-1">
            {isAPIKeyMissing && (
              <div className="flex gap-4 group p-2.5 mb-2 border border-amber-500/20 bg-amber-500/5 rounded-lg text-amber-500">
                <div className="flex-1">
                  <span className="font-semibold text-xs mr-2 block mb-0.5">Offline Mode</span>
                  <p className="inline text-xs leading-relaxed">
                    API Key is missing. System will automatically search your scanned offline documents for answers instead of using cloud AI.
                  </p>
                </div>
              </div>
            )}
            {conversation.messages.filter((msg: any) => msg.role === "user").length > 0 ? (
              [...conversation.messages]
                .filter((msg: any) => msg.role === "user")
                .map((msg: any, index, arr) => {
                  const isLast = index === arr.length - 1;
                  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });
                  return (
                    <div key={msg.id || index} className="flex flex-col">
                      <div className="flex gap-3 group">
                        <span className="text-muted-foreground text-xs font-mono w-14 pt-0.5 shrink-0">
                          {timeStr}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-xs text-foreground mr-2">
                            {isLast ? "Current Question" : `Question ${index + 1}`}
                          </span>
                          <p className="text-foreground inline text-sm leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                      {!isLast && <div className="h-[1px] bg-border/30 my-2" />}
                    </div>
                  );
                })
            ) : lastTranscription ? (
              <div className="flex flex-col">
                <div className="flex gap-3 group">
                  <span className="text-muted-foreground text-xs font-mono w-14 pt-0.5 shrink-0">Now</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-xs text-foreground mr-2">Current Question</span>
                    <p className="text-foreground inline text-sm leading-relaxed">{lastTranscription}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 group opacity-50">
                <span className="text-muted-foreground text-xs font-mono w-14 pt-0.5 shrink-0">00:00</span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-xs text-foreground mr-2">Speaker</span>
                  <p className="text-muted-foreground inline text-sm leading-relaxed">Waiting for transcription...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Suggested Answer Panel */}
        <div className="flex-[0.7] flex flex-col min-h-0 overflow-hidden gap-2">
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-semibold tracking-wider flex items-center gap-2">
              SUGGESTED ANSWER
              {(isAIProcessing || isProcessing) && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </span>
            <div className="flex-1 h-[1px] bg-border/40" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex rounded-full border border-border/50 p-0.5">
                <Button variant="secondary" size="sm" className="h-5 rounded-full px-2.5 text-[10px]">
                  <MessageCircleIcon className="h-3 w-3 mr-1" />
                  Latest
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 text-sm text-foreground leading-relaxed overflow-y-auto pr-1 flex flex-col gap-4">
            {isAPIKeyMissing && conversation.messages.length === 0 && !lastAIResponse && (
              <span className="text-amber-500 font-semibold text-xs opacity-80 mb-2 block">Searching in Offline Documents only.</span>
            )}
            {conversation.messages.filter((msg: any) => msg.role === "assistant").map((msg: any, index: number) => (
              <div key={msg.id || index} className="pb-3 border-b border-border/10 last:border-0 last:pb-0" style={{ color: textColor !== 'inherit' ? textColor : undefined }}>
                <Markdown>{msg.content}</Markdown>
              </div>
            ))}
            {isAIProcessing && lastAIResponse && (
              <div className="pb-3 border-b border-border/10 last:border-0 last:pb-0" style={{ color: textColor !== 'inherit' ? textColor : undefined }}>
                <Markdown isStreaming={isAIProcessing}>{lastAIResponse}</Markdown>
              </div>
            )}
            {(!isAIProcessing && !lastAIResponse && conversation.messages.filter((msg: any) => msg.role === "assistant").length === 0) && (
              <span className="text-muted-foreground opacity-50 text-xs">AI will suggest answers here based on the transcript...</span>
            )}
          </div>

          <div className="shrink-0">
            <FollowUpPills items={FOLLOW_UPS} onSelect={handleFollowUpSelect} />
          </div>
        </div>
      </div>

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

        <ActionToolbar 
          onCapture={handleCaptureClick}
          onSelection={handleSelectionClick}
          onAttach={handleAttachClick}
          onLibrary={handleLibraryClick}
        />

        {/* Audio Footer */}
        <div className="flex items-center gap-4 mt-2">
          {/* Audio Visualizer Placeholder */}
          <div className="flex-1 h-12 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20 overflow-hidden relative">
             <div className="absolute inset-0 opacity-50 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,var(--tw-gradient-from)_2px,var(--tw-gradient-from)_4px)] from-green-500/50" />
             <div className="w-full flex items-center justify-center gap-0.5 px-4 z-10 h-full py-2">
                {Array.from({ length: 60 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1 bg-green-500 rounded-full transition-all duration-75" 
                    style={{ height: capturing ? `${Math.max(10, Math.random() * (recordingProgress || 100))}%` : '10%' }} 
                  />
                ))}
             </div>
          </div>

          <Button variant="outline" className="rounded-full border-border/50 bg-background/50 flex items-center gap-2">
            <SparklesIcon className="h-4 w-4" />
            Auto responses · On questions
            <ChevronDownIcon className="h-4 w-4" />
          </Button>

          <Button 
            variant="outline" 
            className={`rounded-full border-border/50 bg-background/50 w-24 cursor-pointer ${isPaused ? "bg-amber-500/20 text-amber-500 border-amber-500/30" : ""}`}
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
            <PauseIcon className="h-4 w-4 mr-2" />
            {isPaused ? "Resume" : "Pause"}
          </Button>

          <Button 
            variant="destructive" 
            className="rounded-full w-24 bg-red-950/50 text-red-500 border border-red-500/20 hover:bg-red-950 cursor-pointer"
            onClick={() => {
              stopCapture();
              setIsPaused(false);
            }}
          >
            <SquareIcon className="h-4 w-4 mr-2 fill-current" />
            Stop
          </Button>
        </div>
      </div>
  );
};
