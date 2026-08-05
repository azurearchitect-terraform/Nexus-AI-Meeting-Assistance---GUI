import {
  HomeIcon,
  MessageSquareIcon,
  HeadphonesIcon,
  LayoutDashboardIcon,
  HistoryIcon,
  SettingsIcon,
  GripIcon,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components";

interface OverlayTabBarProps {
  activeTab: "ask" | "listen";
  setActiveTab: (tab: "ask" | "listen") => void;
}

export const OverlayTabBar = ({
  activeTab,
  setActiveTab,
}: OverlayTabBarProps) => {
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
      className="flex w-full items-center justify-between border-b border-border/50 bg-background px-4 py-2 backdrop-blur"
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

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 border-l border-border/50 pl-4">
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

        <div className="flex items-center gap-1 border-l border-border/50 pl-4">
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
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" data-tauri-drag-region="true">
            <GripIcon className="h-4 w-4" data-tauri-drag-region="true" />
          </Button>
        </div>
      </div>
    </div>
  );
};
