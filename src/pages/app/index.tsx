import { useState, useEffect } from "react";
import { Updater, CustomCursor } from "@/components";
import { SystemAudio, Completion } from "./components";
import { useApp, useScreenSharing } from "@/hooks";
import { useApp as useAppContext } from "@/contexts";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorLayout } from "@/layouts";
import { getPlatform } from "@/lib";

import { OverlayTabBar } from "./components/OverlayTabBar";
import { AskMode } from "./components/AskMode";
import { ListenMode } from "./components/ListenMode";
import { IntelMode } from "./components/IntelMode";
import { QuickAiSettingsModal } from "./components/QuickAiSettingsModal";

const App = () => {
  const { isHidden, systemAudio } = useApp();
  const { setAutoLock } = useScreenSharing();
  const { customizable } = useAppContext();
  const platform = getPlatform();

  const [activeTab, setActiveTab] = useState<"ask" | "listen" | "intel">("listen");
  const [opacity, setOpacity] = useState<number>(() => {
    const saved = localStorage.getItem("nexus_app_transparency");
    return saved ? Number(saved) : 95;
  });

  const [isQuickAiModalOpen, setIsQuickAiModalOpen] = useState(false);

  // Option A: Auto-Lock Screen Sharing Protection during active meeting/audio capture
  useEffect(() => {
    if (systemAudio.capturing) {
      void setAutoLock(true);
    } else {
      void setAutoLock(false);
    }
  }, [systemAudio.capturing, setAutoLock]);

  // Listen for global request to open Gemini & GPT quick settings modal
  useEffect(() => {
    const handleOpenQuickSettings = () => {
      setIsQuickAiModalOpen(true);
    };

    window.addEventListener("nexus_open_quick_ai_settings", handleOpenQuickSettings);
    return () => {
      window.removeEventListener("nexus_open_quick_ai_settings", handleOpenQuickSettings);
    };
  }, []);

  useEffect(() => {
    const handleTransparencyChange = (e: CustomEvent<number>) => {
      if (typeof e.detail === "number") {
        setOpacity(e.detail);
      } else {
        const saved = localStorage.getItem("nexus_app_transparency");
        if (saved) setOpacity(Number(saved));
      }
    };

    window.addEventListener("nexus_transparency_changed" as any, handleTransparencyChange as any);
    return () => {
      window.removeEventListener("nexus_transparency_changed" as any, handleTransparencyChange as any);
    };
  }, []);

  return (
    <ErrorBoundary
      fallbackRender={() => {
        return <ErrorLayout isCompact />;
      }}
      resetKeys={["app-error"]}
      onReset={() => {
        console.log("Reset");
      }}
    >
      <div
        className={`w-screen h-screen flex overflow-hidden justify-center items-start ${
          isHidden ? "hidden pointer-events-none" : ""
        }`}
        data-tauri-drag-region
      >
        <div 
          data-slot="card" 
          style={{ opacity: opacity / 100 }}
          className="w-full h-full flex flex-col rounded-xl border border-border/50 shadow-2xl overflow-hidden transition-opacity duration-150 backdrop-blur-md"
        >
          
          <OverlayTabBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          <div className="flex-1 overflow-hidden">
            {activeTab === "ask" && <AskMode />}
            {activeTab === "listen" && <ListenMode />}
            {activeTab === "intel" && <IntelMode />}
          </div>

          {/* Quick AI & Model Settings Modal directly on Main Overlay */}
          <QuickAiSettingsModal
            open={isQuickAiModalOpen}
            onOpenChange={setIsQuickAiModalOpen}
          />

          {/* Hidden components that process audio/AI in the background */}
          <div className="hidden">
            <SystemAudio {...systemAudio} />
            <Completion isHidden={isHidden} />
            <Updater />
          </div>
        </div>

        {customizable.cursor.type === "invisible" && platform !== "linux" ? (
          <CustomCursor />
        ) : null}
      </div>
    </ErrorBoundary>
  );
};

export default App;
