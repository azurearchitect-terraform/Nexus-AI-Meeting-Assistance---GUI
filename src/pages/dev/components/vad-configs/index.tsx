import { useState, useEffect } from "react";
import { useApp } from "@/hooks";
import { Header, Card, Label, Input, Button, Slider } from "@/components";
import { SaveIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, MicIcon } from "lucide-react";
import { VadConfig } from "@/hooks/useSystemAudio";

export const VADConfigs = () => {
  const { systemAudio } = useApp();
  const { vadConfig, updateVadConfiguration } = systemAudio;

  const [config, setConfig] = useState<VadConfig>(vadConfig);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setConfig(vadConfig);
  }, [vadConfig]);

  // Convert chunks to seconds: (chunks * hop_size) / 44100
  const hopSize = config.hop_size || 1024;
  const sampleRate = 44100;
  const pauseSeconds = ((config.silence_chunks * hopSize) / sampleRate);

  const handleSecondsChange = (seconds: number) => {
    const chunks = Math.max(15, Math.round((seconds * sampleRate) / hopSize));
    setConfig((prev) => ({
      ...prev,
      silence_chunks: chunks,
    }));
    setIsSaved(false);
  };

  const handlePresetSelect = (seconds: number) => {
    handleSecondsChange(seconds);
  };

  const handleSensitivityPreset = (level: "quiet" | "normal" | "loud") => {
    if (level === "quiet") {
      setConfig((prev) => ({
        ...prev,
        sensitivity_rms: 0.008,
        noise_gate_threshold: 0.002,
      }));
    } else if (level === "normal") {
      setConfig((prev) => ({
        ...prev,
        sensitivity_rms: 0.012,
        noise_gate_threshold: 0.003,
      }));
    } else {
      setConfig((prev) => ({
        ...prev,
        sensitivity_rms: 0.016,
        noise_gate_threshold: 0.005,
      }));
    }
    setIsSaved(false);
  };

  const handleRawChange = (key: keyof VadConfig, value: string) => {
    setConfig((prev: VadConfig) => ({
      ...prev,
      [key]: key === "enabled" ? value === "true" : Number(value),
    }));
    setIsSaved(false);
  };

  const handleSave = () => {
    updateVadConfiguration(config);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div id="vad-configs" className="space-y-4">
      <Header
        title="Speech & Pause Settings (Voice Detection)"
        description="Configure how long the AI waits during pauses before answering, and how sensitive it is to human voice."
        isMainTitle
      />

      <Card className="p-5 border-border/50 bg-background/50 space-y-6">
        {/* Primary User Setting: Pause Duration */}
        <div className="space-y-3 pb-5 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-primary" />
              <div>
                <h4 className="text-sm font-semibold">Pause Wait Time (Silence Duration)</h4>
                <p className="text-xs text-muted-foreground">
                  How long the speaker can pause to breathe or think before the AI begins answering.
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-primary font-mono">
                {pauseSeconds.toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Slider */}
          <div className="pt-2">
            <Slider
              value={[pauseSeconds]}
              onValueChange={([val]) => handleSecondsChange(val)}
              min={0.6}
              max={3.5}
              step={0.1}
              className="w-full cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
              <span>0.6s (Very fast / interrupts pauses)</span>
              <span>1.8s (Balanced / Recommended)</span>
              <span>3.5s (Very patient)</span>
            </div>
          </div>

          {/* Quick 1-Click Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <button
              type="button"
              onClick={() => handlePresetSelect(1.0)}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                Math.abs(pauseSeconds - 1.0) < 0.15
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border/50 hover:bg-muted/40 text-foreground/80"
              }`}
            >
              <div className="text-xs font-semibold">1.0s — Quick Pace</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Fast back-and-forth; good for quick one-line questions.
              </div>
            </button>

            <button
              type="button"
              onClick={() => handlePresetSelect(1.8)}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                Math.abs(pauseSeconds - 1.8) < 0.15
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border/50 hover:bg-muted/40 text-foreground/80"
              }`}
            >
              <div className="text-xs font-semibold">1.8s — Recommended ⭐</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Ideal for interviews. Allows taking a breath and thinking.
              </div>
            </button>

            <button
              type="button"
              onClick={() => handlePresetSelect(2.5)}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                Math.abs(pauseSeconds - 2.5) < 0.15
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border/50 hover:bg-muted/40 text-foreground/80"
              }`}
            >
              <div className="text-xs font-semibold">2.5s — Thoughtful Speaker</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Best if the speaker pauses a lot between thoughts.
              </div>
            </button>
          </div>
        </div>

        {/* Voice Sensitivity Section */}
        <div className="space-y-3 pb-5 border-b border-border/40">
          <div className="flex items-center gap-2">
            <MicIcon className="h-4 w-4 text-primary" />
            <div>
              <h4 className="text-sm font-semibold">Voice Sensitivity</h4>
              <p className="text-xs text-muted-foreground">
                How clearly someone must speak. If the app stops listening when someone speaks softly, choose Quiet Voice.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleSensitivityPreset("quiet")}
              className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                config.sensitivity_rms <= 0.009
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border/50 hover:bg-muted/40 text-foreground/80"
              }`}
            >
              <div className="text-xs font-semibold">Quiet Voices</div>
              <div className="text-[10px] text-muted-foreground">Catches soft speech</div>
            </button>

            <button
              type="button"
              onClick={() => handleSensitivityPreset("normal")}
              className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                config.sensitivity_rms > 0.009 && config.sensitivity_rms < 0.015
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border/50 hover:bg-muted/40 text-foreground/80"
              }`}
            >
              <div className="text-xs font-semibold">Normal (Default)</div>
              <div className="text-[10px] text-muted-foreground">Balanced for meetings</div>
            </button>

            <button
              type="button"
              onClick={() => handleSensitivityPreset("loud")}
              className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                config.sensitivity_rms >= 0.015
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border/50 hover:bg-muted/40 text-foreground/80"
              }`}
            >
              <div className="text-xs font-semibold">Noisy Environment</div>
              <div className="text-[10px] text-muted-foreground">Ignores room chatter</div>
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Technical Parameters */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1"
          >
            <span>Advanced Engineering Parameters (Raw Chunks & Thresholds)</span>
            {showAdvanced ? (
              <ChevronUpIcon className="w-3.5 h-3.5" />
            ) : (
              <ChevronDownIcon className="w-3.5 h-3.5" />
            )}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="silence_chunks" className="text-xs">Silence Chunks</Label>
                <Input
                  id="silence_chunks"
                  type="number"
                  step="1"
                  value={config.silence_chunks}
                  onChange={(e) => handleRawChange("silence_chunks", e.target.value)}
                  className="h-8 text-sm bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground">Raw chunks (45 chunks ≈ 1.0s)</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sensitivity_rms" className="text-xs">RMS Sensitivity</Label>
                <Input
                  id="sensitivity_rms"
                  type="number"
                  step="0.001"
                  value={config.sensitivity_rms}
                  onChange={(e) => handleRawChange("sensitivity_rms", e.target.value)}
                  className="h-8 text-sm bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground">Lower = more sensitive (Default: 0.012)</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="noise_gate_threshold" className="text-xs">Noise Gate</Label>
                <Input
                  id="noise_gate_threshold"
                  type="number"
                  step="0.001"
                  value={config.noise_gate_threshold}
                  onChange={(e) => handleRawChange("noise_gate_threshold", e.target.value)}
                  className="h-8 text-sm bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground">Hard floor to drop audio (Default: 0.003)</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="peak_threshold" className="text-xs">Peak Threshold</Label>
                <Input
                  id="peak_threshold"
                  type="number"
                  step="0.001"
                  value={config.peak_threshold}
                  onChange={(e) => handleRawChange("peak_threshold", e.target.value)}
                  className="h-8 text-sm bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground">Filters sudden loud pops (Default: 0.035)</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="min_speech_chunks" className="text-xs">Min Speech Chunks</Label>
                <Input
                  id="min_speech_chunks"
                  type="number"
                  step="1"
                  value={config.min_speech_chunks}
                  onChange={(e) => handleRawChange("min_speech_chunks", e.target.value)}
                  className="h-8 text-sm bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground">Prevents noise triggers (Default: 7)</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pre_speech_chunks" className="text-xs">Pre-Speech Chunks</Label>
                <Input
                  id="pre_speech_chunks"
                  type="number"
                  step="1"
                  value={config.pre_speech_chunks}
                  onChange={(e) => handleRawChange("pre_speech_chunks", e.target.value)}
                  className="h-8 text-sm bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground">Buffer for first word (Default: 12)</p>
              </div>
            </div>
          )}
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <p className="text-xs text-muted-foreground">
            Changes take effect immediately on active meeting audio.
          </p>
          <Button 
            onClick={handleSave} 
            className={`h-9 rounded-full px-5 text-xs font-semibold cursor-pointer transition-all ${
              isSaved ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
            }`}
          >
            {isSaved ? (
              <>
                <CheckIcon className="h-3.5 w-3.5 mr-1.5" />
                Saved Successfully!
              </>
            ) : (
              <>
                <SaveIcon className="h-3.5 w-3.5 mr-1.5" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};
