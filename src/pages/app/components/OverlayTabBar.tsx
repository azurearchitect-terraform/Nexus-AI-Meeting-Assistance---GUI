import { useState, useEffect } from "react";
import {
  HomeIcon,
  MessageSquareIcon,
  HeadphonesIcon,
  LayoutDashboardIcon,
  HistoryIcon,
  SettingsIcon,
  GripIcon,
  SlidersHorizontalIcon,
  PlusIcon,
  MinusIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button, Popover, PopoverTrigger, PopoverContent, Slider } from "@/components";
import { useApp } from "@/contexts";
import { getAllPersistedProviderKeys, getPersistedProviderKey } from "@/lib/storage/provider-keys";

interface OverlayTabBarProps {
  activeTab: "ask" | "listen";
  setActiveTab: (tab: "ask" | "listen") => void;
}

export const OverlayTabBar = ({
  activeTab,
  setActiveTab,
}: OverlayTabBarProps) => {
  const { selectedAIProvider } = useApp();
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
  const isAiKeyMissing = !hasAutoKey && !hasNormalKey && selectedAIProvider?.provider !== "local";
  const [transparency, setTransparency] = useState<number>(() => {
    const saved = localStorage.getItem("nexus_app_transparency");
    return saved ? Number(saved) : 95;
  });

  useEffect(() => {
    const handleTransparencyChange = (e: CustomEvent<number>) => {
      if (typeof e.detail === "number") {
        setTransparency(e.detail);
      } else {
        const saved = localStorage.getItem("nexus_app_transparency");
        if (saved) setTransparency(Number(saved));
      }
    };

    window.addEventListener("nexus_transparency_changed" as any, handleTransparencyChange as any);
    return () => {
      window.removeEventListener("nexus_transparency_changed" as any, handleTransparencyChange as any);
    };
  }, []);

  const updateTransparency = (val: number) => {
    const clamped = Math.max(25, Math.min(100, Math.round(val)));
    setTransparency(clamped);
    localStorage.setItem("nexus_app_transparency", String(clamped));
    window.dispatchEvent(new CustomEvent("nexus_transparency_changed", { detail: clamped }));
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY < 0) {
      updateTransparency(transparency + 5);
    } else {
      updateTransparency(transparency - 5);
    }
  };

  const openDashboard = async () => {
    try {
      await invoke("open_dashboard");
    } catch (error) {
      console.error("Failed to open dashboard:", error);
    }
  };

  return (
    <div 
      data-tauri-drag-region="true"
      className="flex w-full items-center justify-between border-b border-border/50 bg-background/80 px-4 py-2 backdrop-blur shrink-0 select-none"
    >
      <div className="flex items-center gap-6" data-tauri-drag-region="true">
        <div className="flex items-center gap-2">
          <HomeIcon className="h-5 w-5" />
          <span className="font-semibold text-lg tracking-tight">Nexus</span>
        </div>

        <div className="flex items-center gap-1 border-l border-border/50 pl-6">
          <Button
            variant={activeTab === "ask" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("ask")}
            className="flex items-center gap-2 rounded-full px-4"
          >
            <MessageSquareIcon className="h-4 w-4" />
            <span>Ask</span>
          </Button>
          <Button
            variant={activeTab === "listen" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("listen")}
            className="flex items-center gap-2 rounded-full px-4"
          >
            <HeadphonesIcon className="h-4 w-4" />
            <span>Listen</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Transparency Control Popover with Scroll Wheel & Steppers */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onWheel={handleWheel}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border-border/60 hover:bg-muted/50 cursor-pointer select-none"
              title="Window Transparency (Click to open controls, or scroll mouse wheel over this button to adjust)"
            >
              <SlidersHorizontalIcon className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">{transparency}%</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            align="end" 
            onWheel={handleWheel}
            className="w-68 p-4 bg-background/95 backdrop-blur-2xl border border-border/80 rounded-xl shadow-2xl space-y-3 z-[9999]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground tracking-wide">WINDOW TRANSPARENCY</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateTransparency(transparency - 5)}
                  disabled={transparency <= 25}
                  className="h-5 w-5 rounded flex items-center justify-center bg-muted hover:bg-primary hover:text-primary-foreground text-muted-foreground disabled:opacity-30 transition-all cursor-pointer"
                  title="Decrease Opacity (-5%)"
                >
                  <MinusIcon className="h-3 w-3" />
                </button>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 min-w-[42px] text-center">
                  {transparency}%
                </span>
                <button
                  onClick={() => updateTransparency(transparency + 5)}
                  disabled={transparency >= 100}
                  className="h-5 w-5 rounded flex items-center justify-center bg-muted hover:bg-primary hover:text-primary-foreground text-muted-foreground disabled:opacity-30 transition-all cursor-pointer"
                  title="Increase Opacity (+5%)"
                >
                  <PlusIcon className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="py-1">
              <Slider
                value={[transparency]}
                onValueChange={(vals) => updateTransparency(vals[0])}
                min={25}
                max={100}
                step={5}
                className="w-full cursor-pointer"
              />
            </div>

            {/* Quick 1-Click Presets */}
            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-border/40">
              {[
                { label: "100% Solid", val: 100 },
                { label: "85% Glass", val: 85 },
                { label: "70% Clear", val: 70 },
                { label: "50% Stealth", val: 50 },
                { label: "35% Ghost", val: 35 },
                { label: "25% Min", val: 25 },
              ].map((p) => (
                <button
                  key={p.val}
                  onClick={() => updateTransparency(p.val)}
                  className={`px-2 py-1 text-[10px] font-semibold rounded-md border transition-all cursor-pointer text-center ${
                    transparency === p.val
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/40"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            
            <p className="text-[10px] text-muted-foreground/70 text-center italic">
              Tip: Scroll mouse wheel to adjust opacity
            </p>
          </PopoverContent>
        </Popover>

        {isAiKeyMissing && (
          <Button
            variant="outline"
            size="sm"
            onClick={openDashboard}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border-amber-500/50 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-400 cursor-pointer animate-pulse"
            title="AI API Key is missing. Click to open Settings and configure your API key."
          >
            <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-semibold text-[11px]">API Key Missing</span>
          </Button>
        )}

        <div className="flex items-center gap-2 border-l border-border/50 pl-3">
          <Button
            variant="outline"
            size="sm"
            onClick={openDashboard}
            className="flex items-center gap-2 rounded-full"
          >
            <LayoutDashboardIcon className="h-4 w-4" />
            Dashboard
          </Button>
        </div>

        <div className="flex items-center gap-1 border-l border-border/50 pl-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full"
            onClick={openDashboard}
          >
            <HistoryIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={openDashboard}
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full cursor-grab active:cursor-grabbing" data-tauri-drag-region="true">
            <GripIcon className="h-4 w-4 pointer-events-none" data-tauri-drag-region="true" />
          </Button>
        </div>
      </div>
    </div>
  );
};
