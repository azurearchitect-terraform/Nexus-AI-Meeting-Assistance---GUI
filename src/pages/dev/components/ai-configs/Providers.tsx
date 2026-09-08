import { Button, Header, Input, Selection, TextInput } from "@/components";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UseSettingsReturn } from "@/types";
import curl2Json, { ResultJSON } from "@bany/curl-to-json";
import { KeyIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";

export const Providers = ({
  allAiProviders,
  selectedAIProvider,
  onSetSelectedAIProvider,
  variables,
}: UseSettingsReturn) => {
  const [localSelectedProvider, setLocalSelectedProvider] =
    useState<ResultJSON | null>(null);

  useEffect(() => {
    if (selectedAIProvider?.provider) {
      const provider = allAiProviders?.find(
        (p) => p?.id === selectedAIProvider?.provider
      );
      if (provider) {
        const json = curl2Json(provider?.curl);
        setLocalSelectedProvider(json as ResultJSON);
      }
    }
  }, [selectedAIProvider?.provider]);

  const findKeyAndValue = (key: string) => {
    return variables?.find((v) => v?.key?.toLowerCase() === key.toLowerCase());
  };

  const getApiKeyValue = () => {
    const apiKeyVar = findKeyAndValue("api_key");
    if (!apiKeyVar || !selectedAIProvider?.variables) return "";
    return selectedAIProvider?.variables?.[apiKeyVar.key] || "";
  };

  const isApiKeyEmpty = () => {
    return !getApiKeyValue().trim();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Header
          title="Select AI Provider"
          description="Select your preferred AI service provider or custom providers to get started."
        />
        <Selection
          selected={selectedAIProvider?.provider}
          options={allAiProviders?.map((provider) => {
            return {
              label: provider?.isCustom
                ? provider?.name || provider?.id || "Custom Provider"
                : provider?.name || provider?.id || "Unknown",
              value: provider?.id || "Custom Provider",
              isCustom: provider?.isCustom,
            };
          })}
          placeholder="Choose your AI provider"
          onChange={(value) => {
            onSetSelectedAIProvider({
              provider: value,
              variables: {},
            });
          }}
        />
      </div>

      {selectedAIProvider?.provider === "auto" ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <span className="font-semibold text-sm">Intelligent Auto-Routing is active</span>
          </div>
          <p className="text-xs text-muted-foreground">
            The system will automatically pick the cheapest and fastest model based on your query:
          </p>
          <div className="text-xs space-y-1 text-muted-foreground">
            <div className="flex gap-2"><span className="text-blue-500">⚡ Short queries</span><span>→ Groq (llama-3.3-70b-versatile) — fastest, free</span></div>
            <div className="flex gap-2"><span className="text-green-500">📄 Long context</span><span>→ Gemini (gemini-2.5-flash-lite) — cheapest per token</span></div>
            <div className="flex gap-2"><span className="text-orange-500">🧠 Complex/coding</span><span>→ OpenAI (gpt-4o) if key available</span></div>
          </div>
          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-xs font-medium">Enter your API keys below (add at least Groq or Gemini):</p>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Groq API Key (recommended — free)</label>
              <Input
                type="password"
                placeholder="gsk_..."
                value={selectedAIProvider?.variables?.GROQ_KEY || ""}
                onChange={(value) => {
                  onSetSelectedAIProvider?.({
                    ...selectedAIProvider!,
                    variables: {
                      ...selectedAIProvider!.variables,
                      GROQ_KEY: typeof value === "string" ? value : value.target.value,
                    },
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Gemini API Key (recommended — cheap for large text)</label>
              <Input
                type="password"
                placeholder="AIza..."
                value={selectedAIProvider?.variables?.GEMINI_KEY || ""}
                onChange={(value) => {
                  onSetSelectedAIProvider?.({
                    ...selectedAIProvider!,
                    variables: {
                      ...selectedAIProvider!.variables,
                      GEMINI_KEY: typeof value === "string" ? value : value.target.value,
                    },
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">OpenAI API Key (optional — for complex/coding queries)</label>
              <Input
                type="password"
                placeholder="sk-..."
                value={selectedAIProvider?.variables?.OPENAI_KEY || ""}
                onChange={(value) => {
                  onSetSelectedAIProvider?.({
                    ...selectedAIProvider!,
                    variables: {
                      ...selectedAIProvider!.variables,
                      OPENAI_KEY: typeof value === "string" ? value : value.target.value,
                    },
                  });
                }}
              />
            </div>
          </div>
        </div>
      ) : localSelectedProvider ? (
        <Header
          title={`Method: ${
            localSelectedProvider?.method || "Invalid"
          }, Endpoint: ${localSelectedProvider?.url || "Invalid"}`}
          description={`If you want to use different url or method, you can always create a custom provider.`}
        />
      ) : null}


      {findKeyAndValue("api_key") && selectedAIProvider?.provider !== "auto" ? (
        <div className="space-y-2">
          <Header
            title="API Key"
            description={`Enter your ${
              allAiProviders?.find(
                (p) => p?.id === selectedAIProvider?.provider
              )?.isCustom
                ? "Custom Provider"
                : selectedAIProvider?.provider
            } API key to authenticate and access AI models. Your key is stored locally and never shared.`}
          />

          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="**********"
                value={getApiKeyValue()}
                onChange={(value) => {
                  const apiKeyVar = findKeyAndValue("api_key");
                  if (!apiKeyVar || !selectedAIProvider) return;

                  onSetSelectedAIProvider({
                    ...selectedAIProvider,
                    variables: {
                      ...selectedAIProvider.variables,
                      [apiKeyVar.key]:
                        typeof value === "string" ? value : value.target.value,
                    },
                  });
                }}
                onKeyDown={(e) => {
                  const apiKeyVar = findKeyAndValue("api_key");
                  if (!apiKeyVar || !selectedAIProvider) return;

                  onSetSelectedAIProvider({
                    ...selectedAIProvider,
                    variables: {
                      ...selectedAIProvider.variables,
                      [apiKeyVar.key]: (e.target as HTMLInputElement).value,
                    },
                  });
                }}
                disabled={false}
                className="flex-1 h-11 border-1 border-input/50 focus:border-primary/50 transition-colors"
              />
              {isApiKeyEmpty() ? (
                <Button
                  onClick={() => {
                    const apiKeyVar = findKeyAndValue("api_key");
                    if (!apiKeyVar || !selectedAIProvider || isApiKeyEmpty())
                      return;

                    onSetSelectedAIProvider({
                      ...selectedAIProvider,
                      variables: {
                        ...selectedAIProvider.variables,
                        [apiKeyVar.key]: getApiKeyValue(),
                      },
                    });
                  }}
                  disabled={isApiKeyEmpty()}
                  size="icon"
                  className="shrink-0 h-11 w-11"
                  title="Submit API Key"
                >
                  <KeyIcon className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    const apiKeyVar = findKeyAndValue("api_key");
                    if (!apiKeyVar || !selectedAIProvider) return;

                    onSetSelectedAIProvider({
                      ...selectedAIProvider,
                      variables: {
                        ...selectedAIProvider.variables,
                        [apiKeyVar.key]: "",
                      },
                    });
                  }}
                  size="icon"
                  variant="destructive"
                  className="shrink-0 h-11 w-11"
                  title="Remove API Key"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedAIProvider?.provider !== "auto" && (
      <div className="space-y-4 mt-2">
        {variables
          .filter(
            (variable) => variable.key !== findKeyAndValue("api_key")?.key
          )
          .map((variable) => {
            const getVariableValue = () => {
              if (!variable?.key || !selectedAIProvider?.variables) return "";
              return selectedAIProvider.variables[variable.key] || "";
            };

            const isModelVar = variable?.key?.toLowerCase() === "model";
            const providerId = selectedAIProvider?.provider;
            
            let modelOptions: { label: string; value: string }[] = [];
            const providerDef = allAiProviders?.find((p) => p.id === providerId);
            if (providerDef && providerDef.models) {
              modelOptions = providerDef.models.map((m: string) => ({
                label: m,
                value: m,
              }));
            }

            return (
              <div className="space-y-1" key={variable?.key}>
                <Header
                  title={variable?.value || ""}
                  description={`select or enter your preferred ${variable?.key?.replace(
                    /_/g,
                    " "
                  )} for ${
                    allAiProviders?.find(
                      (p) => p?.id === selectedAIProvider?.provider
                    )?.isCustom
                      ? "Custom Provider"
                      : selectedAIProvider?.provider
                  }`}
                />
                {isModelVar && modelOptions.length > 0 ? (
                  <div className="space-y-2">
                    <Select
                      value={modelOptions.some(opt => opt.value === getVariableValue()) ? getVariableValue() : ""}
                      onValueChange={(val) => {
                        if (!variable?.key || !selectedAIProvider) return;
                        onSetSelectedAIProvider({
                          ...selectedAIProvider,
                          variables: {
                            ...selectedAIProvider.variables,
                            [variable.key]: val,
                            MODEL: val,
                            model: val,
                          },
                        });
                      }}
                    >
                      <SelectTrigger className="w-full h-11 border border-input bg-background text-foreground focus:border-primary/50 transition-colors">
                        <SelectValue placeholder="Select a preset model or enter custom name below" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto bg-popover text-popover-foreground border border-border shadow-lg">
                        {modelOptions.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="cursor-pointer hover:bg-accent/50 text-popover-foreground"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Or enter model name manually:</span>
                        {getVariableValue() && (
                          <span className="font-mono text-[11px] text-primary">Active: {getVariableValue()}</span>
                        )}
                      </div>
                      <TextInput
                        placeholder="e.g. gemini-2.5-flash, gemini-2.0-flash, gpt-4o, etc."
                        value={getVariableValue()}
                        onChange={(value) => {
                          if (!variable?.key || !selectedAIProvider) return;
                          onSetSelectedAIProvider({
                            ...selectedAIProvider,
                            variables: {
                              ...selectedAIProvider.variables,
                              [variable.key]: value,
                              MODEL: value,
                              model: value,
                            },
                          });
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <TextInput
                    placeholder={`Enter ${
                      allAiProviders?.find(
                        (p) => p?.id === selectedAIProvider?.provider
                      )?.isCustom
                        ? "Custom Provider"
                        : selectedAIProvider?.provider
                    } ${variable?.key?.replace(/_/g, " ") || "value"}`}
                    value={getVariableValue()}
                    onChange={(value) => {
                      if (!variable?.key || !selectedAIProvider) return;

                      onSetSelectedAIProvider({
                        ...selectedAIProvider,
                        variables: {
                          ...selectedAIProvider.variables,
                          [variable.key]: value,
                        },
                      });
                    }}
                  />
                )}
              </div>
            );
          })}
      </div>
      )}
    </div>
  );
};
