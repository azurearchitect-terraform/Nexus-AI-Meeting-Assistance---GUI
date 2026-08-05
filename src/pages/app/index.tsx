import { useState } from "react";
import { Updater, CustomCursor } from "@/components";
import { SystemAudio, Completion } from "./components";
import { useApp } from "@/hooks";
import { useApp as useAppContext } from "@/contexts";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorLayout } from "@/layouts";
import { getPlatform } from "@/lib";

import { OverlayTabBar } from "./components/OverlayTabBar";
import { AskMode } from "./components/AskMode";
import { ListenMode } from "./components/ListenMode";

const App = () => {
  const { isHidden, systemAudio } = useApp();
  const { customizable } = useAppContext();
  const platform = getPlatform();

  const [activeTab, setActiveTab] = useState<"ask" | "listen">("listen");

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
        <div data-slot="card" className="w-full h-full flex flex-col rounded-xl border border-border/50 shadow-2xl overflow-hidden">
          
          <OverlayTabBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          <div className="flex-1 overflow-hidden">
            {activeTab === "ask" && <AskMode />}
            {activeTab === "listen" && <ListenMode />}
          </div>

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
