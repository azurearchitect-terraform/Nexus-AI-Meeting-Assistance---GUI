import { useState } from "react";
import { SettingsIcon, LockIcon, MonitorUpIcon, ShieldAlertIcon, SlidersHorizontalIcon } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components";
import { useScreenSharing } from "@/hooks";

interface SettingsButtonProps {
  compact?: boolean;
}

export const SettingsButton = ({ compact = false }: SettingsButtonProps) => {
  const { isScreenSharing, isAutoLocked, toggleScreenSharing } = useScreenSharing();
  const [showWarning, setShowWarning] = useState(false);

  const handleOpenSettings = async () => {
    if (isScreenSharing) {
      setShowWarning(true);
      setTimeout(() => setShowWarning(false), 4500);
      return;
    }

    try {
      await invoke("open_dashboard");
    } catch (error) {
      console.error("Failed to open dashboard:", error);
    }
  };

  return (
    <div className="relative flex items-center gap-1.5 shrink-0 select-none">
      {/* Screen Sharing Mode Toggle Pill */}
      <button
        type="button"
        onClick={() => toggleScreenSharing()}
        className={`h-7 px-2 rounded-lg text-[10px] font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
          isScreenSharing
            ? "bg-rose-500/15 text-rose-400 border-rose-500/40 hover:bg-rose-500/25 shadow-[0_0_8px_rgba(244,63,94,0.25)]"
            : "bg-background/60 text-muted-foreground border-border/50 hover:bg-muted/80 hover:text-foreground"
        }`}
        title={
          isScreenSharing
            ? isAutoLocked
              ? "Screen sharing protection is AUTO-ENGAGED due to active audio capture. Settings locked. Click to override."
              : "Screen sharing mode is ACTIVE: Settings locked to protect credentials. Click to turn off."
            : "Click to enable Screen Sharing protection (locks settings and guards against window exposure)."
        }
      >
        <MonitorUpIcon className={`h-3 w-3 ${isScreenSharing ? "text-rose-400 animate-pulse" : "opacity-70"}`} />
        <span>{isScreenSharing ? (isAutoLocked ? "Screen Sharing (Auto)" : "Screen Sharing") : "Normal"}</span>
      </button>

      {/* Settings Button */}
      <Button
        variant="ghost"
        size="sm"
        disabled={isScreenSharing}
        onClick={handleOpenSettings}
        className={`h-7 px-2 rounded-lg border text-xs font-medium flex items-center gap-1 transition-all ${
          isScreenSharing
            ? "opacity-50 cursor-not-allowed border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/10 hover:text-rose-400"
            : "border-border/50 bg-background/60 hover:bg-muted/80 text-foreground/80 hover:text-foreground cursor-pointer"
        }`}
        title={
          isScreenSharing
            ? "Settings window is restricted during screen sharing. Click to see options."
            : "Open Settings & Dashboard"
        }
      >
        {isScreenSharing ? (
          <LockIcon className="h-3 w-3 text-rose-400" />
        ) : (
          <SettingsIcon className="h-3.5 w-3.5" />
        )}
        {!compact && <span className="hidden sm:inline">Settings</span>}
      </Button>

      {/* Warning Alert Floating Bubble */}
      {showWarning && (
        <div className="absolute right-0 bottom-full mb-2 w-68 p-3 rounded-xl border border-rose-500/50 bg-background/95 backdrop-blur-xl shadow-2xl text-rose-400 text-xs z-[9999] flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start gap-2">
            <ShieldAlertIcon className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-rose-400 text-[11px] leading-tight">Settings Window Restricted</p>
              <p className="text-muted-foreground text-[10px] leading-snug">
                Full Settings &amp; Dashboard are restricted during active screen sharing to prevent credential leakage.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowWarning(false);
              window.dispatchEvent(new CustomEvent("nexus_open_quick_ai_settings"));
            }}
            className="w-full py-1.5 px-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <SlidersHorizontalIcon className="h-3 w-3" />
            <span>Configure Gemini &amp; GPT on Overlay</span>
          </button>
        </div>
      )}
    </div>
  );
};
