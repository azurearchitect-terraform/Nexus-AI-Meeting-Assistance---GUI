import { useState, useEffect } from "react";
import { useApp } from "@/hooks";
import { Header, Card, Label, Input, Button } from "@/components";
import { SaveIcon } from "lucide-react";
import { VadConfig } from "@/hooks/useSystemAudio";

export const VADConfigs = () => {
  const { systemAudio } = useApp();
  const { vadConfig, updateVadConfiguration } = systemAudio;

  const [config, setConfig] = useState<VadConfig>(vadConfig);

  useEffect(() => {
    setConfig(vadConfig);
  }, [vadConfig]);

  const handleChange = (key: keyof VadConfig, value: string) => {
    setConfig((prev: VadConfig) => ({
      ...prev,
      [key]: key === "enabled" ? value === "true" : Number(value),
    }));
  };

  const handleSave = () => {
    updateVadConfiguration(config);
  };

  return (
    <div id="vad-configs" className="space-y-4">
      <Header
        title="Voice Activity Detection (VAD)"
        description="Configure parameters for automatic voice detection and silence slicing. Tune these if the AI cuts you off too early or picks up background noise."
        isMainTitle
      />

      <Card className="p-5 border-border/50 bg-background/50 space-y-6">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">1. Sensitivity & Noise Filtering</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sensitivity_rms" className="text-xs">RMS Sensitivity</Label>
                <Input
                  id="sensitivity_rms"
                  type="number"
                  step="0.001"
                  value={config.sensitivity_rms}
                  onChange={(e) => handleChange("sensitivity_rms", e.target.value)}
                  className="h-8 text-sm bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground">Lower = more sensitive (Default: 0.012)</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="peak_threshold" className="text-xs">Peak Threshold</Label>
                <Input
                  id="peak_threshold"
                  type="number"
                  step="0.001"
                  value={config.peak_threshold}
                  onChange={(e) => handleChange("peak_threshold", e.target.value)}
                  className="h-8 text-sm bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground">Filters sudden loud noises (Default: 0.035)</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="noise_gate_threshold" className="text-xs">Noise Gate</Label>
                <Input
                  id="noise_gate_threshold"
                  type="number"
                  step="0.001"
                  value={config.noise_gate_threshold}
                  onChange={(e) => handleChange("noise_gate_threshold", e.target.value)}
                  className="h-8 text-sm bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground">Hard floor to drop audio (Default: 0.003)</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">2. Auto-Standby & Silence Detection</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="silence_chunks" className="text-xs">Silence Chunks</Label>
                <Input
                  id="silence_chunks"
                  type="number"
                  step="1"
                  value={config.silence_chunks}
                  onChange={(e) => handleChange("silence_chunks", e.target.value)}
                  className="h-8 text-sm bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground">Time before cutting off (~45 chunks = 1.0s)</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min_speech_chunks" className="text-xs">Min Speech Chunks</Label>
                <Input
                  id="min_speech_chunks"
                  type="number"
                  step="1"
                  value={config.min_speech_chunks}
                  onChange={(e) => handleChange("min_speech_chunks", e.target.value)}
                  className="h-8 text-sm bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground">Prevents accidental triggers (Default: 7)</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pre_speech_chunks" className="text-xs">Pre-Speech Chunks</Label>
                <Input
                  id="pre_speech_chunks"
                  type="number"
                  step="1"
                  value={config.pre_speech_chunks}
                  onChange={(e) => handleChange("pre_speech_chunks", e.target.value)}
                  className="h-8 text-sm bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground">Buffer to avoid cutting first word (Default: 12)</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} className="h-8 rounded-full px-4 text-xs">
            <SaveIcon className="h-3 w-3 mr-2" />
            Save Configuration
          </Button>
        </div>
      </Card>
    </div>
  );
};
