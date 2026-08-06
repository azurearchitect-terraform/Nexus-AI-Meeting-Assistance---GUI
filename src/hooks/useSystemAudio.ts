import { useEffect, useState, useCallback, useRef } from "react";
import { useWindowResize, useGlobalShortcuts } from ".";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useApp } from "@/contexts";
import { fetchSTT, fetchAIResponse, webSpeechRecognizer, routePrompt, fetchCompanyContext } from "@/lib/functions";
import { searchLocalMemory } from "@/lib/database/rag.action";
import {
  DEFAULT_QUICK_ACTIONS,
  DEFAULT_SYSTEM_PROMPT,
  STORAGE_KEYS,
  MEETING_ASSISTANT_PROMPT,
} from "@/config";
import {
  safeLocalStorage,
  shouldUsePluelyAPI,
  generateConversationTitle,
  saveConversation,
  CONVERSATION_SAVE_DEBOUNCE_MS,
  generateConversationId,
  generateMessageId,
} from "@/lib";
import { Message } from "@/types/completion";

// VAD Configuration interface matching Rust
export interface VadConfig {
  enabled: boolean;
  hop_size: number;
  sensitivity_rms: number;
  peak_threshold: number;
  silence_chunks: number;
  min_speech_chunks: number;
  pre_speech_chunks: number;
  noise_gate_threshold: number;
  max_recording_duration_secs: number;
}

// OPTIMIZED VAD defaults - ultra-fast & highly responsive for continuous listening
const DEFAULT_VAD_CONFIG: VadConfig = {
  enabled: true,
  hop_size: 1024,
  sensitivity_rms: 0.012,
  peak_threshold: 0.035,
  silence_chunks: 45,
  min_speech_chunks: 7,
  pre_speech_chunks: 12,
  noise_gate_threshold: 0.003,
  max_recording_duration_secs: 180,
};

// Chat message interface (reusing from useCompletion)
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export type useSystemAudioType = ReturnType<typeof useSystemAudio>;

