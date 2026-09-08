import { useState, useEffect } from "react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components";
import { SparklesIcon, ChevronDownIcon, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface Model {
  provider: string;
  name: string;
  id: string;
  model: string;
  description: string;
  modality: string;
  isAvailable: boolean;
}

interface StorageResult {
  selected_pluely_model?: string;
}

interface ActionToolbarProps {
  attachedFilesCount?: number;
}

const SELECTED_PLUELY_MODEL_STORAGE_KEY = "selected_pluely_model";

const DEFAULT_MODELS: Model[] = [
  {
    provider: "Gemini",
    name: "Gemini 3.5 Flash-Lite",
    id: "gemini-3.5-flash-lite",
    model: "gemini-3.5-flash-lite",
    description: "Google Gemini 3.5 Flash-Lite model",
    modality: "text,image",
    isAvailable: true,
  },
  {
    provider: "Gemini",
    name: "Gemini 3.5 Flash",
    id: "gemini-3.5-flash",
    model: "gemini-3.5-flash",
    description: "Google Gemini 3.5 Flash model",
    modality: "text,image",
    isAvailable: true,
  },
  {
    provider: "Gemini",
    name: "Gemini 3.1 Pro (Preview)",
    id: "gemini-3.1-pro-preview",
    model: "gemini-3.1-pro-preview",
    description: "Google Gemini 3.1 Pro reasoning model (Preview)",
    modality: "text,image",
    isAvailable: true,
  },
  {
    provider: "Gemini",
    name: "Gemini 3.1 Flash Live (Preview)",
    id: "gemini-3.1-flash-live-preview",
    model: "gemini-3.1-flash-live-preview",
    description: "Gemini real-time meeting transcription model (Preview)",
    modality: "audio,text",
    isAvailable: true,
  },
  {
    provider: "OpenAI",
    name: "GPT-4o",
    id: "gpt-4o",
    model: "gpt-4o",
    description: "OpenAI high intelligence flagship model",
    modality: "text,image",
    isAvailable: true,
  },
  {
    provider: "OpenAI",
    name: "GPT-4o Mini",
    id: "gpt-4o-mini",
    model: "gpt-4o-mini",
    description: "OpenAI lightweight fast model",
    modality: "text,image",
    isAvailable: true,
  },
];

import { useApp } from "@/contexts";
import { ApiStatusIndicator } from "./ApiStatusIndicator";

export const ActionToolbar = ({
  attachedFilesCount = 0,
}: ActionToolbarProps) => {
  const { 
    allSttProviders, 
    selectedSttProvider, 
    onSetSelectedSttProvider,
    allAiProviders,
    selectedAIProvider,
    onSetSelectedAIProvider,
    pluelyApiEnabled
  } = useApp();
  const [models, setModels] = useState<Model[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState<Model | null>(DEFAULT_MODELS[0]);
  const [isModelsLoading, setIsModelsLoading] = useState(false);

  // custom STT helpers
  const currentSttProviderDef = allSttProviders?.find(p => p.id === selectedSttProvider?.provider);
  const currentSttModels = currentSttProviderDef?.models || [];
  const selectedSttModelName = selectedSttProvider?.variables?.model 
    || selectedSttProvider?.variables?.MODEL
    || currentSttProviderDef?.defaultModel 
    || (currentSttModels.length > 0 ? currentSttModels[0] : "Select Model");

  // custom AI helpers
  const currentAiProviderDef = allAiProviders?.find(p => p.id === selectedAIProvider?.provider);
  const currentAiModels = currentAiProviderDef?.models || [];
  const selectedAiModelName = selectedAIProvider?.variables?.model 
    || selectedAIProvider?.variables?.MODEL
    || currentAiProviderDef?.defaultModel 
    || (currentAiModels.length > 0 ? currentAiModels[0] : "Select Model");

  useEffect(() => {
    const fetchModels = async () => {
      setIsModelsLoading(true);
      try {
        const fetchedModels = await invoke<Model[]>("fetch_models");
        if (fetchedModels && fetchedModels.length > 0) {
          setModels(fetchedModels);
        } else {
          setModels(DEFAULT_MODELS);
        }
      } catch (error) {
        console.error("Failed to fetch models, using default models:", error);
        setModels(DEFAULT_MODELS);
      } finally {
        setIsModelsLoading(false);
      }
    };

    const loadSelectedModel = async () => {
      try {
        const storage = await invoke<StorageResult>("secure_storage_get");
        if (storage.selected_pluely_model) {
          try {
            const storedModel = JSON.parse(storage.selected_pluely_model);
            setSelectedModel(storedModel);
          } catch (e) {
            console.error("Failed to parse stored model:", e);
          }
        }
      } catch (err) {
        console.error("Failed to load selected model:", err);
      }
    };

    fetchModels();
    loadSelectedModel();
  }, []);

  const getPersistedApiKey = (providerId: string): string => {
    try {
      const keysStr = localStorage.getItem("provider_api_keys");
      if (keysStr) {
        const keys = JSON.parse(keysStr);
        return keys[providerId] || "";
      }
    } catch (e) {
      console.error("Failed to load persisted API key:", e);
    }
    return "";
  };

  const handleModelSelect = async (model: Model) => {
    setSelectedModel(model);
    try {
      await invoke("secure_storage_save", {
        items: [
          {
            key: SELECTED_PLUELY_MODEL_STORAGE_KEY,
            value: JSON.stringify(model),
          },
        ],
      });
    } catch (error) {
      console.error("Failed to save model selection:", error);
    }
  };

  const handleSttModelChange = (modelName: string) => {
    const existingVars = selectedSttProvider?.variables || {};
    const newVars = { ...existingVars };
    if ('MODEL' in newVars || ('model' in newVars === false)) {
      newVars.MODEL = modelName;
    }
    newVars.model = modelName;
    onSetSelectedSttProvider({
      provider: selectedSttProvider.provider,
      variables: newVars
    });
  };

  const handleAiModelChange = (modelName: string) => {
    const existingVars = selectedAIProvider?.variables || {};
    const newVars = { ...existingVars };
    if ('MODEL' in newVars || ('model' in newVars === false)) {
      newVars.MODEL = modelName;
    }
    newVars.model = modelName;
    onSetSelectedAIProvider({
      provider: selectedAIProvider.provider,
      variables: newVars
    });
  };

  return (
    <div className="flex w-full items-center justify-between gap-3 py-1">
      {attachedFilesCount > 0 ? (
        <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-xs">
          <SparklesIcon className="h-4 w-4" />
          {attachedFilesCount} file{attachedFilesCount > 1 ? "s" : ""} attached
        </Button>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex items-center gap-3 shrink-0">
        <ApiStatusIndicator />

        {pluelyApiEnabled ? (
          <>
            {/* Pluely Mode: Standard STT Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                  🎙️ {selectedSttProvider?.provider ? allSttProviders.find(p => p.id === selectedSttProvider.provider)?.name || selectedSttProvider.provider : "Transcription: Off"}
                  <ChevronDownIcon className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[300px] max-h-[300px] overflow-y-auto bg-background">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Transcription Model (STT)</div>
                {allSttProviders.map(provider => (
                  <DropdownMenuItem 
                    key={provider.id} 
                    className="cursor-pointer flex flex-col items-start gap-1 p-2" 
                    onClick={() => onSetSelectedSttProvider({ provider: provider.id || "", variables: selectedSttProvider?.provider === provider.id ? selectedSttProvider.variables : {} })}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium text-sm">{provider.name}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-[1px] h-4 bg-border/50 mx-1" />

            {/* Pluely Mode: Standard AI Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:text-foreground" disabled={isModelsLoading}>
                  {isModelsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  🧠 {selectedModel ? selectedModel.name : "Select AI Model"}
                  <ChevronDownIcon className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[300px] max-h-[300px] overflow-y-auto bg-background">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">AI Assistant Model</div>
                {models.length > 0 ? models.map(model => (
                  <DropdownMenuItem 
                    key={model.id} 
                    className="cursor-pointer flex flex-col items-start gap-1 p-2" 
                    onClick={() => handleModelSelect(model)}
                    disabled={!model.isAvailable}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium text-sm">{model.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 border border-border/50 text-muted-foreground">
                        {model.provider}
                      </span>
                    </div>
                    {model.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {model.description}
                      </span>
                    )}
                  </DropdownMenuItem>
                )) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No models available
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            {/* Custom Mode: STT Provider & Model Selection Dropdowns */}
            <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-background/60 p-1 shadow-sm">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 text-foreground/80 hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer">
                    <span>🎙️ {currentSttProviderDef?.name || selectedSttProvider?.provider || "STT Provider"}</span>
                    <ChevronDownIcon className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[220px] max-h-[300px] overflow-y-auto bg-background">
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">STT Provider</div>
                  {allSttProviders.map(provider => (
                    <DropdownMenuItem 
                      key={provider.id} 
                      className="cursor-pointer text-xs p-2 rounded-md hover:bg-accent/50" 
                      onClick={() => {
                        const defaultModel = provider.defaultModel || (provider.models && provider.models[0]) || "";
                        const savedKey = getPersistedApiKey(provider.id || "");
                        onSetSelectedSttProvider({ 
                          provider: provider.id || "", 
                          variables: { 
                            API_KEY: savedKey,
                            api_key: savedKey,
                            model: defaultModel,
                            MODEL: defaultModel
                          } 
                        });
                      }}
                    >
                      {provider.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {currentSttModels.length > 0 && (
                <>
                  <div className="w-[1px] h-4 bg-border/50 mx-0.5" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 text-foreground/80 hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer">
                        <span>{selectedSttModelName}</span>
                        <ChevronDownIcon className="h-3 w-3 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px] max-h-[300px] overflow-y-auto bg-background">
                      <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">STT Model</div>
                      {currentSttModels.map(modelName => (
                        <DropdownMenuItem 
                          key={modelName} 
                          className="cursor-pointer text-xs p-2 rounded-md hover:bg-accent/50" 
                          onClick={() => handleSttModelChange(modelName)}
                        >
                          {modelName}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>

            <div className="w-[1px] h-4 bg-border/50 mx-1" />

            {/* Custom Mode: AI Provider & Model Selection Dropdowns */}
            <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-background/60 p-1 shadow-sm">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 text-foreground/80 hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer">
                    <span>🧠 {currentAiProviderDef?.name || selectedAIProvider?.provider || "AI Provider"}</span>
                    <ChevronDownIcon className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[220px] max-h-[300px] overflow-y-auto bg-background">
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">AI Provider</div>
                  {allAiProviders.map(provider => (
                    <DropdownMenuItem 
                      key={provider.id} 
                      className="cursor-pointer text-xs p-2 rounded-md hover:bg-accent/50" 
                      onClick={() => {
                        const defaultModel = provider.defaultModel || (provider.models && provider.models[0]) || "";
                        const savedKey = getPersistedApiKey(provider.id || "");
                        onSetSelectedAIProvider({ 
                          provider: provider.id || "", 
                          variables: { 
                            API_KEY: savedKey,
                            api_key: savedKey,
                            model: defaultModel,
                            MODEL: defaultModel
                          } 
                        });
                      }}
                    >
                      {provider.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {currentAiModels.length > 0 && (
                <>
                  <div className="w-[1px] h-4 bg-border/50 mx-0.5" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 text-foreground/80 hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer">
                        <span>{selectedAiModelName}</span>
                        <ChevronDownIcon className="h-3 w-3 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px] max-h-[300px] overflow-y-auto bg-background">
                      <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">AI Model</div>
                      {currentAiModels.map(modelName => (
                        <DropdownMenuItem 
                          key={modelName} 
                          className="cursor-pointer text-xs p-2 rounded-md hover:bg-accent/50" 
                          onClick={() => handleAiModelChange(modelName)}
                        >
                          {modelName}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
