import { useState, useEffect } from "react";
import { useApp } from "@/contexts";
import { validateProvider, ApiValidationStatus } from "@/lib/functions/api-validation";
import { Loader2 } from "lucide-react";

export const ApiStatusIndicator = () => {
  const { selectedAIProvider, selectedSttProvider } = useApp();
  const [aiStatus, setAiStatus] = useState<ApiValidationStatus>('loading');
  const [sttStatus, setSttStatus] = useState<ApiValidationStatus>('loading');

  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      setAiStatus('loading');
      const status = await validateProvider(selectedAIProvider.provider, selectedAIProvider.variables);
      if (isMounted) setAiStatus(status);
    };
    checkStatus();
    return () => { isMounted = false; };
  }, [selectedAIProvider.provider, selectedAIProvider.variables]);

  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      setSttStatus('loading');
      
      // Attempt to borrow API key if missing for Gemini STT
      let effectiveSttVariables = selectedSttProvider.variables;
      if (
        selectedSttProvider.provider === "gemini-stt" &&
        (!selectedSttProvider.variables || (!selectedSttProvider.variables.API_KEY && !selectedSttProvider.variables.api_key)) &&
        selectedAIProvider?.provider?.startsWith("gemini") &&
        (selectedAIProvider.variables?.API_KEY || selectedAIProvider.variables?.api_key)
      ) {
        effectiveSttVariables = {
          ...selectedSttProvider.variables,
          API_KEY: selectedAIProvider.variables.API_KEY || selectedAIProvider.variables.api_key
        };
      }

      const status = await validateProvider(selectedSttProvider.provider, effectiveSttVariables);
      if (isMounted) setSttStatus(status);
    };
    checkStatus();
    return () => { isMounted = false; };
  }, [selectedSttProvider.provider, selectedSttProvider.variables, selectedAIProvider.variables]);

  const getStatusColor = (status: ApiValidationStatus) => {
    switch (status) {
      case 'valid': return 'bg-green-500';
      case 'invalid': return 'bg-red-500';
      case 'missing': return 'bg-yellow-500';
      case 'unsupported': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: ApiValidationStatus, type: string) => {
    switch (status) {
      case 'valid': return `${type} API is Valid`;
      case 'invalid': return `${type} API Key is Invalid (401/400)`;
      case 'missing': return `${type} API Key is Missing`;
      case 'unsupported': return `${type} Validation not supported`;
      default: return `Checking ${type}...`;
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-full border border-border/50 bg-background/50">
      <div 
        className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-muted/50 cursor-default"
        title={getStatusText(sttStatus, "STT")}
      >
        {sttStatus === 'loading' ? (
          <Loader2 className="h-2 w-2 animate-spin text-muted-foreground" />
        ) : (
          <div className={`h-2 w-2 rounded-full ${getStatusColor(sttStatus)}`} />
        )}
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">STT</span>
      </div>

      <div className="w-[1px] h-3 bg-border/50" />

      <div 
        className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-muted/50 cursor-default"
        title={getStatusText(aiStatus, "AI Assistant")}
      >
        {aiStatus === 'loading' ? (
          <Loader2 className="h-2 w-2 animate-spin text-muted-foreground" />
        ) : (
          <div className={`h-2 w-2 rounded-full ${getStatusColor(aiStatus)}`} />
        )}
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">AI</span>
      </div>
    </div>
  );
};