function isResumeOrSelfIntroQuery(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();

  const patterns = [
    /tell (me|us) (something )?about your(self| career| background| experience| profile)/i,
    /introduce your(self| background| experience)/i,
    /intro(duction)? of your(self| background)/i,
    /walk (me|us) through your (resume|background|experience|profile|career)/i,
    /give (me|us) (a )?(brief )?(overview|summary|intro) of (yourself|your background|your experience|your career|your resume)/i,
    /describe your(self| background| experience| career| role| profile| journey)/i,
    /who are you/i,
    /what is your background/i,
    /what('s| is) on your resume/i,
    /in your resume/i,
    /from your resume/i,
    /according to your resume/i,
    /your past (work )?experience/i,
    /your work history/i,
    /summarize your resume/i,
    /overview of your resume/i,
    /tell me about your current role/i,
    /tell me about your past role/i,
  ];

  if (patterns.some((re) => re.test(lower))) {
    return true;
  }

  const directPhrases = [
    "tell me about yourself",
    "tell me something about yourself",
    "tell us about yourself",
    "tell us something about yourself",
    "introduce yourself",
    "give me your background",
    "walk me through your resume",
    "walk through your resume",
    "walk me through your background",
    "about yourself",
  ];

  return directPhrases.some((phrase) => lower.includes(phrase));
}

export function useSystemAudio() {
  const { resizeWindow } = useWindowResize();
  const globalShortcuts = useGlobalShortcuts();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [lastTranscription, setLastTranscription] = useState<string>("");
  const [lastAIResponse, setLastAIResponse] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isTestMicEnabled, setIsTestMicEnabled] = useState<boolean>(false);
  const [activePersonaName, setActivePersonaName] = useState<string>("Default Assistant");
  const [usedLocalKnowledge, setUsedLocalKnowledge] = useState<boolean>(false);
  const [setupRequired, setSetupRequired] = useState<boolean>(false);
  const [quickActions, setQuickActions] = useState<string[]>([]);
  const [isManagingQuickActions, setIsManagingQuickActions] =
    useState<boolean>(false);
  const [showQuickActions, setShowQuickActions] = useState<boolean>(true);
  const [vadConfig, setVadConfig] = useState<VadConfig>(DEFAULT_VAD_CONFIG);
  const [recordingProgress, setRecordingProgress] = useState<number>(0); // For continuous mode
  const [isContinuousMode, setIsContinuousMode] = useState<boolean>(false);
  const [isRecordingInContinuousMode, setIsRecordingInContinuousMode] =
    useState<boolean>(false);

  const [conversation, setConversation] = useState<ChatConversation>({
    id: "",
    title: "",
    messages: [],
    createdAt: 0,
    updatedAt: 0,
  });
  const conversationRef = useRef(conversation);
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // Context management states
  const [useSystemPrompt, setUseSystemPrompt] = useState<boolean>(false);
  const [contextContent, setContextContent] = useState<string>(MEETING_ASSISTANT_PROMPT);

  const {
    selectedSttProvider,
    allSttProviders,
    selectedAIProvider,
    allAiProviders,
    systemPrompt,
    selectedAudioDevices,
  } = useApp();
  const abortControllerRef = useRef<AbortController | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speechDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const isAIProcessingRef = useRef<boolean>(false);
  const lastProcessedTranscriptionRef = useRef<string>("");
  type AIRequest = { transcription: string, prompt: string, previousMessages: Message[], imagesBase64?: string[] };
  const requestQueueRef = useRef<AIRequest[]>([]);
  const sessionMemoryRef = useRef<Message[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Refs to avoid stale closures in audio events and callbacks
  const capturingRef = useRef(capturing);
  const vadConfigRef = useRef(vadConfig);
  const vadActiveRef = useRef(false); // tracks whether Rust VAD loop is already alive
  const contextContentRef = useRef(contextContent);
  const systemPromptRef = useRef(systemPrompt);
  const useSystemPromptRef = useRef(useSystemPrompt);
  const selectedSttProviderRef = useRef(selectedSttProvider);
  const allSttProvidersRef = useRef(allSttProviders);
  const selectedAIProviderRef = useRef(selectedAIProvider);

  useEffect(() => {
    capturingRef.current = capturing;
  }, [capturing]);

  useEffect(() => {
    vadConfigRef.current = vadConfig;
  }, [vadConfig]);

  useEffect(() => {
    contextContentRef.current = contextContent;
    systemPromptRef.current = systemPrompt;
    useSystemPromptRef.current = useSystemPrompt;
    selectedSttProviderRef.current = selectedSttProvider;
    allSttProvidersRef.current = allSttProviders;
    selectedAIProviderRef.current = selectedAIProvider;
  }, [contextContent, systemPrompt, useSystemPrompt, selectedSttProvider, allSttProviders, selectedAIProvider]);

  // Load context settings and VAD config from localStorage on mount
  useEffect(() => {
    const savedContext = safeLocalStorage.getItem(
      STORAGE_KEYS.SYSTEM_AUDIO_CONTEXT
    );
    if (savedContext) {
      try {
        const parsed = JSON.parse(savedContext);
        setUseSystemPrompt(parsed.useSystemPrompt ?? false);
        setContextContent(parsed.contextContent ?? MEETING_ASSISTANT_PROMPT);
      } catch (error) {
        console.error("Failed to load system audio context:", error);
      }
    }

    // Load VAD config
    const savedVadConfig = safeLocalStorage.getItem("vad_config");
    if (savedVadConfig) {
      try {
        const parsed = JSON.parse(savedVadConfig);
        setVadConfig(parsed);
      } catch (error) {
        console.error("Failed to load VAD config:", error);
      }
    }
  }, []);

  // Load quick actions from localStorage on mount
  useEffect(() => {
    const savedActions = safeLocalStorage.getItem(
      STORAGE_KEYS.SYSTEM_AUDIO_QUICK_ACTIONS
    );
    if (savedActions) {
      try {
        const parsed = JSON.parse(savedActions);
        setQuickActions(parsed);
      } catch (error) {
        console.error("Failed to load quick actions:", error);
        setQuickActions(DEFAULT_QUICK_ACTIONS);
      }
    } else {
      setQuickActions(DEFAULT_QUICK_ACTIONS);
    }
  }, []);

  // Handle continuous recording progress events AND error events
  useEffect(() => {
    let progressUnlisten: (() => void) | undefined;
    let startUnlisten: (() => void) | undefined;
    let stopUnlisten: (() => void) | undefined;
    let errorUnlisten: (() => void) | undefined;
    let discardedUnlisten: (() => void) | undefined;
    let panicUnlisten: (() => void) | undefined;
    let customShortcutUnlisten: (() => void) | undefined;

    const setupContinuousListeners = async () => {
      try {
        // Progress updates (every second)
        progressUnlisten = await listen("recording-progress", (event) => {
          const seconds = event.payload as number;
          setRecordingProgress(seconds);
        });

        // Recording started
        startUnlisten = await listen("continuous-recording-start", () => {
          setRecordingProgress(0);
          setIsRecordingInContinuousMode(true);
        });

        // Recording stopped
        stopUnlisten = await listen("continuous-recording-stopped", () => {
          setRecordingProgress(0);
          setIsRecordingInContinuousMode(false);
        });

        // Audio encoding errors
        errorUnlisten = await listen("audio-encoding-error", (event) => {
          const errorMsg = event.payload as string;
          console.error("Audio encoding error:", errorMsg);
          setError(`Failed to process audio: ${errorMsg}`);
          setIsProcessing(false);
          setIsAIProcessing(false);
          setIsRecordingInContinuousMode(false);
        });

        // Speech discarded (too short)
        discardedUnlisten = await listen("speech-discarded", (event) => {
          const reason = event.payload as string;
          console.log("Speech discarded:", reason);
          // Don't show error - this is expected behavior
        });

        // VAD still-active signal: Rust loop is running, no JS restart needed
        await listen("vad-still-active", () => {
          vadActiveRef.current = true;
        });

        // When capture truly stops (user clicked stop or task aborted)
        await listen("capture-stopped", () => {
          vadActiveRef.current = false;
        });

        // Panic triggered - instantly clear everything
        panicUnlisten = await listen("panic-triggered", () => {
          console.log("Panic button triggered!");
          setConversation({
            id: generateConversationId(),
            messages: [],
            title: "New Conversation",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          setLastTranscription("");
      lastProcessedTranscriptionRef.current = "";
          setLastAIResponse("");
          setError("");
          setRecordingProgress(0);
          setIsRecordingInContinuousMode(false);
          setIsAIProcessing(false);
          setIsProcessing(false);
        });

        // Custom shortcuts (e.g. bookmarks)
        customShortcutUnlisten = await listen("custom-shortcut-triggered", (event: any) => {
          if (event.payload?.action === "bookmark") {
            const timestamp = Date.now();
            
            // Get the last user message to show what was bookmarked
            setConversation((prev) => {
              const lastUserMessage = prev.messages.find(m => m.role === "user");
              const excerpt = lastUserMessage ? ` (Near: "${lastUserMessage.content.substring(0, 30)}...")` : "";
              
              const bookmarkMessage = {
                id: `bookmark-${timestamp}`,
                role: "system" as const,
                content: `📌 BOOKMARK: Marked at ${new Date(timestamp).toLocaleTimeString()}${excerpt}`,
                timestamp,
              };
              
              return {
                ...prev,
                messages: [bookmarkMessage, ...prev.messages],
                updatedAt: timestamp
              };
            });
          }
        });

        // Screenshot capture finished
        await listen("captured-selection", async (event: any) => {
          const base64Str = event.payload as string;
          if (!base64Str) return;

          const timestamp = Date.now();
          
          setConversation((prev) => {
            const screenshotMessage = {
              id: `screenshot-${timestamp}`,
              role: "user" as const,
              content: "📸 [Screenshot captured and sent to AI]",
              timestamp,
            };
            
            return {
              ...prev,
              messages: [screenshotMessage, ...prev.messages],
              updatedAt: timestamp
            };
          });

          // Fetch the effective system prompt
          const effectiveSystemPrompt = useSystemPromptRef.current
            ? systemPromptRef.current || DEFAULT_SYSTEM_PROMPT
            : contextContentRef.current || DEFAULT_SYSTEM_PROMPT;
            
          const visibleMessages = [...conversationRef.current.messages].reverse();
          const previousMessages = [...sessionMemoryRef.current, ...visibleMessages].map((msg) => {
            return { role: msg.role, content: msg.content };
          });

          // Send to AI for vision analysis
          await processWithAI(
            "Please analyze this screenshot based on the context of the recent conversation.", 
            effectiveSystemPrompt, 
            previousMessages,
            [base64Str]
          );
        });

      } catch (err) {
        console.error("Failed to setup continuous recording listeners:", err);
      }
    };

    setupContinuousListeners();

    return () => {
      if (progressUnlisten) progressUnlisten();
      if (startUnlisten) startUnlisten();
      if (stopUnlisten) stopUnlisten();
      if (errorUnlisten) errorUnlisten();
      if (discardedUnlisten) discardedUnlisten();
      if (panicUnlisten) panicUnlisten();
      if (customShortcutUnlisten) customShortcutUnlisten();
    };
  }, []);

  // Handle single speech detection event (both VAD and continuous modes)
  useEffect(() => {
    let speechUnlisten: (() => void) | undefined;

    const setupEventListener = async () => {
      try {
        speechUnlisten = await listen("speech-detected", async (event) => {
          try {
            if (!capturingRef.current) return;

            const base64Audio = event.payload as string;
            // Convert to blob
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const audioBlob = new Blob([bytes], { type: "audio/wav" });

            const usePluelyAPI = await shouldUsePluelyAPI();
            let effectiveSttProvider = selectedSttProviderRef.current;

            if (!effectiveSttProvider?.provider && !usePluelyAPI) {
              effectiveSttProvider = {
                provider: "gemini-stt",
                // gemini-3.5-flash: stable, supports generateContent + audio
                variables: { model: "gemini-3.5-flash" },
              };
            }

            const providerConfig = allSttProvidersRef.current.find(
              (p) => p.id === effectiveSttProvider.provider
            ) || allSttProvidersRef.current[0];

            setIsProcessing(true);

            // Add timeout wrapper for STT request (30 seconds)
            // Borrow API key from AI provider if STT provider is Gemini and missing key
            if (
              effectiveSttProvider?.provider === "gemini-stt" &&
              (!effectiveSttProvider.variables || (!effectiveSttProvider.variables.API_KEY && !effectiveSttProvider.variables.api_key)) &&
              selectedAIProviderRef.current?.provider?.startsWith("gemini") &&
              (selectedAIProviderRef.current.variables?.API_KEY || selectedAIProviderRef.current.variables?.api_key)
            ) {
              effectiveSttProvider = {
                ...effectiveSttProvider,
                variables: {
                  ...effectiveSttProvider.variables,
                  API_KEY: selectedAIProviderRef.current.variables.API_KEY || selectedAIProviderRef.current.variables.api_key
                }
              };
            }

            const sttPromise = fetchSTT({
              provider: usePluelyAPI ? undefined : providerConfig,
              selectedProvider: effectiveSttProvider,
              audio: audioBlob,
            });

            const timeoutPromise = new Promise<string>((_, reject) => {
              setTimeout(
                () => reject(new Error("Speech transcription timed out (30s)")),
                30000
              );
            });

            try {
              let transcription = "";
              try {
                transcription = await Promise.race([
                  sttPromise,
                  timeoutPromise,
                ]);
              } catch (primaryError) {
                if (effectiveSttProvider?.provider === "gemini-stt" || effectiveSttProvider?.provider === "gemini") {
                  // Fallback cascade: try cheapest confirmed-live models in order
                  const fallbackModels = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash"];
                  let fallbackSuccess = false;
                  for (const fallbackModel of fallbackModels) {
                    try {
                      console.warn(`Primary STT failed, trying fallback: ${fallbackModel}`, primaryError);
                      const fallbackProvider = {
                        ...effectiveSttProvider,
                        variables: { ...effectiveSttProvider.variables, model: fallbackModel }
                      };
                      const fallbackPromise = fetchSTT({
                        provider: usePluelyAPI ? undefined : providerConfig,
                        selectedProvider: fallbackProvider,
                        audio: audioBlob,
                      });
                      transcription = await Promise.race([
                        fallbackPromise,
                        new Promise<string>((_, reject) => setTimeout(() => reject(new Error(`Fallback ${fallbackModel} timed out`)), 25000))
                      ]);
                      fallbackSuccess = true;
                      break; // Stop on first success
                    } catch (fallbackErr) {
                      console.warn(`Fallback ${fallbackModel} also failed:`, fallbackErr);
                    }
                  }
                  if (!fallbackSuccess) throw primaryError;
                } else {
                  throw primaryError;
                }
              }

              if (transcription.trim()) {
                const timestamp = Date.now();
                const userMessage = {
                  id: generateMessageId("user", timestamp),
                  role: "user" as const,
                  content: transcription,
                  timestamp,
                };

                setLastTranscription(transcription);
                setError("");

                // Instantly append user question into conversation for 0ms UI display
                setConversation((prev) => ({
                  ...prev,
                  messages: [userMessage, ...prev.messages],
                  updatedAt: timestamp,
                  title: prev.title || generateConversationTitle(transcription),
                }));

                const effectiveSystemPrompt = useSystemPromptRef.current
                  ? systemPromptRef.current || DEFAULT_SYSTEM_PROMPT
                  : contextContentRef.current || DEFAULT_SYSTEM_PROMPT;

                const visibleMessages = [...conversationRef.current.messages].reverse();
                const previousMessages = [...sessionMemoryRef.current, ...visibleMessages].map((msg) => {
                  return { role: msg.role, content: msg.content };
                });

                await processWithAI(
                  transcription,
                  effectiveSystemPrompt,
                  previousMessages
                );
              } else {
                setError("Received empty transcription");
              }
            } catch (sttError: any) {
              console.error("STT Error:", sttError);
              const errMsg = sttError.message || "Failed to transcribe audio";
              
              if (errMsg.includes("401") || errMsg.includes("Incorrect API key") || errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid")) {
                setError(`API Key Error: Please configure a valid API key for ${effectiveSttProvider?.provider} in Settings > Speech-to-Text.`);
              } else {
                setError(`${errMsg}`);
              }
              
              // Fallback to offline local WebSpeech without killing native audio task
              setIsOfflineMode(true);

              if (webSpeechRecognizer.isSupported()) {
                if (!webSpeechRecognizer.isListening) {
                  webSpeechRecognizer.start((res) => {
                    if (res.transcript && res.transcript.trim()) {
                      setLastTranscription(res.transcript);
                      if (speechDebounceRef.current) clearTimeout(speechDebounceRef.current);
                      
                      speechDebounceRef.current = setTimeout(() => {
                        const prompt = useSystemPromptRef.current
                          ? systemPromptRef.current || DEFAULT_SYSTEM_PROMPT
                          : contextContentRef.current || DEFAULT_SYSTEM_PROMPT;
                        handleNewTranscription(res.transcript, prompt, conversationRef.current.messages);
                      }, res.isFinal ? 100 : 800);
                    }
                  });
                }
              }
            }
          } catch (err) {
            setError("Failed to process speech");
          } finally {
            setIsProcessing(false);
          }
        });
      } catch (err) {
        setError("Failed to setup speech listener");
      }
    };

    setupEventListener();

    return () => {
      if (speechUnlisten) speechUnlisten();
    };
  }, [
    capturing,
    selectedSttProvider,
    allSttProviders,
  ]);

  // Context management functions
  const saveContextSettings = useCallback(
    (usePrompt: boolean, content: string) => {
      try {
        const contextSettings = {
          useSystemPrompt: usePrompt,
          contextContent: content,
        };
        safeLocalStorage.setItem(
          STORAGE_KEYS.SYSTEM_AUDIO_CONTEXT,
          JSON.stringify(contextSettings)
        );
      } catch (error) {
        console.error("Failed to save context settings:", error);
      }
    },
    []
  );

  const updateUseSystemPrompt = useCallback(
    (value: boolean) => {
      setUseSystemPrompt(value);
      saveContextSettings(value, contextContent);
    },
    [contextContent, saveContextSettings]
  );

  const updateContextContent = useCallback(
    (content: string) => {
      setContextContent(content);
      saveContextSettings(useSystemPrompt, content);
    },
    [useSystemPrompt, saveContextSettings]
  );

  // Quick actions management
  const saveQuickActions = useCallback((actions: string[]) => {
    try {
      safeLocalStorage.setItem(
        STORAGE_KEYS.SYSTEM_AUDIO_QUICK_ACTIONS,
        JSON.stringify(actions)
      );
    } catch (error) {
      console.error("Failed to save quick actions:", error);
    }
  }, []);

  const addQuickAction = useCallback(
    (action: string) => {
      if (action && !quickActions.includes(action)) {
        const newActions = [...quickActions, action];
        setQuickActions(newActions);
        saveQuickActions(newActions);
      }
    },
    [quickActions, saveQuickActions]
  );

  const removeQuickAction = useCallback(
    (action: string) => {
      const newActions = quickActions.filter((a) => a !== action);
      setQuickActions(newActions);
      saveQuickActions(newActions);
    },
    [quickActions, saveQuickActions]
  );

  const handleQuickActionClick = async (action: string) => {
    setError("");

    const effectiveSystemPrompt = useSystemPrompt
      ? systemPrompt || DEFAULT_SYSTEM_PROMPT
      : contextContent || DEFAULT_SYSTEM_PROMPT;

    // Include the most recent transcription in conversation history if it exists
    let updatedMessages = [...conversation.messages];

    if (lastTranscription && lastTranscription.trim()) {
      const lastMessage = updatedMessages[updatedMessages.length - 1];
      // Only add if it's not already the last message
      if (!lastMessage || lastMessage.content !== lastTranscription) {
        const timestamp = Date.now();
        const userMessage = {
          id: generateMessageId("user", timestamp),
          role: "user" as const,
          content: lastTranscription,
          timestamp,
        };
        updatedMessages.push(userMessage);

        // Update conversation state with the latest transcription
        setConversation((prev) => ({
          ...prev,
          messages: [userMessage, ...prev.messages],
          updatedAt: timestamp,
          title: prev.title || generateConversationTitle(lastTranscription),
        }));
      }
    }

    const visibleMessages = [...updatedMessages].reverse();
    const previousMessages = [...sessionMemoryRef.current, ...visibleMessages].map((msg) => {
      return { role: msg.role, content: msg.content };
    });

    if (action === "Ask Interviewer") {
      const companyUrl = safeLocalStorage.getItem(STORAGE_KEYS.COMPANY_URL);
      let companyContext = "";
      if (companyUrl) {
        setLastAIResponse("Researching company profile...");
        companyContext = await fetchCompanyContext(companyUrl);
        setLastAIResponse(""); // clear the loading message
      }
      
      const customPrompt = `You are an expert interview coach. Based on the interview transcript so far, and the following information about the company: \n\n[COMPANY CONTEXT START]\n${companyContext ? companyContext : "No company context provided"}\n[COMPANY CONTEXT END]\n\nGenerate 3 insightful, non-financial questions for the candidate to ask the interviewer at the end of the meeting. Focus on technology, culture, and specific project details. Format as a clear, concise bulleted list. Do not include introductory text, just the questions.`;
      
      requestQueueRef.current.push({
        transcription: action,
        prompt: customPrompt,
        previousMessages: previousMessages,
      });
      processQueue();
      return;
    }

    requestQueueRef.current.push({
      transcription: action,
      prompt: effectiveSystemPrompt,
      previousMessages: previousMessages,
    });
    processQueue();
  };

    const startContinuousRecording = useCallback(async () => {
      try {
        setRecordingProgress(0);
        setError("");
  
        let deviceId = null;
        if (isTestMicEnabled) {
          deviceId = selectedAudioDevices.input.id !== "default" ? selectedAudioDevices.input.id : null;
        } else {
          deviceId = selectedAudioDevices.output.id !== "default" ? selectedAudioDevices.output.id : null;
        }
  
        // Start a new continuous recording session
        await invoke<string>("start_system_audio_capture", {
          vadConfig: vadConfig,
          deviceId: deviceId,
          isInput: isTestMicEnabled,
        });
      } catch (err) {
        console.error("Failed to start continuous recording:", err);
        setError(`Failed to start recording: ${err}`);
      }
    }, [vadConfig, selectedAudioDevices.output.id, selectedAudioDevices.input.id, isTestMicEnabled]);

  // Ignore current recording (stop without transcription)
  const ignoreContinuousRecording = useCallback(async () => {
    try {
      if (!isContinuousMode || !isRecordingInContinuousMode) return;

      // Stop the capture without processing
      await invoke<string>("stop_system_audio_capture");

      // Reset states
      setRecordingProgress(0);
      setIsProcessing(false);
      setIsRecordingInContinuousMode(false);
    } catch (err) {
      console.error("Failed to ignore recording:", err);
      setError(`Failed to ignore recording: ${err}`);
    }
  }, [isContinuousMode, isRecordingInContinuousMode]);

  // AI Processing function
  const processWithAI = useCallback(
    async (
      transcription: string,
      prompt: string,
      previousMessages: Message[],
      imagesBase64?: string[]
    ) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        setIsAIProcessing(true);
        setLastAIResponse("");
        setError("");

        let fullResponse = "";

        const usePluelyAPI = await shouldUsePluelyAPI();
        let effectiveAIProvider = selectedAIProvider;



        const provider = allAiProviders.find(
          (p) => p.id === effectiveAIProvider.provider
        );

        const abortSignal = abortControllerRef.current.signal;

        // Silently fall through to local AI if no provider is configured
        try {
          // Dynamic prompt routing based on user transcript if auto is selected
          let finalSystemPrompt = prompt;
          if (prompt === "auto") {
            const routeResult = await routePrompt(transcription, effectiveAIProvider);
            finalSystemPrompt = routeResult.systemPrompt;
            setActivePersonaName(routeResult.personaName);
          }
          
          // Strict Routing Rule:
          // If the query asks to introduce/explain candidate background or resume,
          // analyze and ground response in the uploaded resume.
          // Otherwise, strictly use AI Brain without polluting with resume context.
          const isIntroQuery = isResumeOrSelfIntroQuery(transcription);

          if (isIntroQuery) {
            try {
              const memoryChunks = await searchLocalMemory(transcription, 8);
              console.log(`[RAG] Self-intro/Resume query detected: "${transcription.substring(0, 80)}" → Found ${memoryChunks?.length || 0} resume chunks`);
              if (memoryChunks && memoryChunks.length > 0) {
                setUsedLocalKnowledge(true);
                const snippets = memoryChunks.map((m: any) => m.content).join("\n\n");
                console.log(`[RAG] Injecting ${snippets.length} chars from uploaded resume`);
                finalSystemPrompt = `CRITICAL INSTRUCTION: The interviewer is asking the candidate to introduce themselves, explain their background, or summarize their resume. You MUST STRICTLY analyze and synthesize the candidate's actual background using the following UPLOADED RESUME. Speak in the first person ("I am...", "My background spans...", "In my recent work, I developed...") representing the candidate with confidence and clarity. Rely strictly on the skills, projects, and achievements in this resume.\n\n[CANDIDATE'S UPLOADED RESUME]:\n${snippets}\n\n` + finalSystemPrompt;
              } else {
                console.log("[RAG] No resume chunks found for self-intro query");
                setUsedLocalKnowledge(false);
              }
            } catch (err) {
              console.error("[RAG] Local resume search failed", err);
              setUsedLocalKnowledge(false);
            }
          } else {
            // General / Technical / Concept / Coding question:
            // Strictly use AI Brain directly without injecting resume chunks!
            setUsedLocalKnowledge(false);
          }

          for await (const chunk of fetchAIResponse({
            provider: usePluelyAPI ? undefined : provider,
            selectedProvider: effectiveAIProvider,
            systemPrompt: finalSystemPrompt,
            history: previousMessages,
            userMessage: transcription,
            imagesBase64: imagesBase64 || [],
            signal: abortSignal,
          })) {
            if (abortSignal.aborted) break;
            fullResponse += chunk;
            setLastAIResponse((prev) => prev + chunk);
          }
        } catch (aiError: any) {
          // Suppress internal provider/model error details from UI
          console.error("AI response error:", aiError);
          setError("Could not get AI response. Please check your provider settings.");
        }

        if (fullResponse) {
          const timestamp = Date.now();
          const assistantMessage = {
            id: generateMessageId("assistant", timestamp),
            role: "assistant" as const,
            content: fullResponse,
            timestamp,
          };
          
          setConversation((prev) => {
            const hasUserMsg = prev.messages.some((m) => m.role === "user" && m.content === transcription);
            const userMsg = {
              id: generateMessageId("user", timestamp - 1),
              role: "user" as const,
              content: transcription,
              timestamp: timestamp - 1,
            };

            return {
              ...prev,
              messages: hasUserMsg
                ? [assistantMessage, ...prev.messages]
                : [assistantMessage, userMsg, ...prev.messages],
              updatedAt: timestamp,
              title: prev.title || generateConversationTitle(transcription),
            };
          });
        }
      } catch (err) {
        console.error("processWithAI error:", err);
      } finally {
        setIsAIProcessing(false);
      }
    },
    [selectedAIProvider, allAiProviders, vadConfig, capturing, selectedAudioDevices.output.id]
  );

  const processQueue = useCallback(async () => {
    if (isAIProcessingRef.current || requestQueueRef.current.length === 0) return;
    isAIProcessingRef.current = true;
    
    try {
      while (requestQueueRef.current.length > 0) {
        const req = requestQueueRef.current.shift();
        if (!req) continue;
        await processWithAI(req.transcription, req.prompt, req.previousMessages, req.imagesBase64);
      }
    } finally {
      isAIProcessingRef.current = false;
      
      // Attempt to safely restart native VAD if needed
      if (vadConfigRef.current.enabled && capturingRef.current && !vadActiveRef.current) {
        const deviceId = isTestMicEnabled
          ? (selectedAudioDevices.input.id !== "default" ? selectedAudioDevices.input.id : null)
          : (selectedAudioDevices.output.id !== "default" ? selectedAudioDevices.output.id : null);
        
        setTimeout(() => {
          if (capturingRef.current && !vadActiveRef.current) {
            import("@tauri-apps/api/core").then(({ invoke }) => {
                invoke("start_system_audio_capture", {
                  vadConfig: vadConfigRef.current,
                  deviceId: deviceId,
                  isInput: isTestMicEnabled
                }).then(() => {
                  vadActiveRef.current = true;
                }).catch(() => {
                  console.warn("Native VAD restart skipped");
                });
            });
          }
        }, 200);
      }
    }
  }, [processWithAI, isTestMicEnabled, selectedAudioDevices]);

  const handleNewTranscription = useCallback((
    transcription: string,
    prompt: string,
    previousMessages: Message[],
    imagesBase64?: string[]
  ) => {
      let newTextToProcess = transcription;
      if (lastProcessedTranscriptionRef.current && transcription.startsWith(lastProcessedTranscriptionRef.current)) {
         newTextToProcess = transcription.substring(lastProcessedTranscriptionRef.current.length).trim();
      }

      if (!newTextToProcess) return;

      lastProcessedTranscriptionRef.current = transcription;

      const isDuplicate = requestQueueRef.current.some(req => req.transcription === newTextToProcess);
      if (isDuplicate) return;

      requestQueueRef.current.push({
        transcription: newTextToProcess,
        prompt,
        previousMessages,
        imagesBase64
      });
      processQueue();
  }, [processQueue]);

  const startCapture = useCallback(async () => {
    try {
      setError("");

      // Set up a fresh conversation
      const conversationId = generateConversationId("sysaudio");
      setConversation({
        id: conversationId,
        title: "",
        messages: [],
        createdAt: 0,
        updatedAt: 0,
      });

      setCapturing(true);
      setIsPopoverOpen(true);
      setIsContinuousMode(!vadConfig.enabled);
      setRecordingProgress(0);

      if (!vadConfig.enabled) {
        // Continuous mode - manual stop/send
        setIsRecordingInContinuousMode(false);
        return;
      }

      // Check if we have online STT setup, otherwise default to offline WebSpeech
      const usePluelyAPI = await shouldUsePluelyAPI();
      const hasOnlineSTT = !!selectedSttProvider.provider || usePluelyAPI;

      if (!hasOnlineSTT) {
        setIsOfflineMode(true);
        if (webSpeechRecognizer.isSupported()) {
          if (!webSpeechRecognizer.isListening) {
            webSpeechRecognizer.start((res) => {
              if (res.transcript && res.transcript.trim()) {
                setLastTranscription(res.transcript);
                if (speechDebounceRef.current) clearTimeout(speechDebounceRef.current);
                
                speechDebounceRef.current = setTimeout(() => {
                  const prompt = useSystemPrompt
                    ? systemPrompt || DEFAULT_SYSTEM_PROMPT
                    : contextContent || DEFAULT_SYSTEM_PROMPT;
                  handleNewTranscription(res.transcript, prompt, conversation.messages);
                }, res.isFinal ? 100 : 800);
              }
            });
          }
        }
        return;
      }

      // VAD mode: native capture is PRIMARY
      await invoke<string>("stop_system_audio_capture").catch(() => {});
      vadActiveRef.current = false;

      const deviceId = isTestMicEnabled
        ? (selectedAudioDevices.input.id !== "default" ? selectedAudioDevices.input.id : null)
        : (selectedAudioDevices.output.id !== "default" ? selectedAudioDevices.output.id : null);

      try {
        await invoke<string>("start_system_audio_capture", {
          vadConfig: vadConfig,
          deviceId: deviceId,
          isInput: isTestMicEnabled,
        });
        vadActiveRef.current = true;
      } catch (nativeErr) {
        console.warn("Native audio capture failed, switching to offline mode:", nativeErr);
        setIsOfflineMode(true);
        // Fallback: use WebSpeech API continuously
        if (webSpeechRecognizer.isSupported()) {
          if (!webSpeechRecognizer.isListening) {
            webSpeechRecognizer.start((res) => {
              if (res.transcript && res.transcript.trim()) {
                setLastTranscription(res.transcript);
                if (speechDebounceRef.current) clearTimeout(speechDebounceRef.current);
                
                speechDebounceRef.current = setTimeout(() => {
                  const prompt = useSystemPromptRef.current
                    ? systemPromptRef.current || DEFAULT_SYSTEM_PROMPT
                    : contextContentRef.current || DEFAULT_SYSTEM_PROMPT;
                  handleNewTranscription(res.transcript, prompt, conversationRef.current.messages);
                }, res.isFinal ? 100 : 800);
              }
            });
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setIsPopoverOpen(true);
    }
  }, [vadConfig, selectedAudioDevices.output.id, useSystemPrompt, systemPrompt, contextContent, conversation.messages, processWithAI, isTestMicEnabled]);

  // Resume capture WITHOUT resetting conversation history (for Pause → Resume)
  const resumeCapture = useCallback(async () => {
    try {
      setError("");
      setCapturing(true);
      setIsPopoverOpen(true);
      setIsContinuousMode(!vadConfig.enabled);
      setRecordingProgress(0);

      if (!vadConfig.enabled) {
        // Continuous mode - manual stop/send
        setIsRecordingInContinuousMode(false);
        return;
      }

      // Check if we have online STT setup, otherwise default to offline WebSpeech
      const usePluelyAPI = await shouldUsePluelyAPI();
      const hasOnlineSTT = !!selectedSttProviderRef.current.provider || usePluelyAPI;

      if (!hasOnlineSTT) {
        setIsOfflineMode(true);
        if (webSpeechRecognizer.isSupported()) {
          if (!webSpeechRecognizer.isListening) {
            webSpeechRecognizer.start((res) => {
              if (res.transcript && res.transcript.trim()) {
                setLastTranscription(res.transcript);
                if (speechDebounceRef.current) clearTimeout(speechDebounceRef.current);
                
                speechDebounceRef.current = setTimeout(() => {
                  const prompt = useSystemPromptRef.current
                    ? systemPromptRef.current || DEFAULT_SYSTEM_PROMPT
                    : contextContentRef.current || DEFAULT_SYSTEM_PROMPT;
                  handleNewTranscription(res.transcript, prompt, conversationRef.current.messages);
                }, res.isFinal ? 100 : 800);
              }
            });
          }
        }
        return;
      }

      // VAD mode: native capture is PRIMARY
      await invoke<string>("stop_system_audio_capture").catch(() => {});
      vadActiveRef.current = false;

      const deviceId = isTestMicEnabled
        ? (selectedAudioDevices.input.id !== "default" ? selectedAudioDevices.input.id : null)
        : (selectedAudioDevices.output.id !== "default" ? selectedAudioDevices.output.id : null);

      try {
        await invoke<string>("start_system_audio_capture", {
          vadConfig: vadConfig,
          deviceId: deviceId,
          isInput: isTestMicEnabled,
        });
        vadActiveRef.current = true;
      } catch (nativeErr) {
        console.warn("Native audio capture failed, switching to offline mode:", nativeErr);
        setIsOfflineMode(true);
        if (webSpeechRecognizer.isSupported()) {
          if (!webSpeechRecognizer.isListening) {
            webSpeechRecognizer.start((res) => {
              if (res.transcript && res.transcript.trim()) {
                setLastTranscription(res.transcript);
                if (speechDebounceRef.current) clearTimeout(speechDebounceRef.current);
                
                speechDebounceRef.current = setTimeout(() => {
                  const prompt = useSystemPromptRef.current
                    ? systemPromptRef.current || DEFAULT_SYSTEM_PROMPT
                    : contextContentRef.current || DEFAULT_SYSTEM_PROMPT;
                  handleNewTranscription(res.transcript, prompt, conversationRef.current.messages);
                }, res.isFinal ? 100 : 800);
              }
            });
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setIsPopoverOpen(true);
    }
  }, [vadConfig, selectedAudioDevices.output.id, processWithAI, isTestMicEnabled]);

  const scanDocuments = useCallback(async (path?: string) => {
    try {
      // If a path is explicitly provided (via the Library button), save it
      if (path) {
        localStorage.setItem("custom_docs_path", path);
      }
      
      // Use the provided path, or fallback to the saved path, or null (which uses default AppData)
      const targetPath = path || localStorage.getItem("custom_docs_path") || null;
      const result = await invoke<string>("scan_documents", { dirPath: targetPath });
      return result;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, []);

  // Background auto-scan every 15 minutes + immediate initial scan
  useEffect(() => {
    // Initial scan on mount to ensure documents are indexed
    scanDocuments().catch(console.error);
    const interval = setInterval(() => {
      scanDocuments().catch(console.error);
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [scanDocuments]);

  const stopCapture = useCallback(async () => {
    try {
      // Cancel speech debounce timer
      if (speechDebounceRef.current) {
        clearTimeout(speechDebounceRef.current);
        speechDebounceRef.current = null;
      }

      // Stop WebSpeech offline fallback if running
      if (webSpeechRecognizer.isSupported()) {
        webSpeechRecognizer.stop();
      }

      // Clear the AI processing queue
      requestQueueRef.current = [];
      isAIProcessingRef.current = false;

      // Abort any ongoing AI requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Stop native audio capture
      await invoke<string>("stop_system_audio_capture").catch(() => {});

      // Reset ALL states
      setCapturing(false);
      setIsOfflineMode(false);
      setIsProcessing(false);
      setIsAIProcessing(false);
      setIsContinuousMode(false);
      setIsRecordingInContinuousMode(false);
      setRecordingProgress(0);
      setLastTranscription("");
      lastProcessedTranscriptionRef.current = "";
      setLastAIResponse("");
      setError("");
      setIsPopoverOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to stop capture: ${errorMessage}`);
      console.error("Stop capture error:", err);
    }
  }, []);

  // Pause capture: stops audio engine but preserves conversation + display state
  const pauseCapture = useCallback(async () => {
    try {
      // Cancel speech debounce timer
      if (speechDebounceRef.current) {
        clearTimeout(speechDebounceRef.current);
        speechDebounceRef.current = null;
      }

      // Stop WebSpeech offline fallback if running
      if (webSpeechRecognizer.isSupported()) {
        webSpeechRecognizer.stop();
      }

      // Clear the AI processing queue
      requestQueueRef.current = [];
      isAIProcessingRef.current = false;

      // Abort any ongoing AI requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Stop native audio capture
      await invoke<string>("stop_system_audio_capture").catch(() => {});
      vadActiveRef.current = false;

      // Only stop capturing — preserve conversation, transcription, AI response
      setCapturing(false);
      setIsOfflineMode(false);
      setIsProcessing(false);
      setIsAIProcessing(false);
      setIsContinuousMode(false);
      setIsRecordingInContinuousMode(false);
      setRecordingProgress(0);
      setError("");
      // NOTE: intentionally NOT clearing lastTranscription, lastAIResponse, or conversation
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to pause capture: ${errorMessage}`);
      console.error("Pause capture error:", err);
    }
  }, []);

  // Manual stop for continuous recording
  const manualStopAndSend = useCallback(async () => {
    try {
      if (!isContinuousMode) {
        console.warn("Not in continuous mode");
        return;
      }

      // Show processing state immediately
      setIsProcessing(true);

      // Trigger manual stop event
      await invoke("manual_stop_continuous");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to manually stop: ${errorMessage}`);
      setIsProcessing(false); // Clear processing state on error
      console.error("Manual stop error:", err);
    }
  }, [isContinuousMode]);

  const handleSetup = useCallback(async () => {
    try {
      const platform = navigator.platform.toLowerCase();

      if (platform.includes("mac") || platform.includes("win")) {
        await invoke("request_system_audio_access");
      }

      // Delay to give the user time to grant permissions in the system dialog.
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const hasAccess = await invoke<boolean>("check_system_audio_access");
      if (hasAccess) {
        setSetupRequired(false);
        await startCapture();
      } else {
        setSetupRequired(true);
        setError("Permission not granted. Please try the manual steps.");
      }
    } catch (err) {
      setError("Failed to request access. Please try the manual steps below.");
      setSetupRequired(true);
    }
  }, [startCapture]);

  useEffect(() => {
    const shouldOpenPopover =
      capturing ||
      setupRequired ||
      isAIProcessing ||
      !!lastAIResponse ||
      !!error;
    setIsPopoverOpen(shouldOpenPopover);
    resizeWindow(shouldOpenPopover);
  }, [
    capturing,
    setupRequired,
    isAIProcessing,
    lastAIResponse,
    error,
    resizeWindow,
  ]);

  useEffect(() => {
    globalShortcuts.registerSystemAudioCallback(async () => {
      if (capturing) {
        await stopCapture();
      } else {
        await startCapture();
      }
    });
  }, [startCapture, stopCapture]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      invoke("stop_system_audio_capture").catch(() => {});
    };
  }, []);

  // Debounced save to prevent race conditions and improve performance
  useEffect(() => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Only debounce if there are messages to save
    if (
      !conversation.id ||
      conversation.updatedAt === 0 ||
      conversation.messages.length === 0
    ) {
      return;
    }

    // Debounce saves (only save 500ms after last change)
    saveTimeoutRef.current = setTimeout(async () => {
      // Don't save if already saving (prevent concurrent saves)
      if (isSavingRef.current) {
        return;
      }

      try {
        isSavingRef.current = true;
        await saveConversation(conversation);
      } catch (error) {
        console.error("Failed to save system audio conversation:", error);
      } finally {
        isSavingRef.current = false;
      }
    }, CONVERSATION_SAVE_DEBOUNCE_MS);

    // Cleanup on unmount or dependency change
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    conversation.messages.length,
    conversation.title,
    conversation.id,
    conversation.updatedAt,
  ]);

  const startNewConversation = useCallback(() => {
    setConversation({
      id: generateConversationId("sysaudio"),
      title: "",
      messages: [],
      createdAt: 0,
      updatedAt: 0,
    });
    setLastTranscription("");
      lastProcessedTranscriptionRef.current = "";
    setLastAIResponse("");
    setError("");
    setSetupRequired(false);
    setIsProcessing(false);
    setIsAIProcessing(false);
    setIsPopoverOpen(false);
    setUseSystemPrompt(true);
  }, []);

  // Update VAD configuration
  const updateVadConfiguration = useCallback(async (config: VadConfig) => {
    try {
      setVadConfig(config);
      safeLocalStorage.setItem("vad_config", JSON.stringify(config));
      await invoke("update_vad_config", { config });
    } catch (error) {
      console.error("Failed to update VAD config:", error);
    }
  }, []);

  useEffect(() => {
    if (capturing) {
      setIsContinuousMode(!vadConfig.enabled);

      if (!vadConfig.enabled) {
        setIsRecordingInContinuousMode(false);
      }
    }
  }, [vadConfig.enabled, capturing]);

  // Keyboard arrow key support for scrolling (local shortcut)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPopoverOpen) return;

      const scrollElement = scrollAreaRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement;

      if (!scrollElement) return;

      const scrollAmount = 100; // pixels to scroll

      if (e.key === "ArrowDown") {
        e.preventDefault();
        scrollElement.scrollBy({ top: scrollAmount, behavior: "smooth" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        scrollElement.scrollBy({ top: -scrollAmount, behavior: "smooth" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPopoverOpen]);

  // Keyboard shortcuts for continuous mode recording (local shortcuts)
  useEffect(() => {
    const handleRecordingShortcuts = (e: KeyboardEvent) => {
      if (!isPopoverOpen || !isContinuousMode) return;
      if (isProcessing || isAIProcessing) return;

      // Enter: Start recording (when not recording) or Stop & Send (when recording)
      if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (!isRecordingInContinuousMode) {
          startContinuousRecording();
        } else {
          manualStopAndSend();
        }
      }

      // Escape: Ignore recording (when recording)
      if (e.key === "Escape" && isRecordingInContinuousMode) {
        e.preventDefault();
        ignoreContinuousRecording();
      }

      // Space: Start recording (when not recording) - only if not typing in input
      if (
        e.key === " " &&
        !isRecordingInContinuousMode &&
        !e.metaKey &&
        !e.ctrlKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        startContinuousRecording();
      }
    };

    window.addEventListener("keydown", handleRecordingShortcuts);
    return () =>
      window.removeEventListener("keydown", handleRecordingShortcuts);
  }, [
    isPopoverOpen,
    isContinuousMode,
    isRecordingInContinuousMode,
    isProcessing,
    isAIProcessing,
    startContinuousRecording,
    manualStopAndSend,
    ignoreContinuousRecording,
  ]);

  const clearConversation = useCallback(() => {
    // Save visible messages to session memory so AI remembers context
    const visibleMessages = [...conversationRef.current.messages].reverse();
    sessionMemoryRef.current = [...sessionMemoryRef.current, ...visibleMessages];
    
    setConversation({
      id: generateConversationId("sysaudio"),
      title: "",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setLastTranscription("");
      lastProcessedTranscriptionRef.current = "";
    setLastAIResponse("");
  }, []);

  return {
    capturing,
    isOfflineMode,
    isProcessing,
    isAIProcessing,
    lastTranscription,
    lastAIResponse,
    activePersonaName,
    setActivePersonaName,
    usedLocalKnowledge,
    isTestMicEnabled,
    setIsTestMicEnabled,
    error,
    setupRequired,
    startCapture,
    resumeCapture,
    pauseCapture,
    stopCapture,
    handleSetup,
    isPopoverOpen,
    setIsPopoverOpen,
    // Conversation management
    conversation,
    setConversation,
    clearConversation,
    // AI processing
    processWithAI,
    searchLocalMemory,
    scanDocuments,
    // Context management
    useSystemPrompt,
    setUseSystemPrompt: updateUseSystemPrompt,
    contextContent,
    setContextContent: updateContextContent,
    startNewConversation,
    // Window resize
    resizeWindow,
    quickActions,
    addQuickAction,
    removeQuickAction,
    isManagingQuickActions,
    setIsManagingQuickActions,
    showQuickActions,
    setShowQuickActions,
    handleQuickActionClick,
    // VAD configuration
    vadConfig,
    updateVadConfiguration,
    // Continuous recording
    isContinuousMode,
    isRecordingInContinuousMode,
    recordingProgress,
    manualStopAndSend,
    startContinuousRecording,
    ignoreContinuousRecording,
    // Scroll area ref for keyboard navigation
    scrollAreaRef,
  };
}
