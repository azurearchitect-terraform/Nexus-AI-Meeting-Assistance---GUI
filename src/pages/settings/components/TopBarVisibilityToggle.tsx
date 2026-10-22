import { useState } from "react";
import { Switch, Label, Header } from "@/components";

interface TopBarVisibilityToggleProps {
  className?: string;
}

export const TopBarVisibilityToggle = ({ className }: TopBarVisibilityToggleProps) => {
  const [showDashboard, setShowDashboard] = useState<boolean>(() => {
    return localStorage.getItem("nexus_show_dashboard_button") === "true";
  });

  const [showHistory, setShowHistory] = useState<boolean>(() => {
    return localStorage.getItem("nexus_show_history_button") === "true";
  });

  const handleDashboardToggle = (checked: boolean) => {
    setShowDashboard(checked);
    localStorage.setItem("nexus_show_dashboard_button", String(checked));
    window.dispatchEvent(new CustomEvent("nexus_topbar_buttons_changed"));
  };

  const handleHistoryToggle = (checked: boolean) => {
    setShowHistory(checked);
    localStorage.setItem("nexus_show_history_button", String(checked));
    window.dispatchEvent(new CustomEvent("nexus_topbar_buttons_changed"));
  };

  return (
    <div id="topbar-visibility" className={`space-y-4 ${className}`}>
      <Header
        title="Top Bar Navigation Controls"
        description="Show or hide the Dashboard button and History/clock icon in the top header"
        isMainTitle
      />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Dashboard Button</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Show the Dashboard button in the top navigation bar
            </p>
          </div>
          <Switch
            checked={showDashboard}
            onCheckedChange={handleDashboardToggle}
            aria-label="Toggle Dashboard button visibility"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">History / Clock Icon</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Show the small history/clock icon in the top navigation bar
            </p>
          </div>
          <Switch
            checked={showHistory}
            onCheckedChange={handleHistoryToggle}
            aria-label="Toggle History button visibility"
          />
        </div>
      </div>
    </div>
  );
};
