import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const SCREENSHARING_STORAGE_KEY = "nexus_screensharing_active";
const SCREENSHARING_AUTOLOCKED_KEY = "nexus_screensharing_autolocked";

export const useScreenSharing = () => {
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(() => {
    return localStorage.getItem(SCREENSHARING_STORAGE_KEY) === "true";
  });

  const [isAutoLocked, setIsAutoLocked] = useState<boolean>(() => {
    return localStorage.getItem(SCREENSHARING_AUTOLOCKED_KEY) === "true";
  });

  // Sync with Rust backend on mount
  useEffect(() => {
    let isMounted = true;
    invoke<boolean>("get_screensharing_status")
      .then((status) => {
        if (isMounted) {
          setIsScreenSharing(status);
          localStorage.setItem(SCREENSHARING_STORAGE_KEY, String(status));
          setIsAutoLocked(localStorage.getItem(SCREENSHARING_AUTOLOCKED_KEY) === "true");
        }
      })
      .catch(() => {
        // Fallback silently if command is pending
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to backend and custom frontend events
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    listen<boolean>("screensharing-status-changed", (event) => {
      if (typeof event.payload === "boolean") {
        setIsScreenSharing(event.payload);
        localStorage.setItem(SCREENSHARING_STORAGE_KEY, String(event.payload));
        setIsAutoLocked(localStorage.getItem(SCREENSHARING_AUTOLOCKED_KEY) === "true");
      }
    }).then((unlisten) => {
      unlistenFn = unlisten;
    }).catch((err) => {
      console.warn("Failed to listen to screensharing-status-changed event:", err);
    });

    const handleCustomToggle = (e: any) => {
      if (typeof e.detail === "boolean") {
        setIsScreenSharing(e.detail);
        localStorage.setItem(SCREENSHARING_STORAGE_KEY, String(e.detail));
        setIsAutoLocked(localStorage.getItem(SCREENSHARING_AUTOLOCKED_KEY) === "true");
      }
    };
    window.addEventListener("nexus_screenshare_changed", handleCustomToggle);

    return () => {
      if (unlistenFn) unlistenFn();
      window.removeEventListener("nexus_screenshare_changed", handleCustomToggle);
    };
  }, []);

  const toggleScreenSharing = useCallback(async (explicitVal?: boolean) => {
    const nextVal = typeof explicitVal === "boolean" ? explicitVal : !isScreenSharing;
    // Explicit manual toggle removes auto-lock ownership
    setIsAutoLocked(false);
    localStorage.removeItem(SCREENSHARING_AUTOLOCKED_KEY);
    setIsScreenSharing(nextVal);
    localStorage.setItem(SCREENSHARING_STORAGE_KEY, String(nextVal));
    window.dispatchEvent(new CustomEvent("nexus_screenshare_changed", { detail: nextVal }));

    try {
      await invoke("set_screensharing_status", { active: nextVal });
    } catch (e) {
      console.error("Failed to sync screensharing status with backend:", e);
    }
  }, [isScreenSharing]);

  const setAutoLock = useCallback(async (active: boolean) => {
    const currentlySharing = localStorage.getItem(SCREENSHARING_STORAGE_KEY) === "true";
    const currentlyAutoLocked = localStorage.getItem(SCREENSHARING_AUTOLOCKED_KEY) === "true";

    if (active) {
      // Auto-lock when audio capture starts and screen sharing wasn't already manually enabled
      if (!currentlySharing) {
        setIsAutoLocked(true);
        localStorage.setItem(SCREENSHARING_AUTOLOCKED_KEY, "true");
        setIsScreenSharing(true);
        localStorage.setItem(SCREENSHARING_STORAGE_KEY, "true");
        window.dispatchEvent(new CustomEvent("nexus_screenshare_changed", { detail: true }));

        try {
          await invoke("set_screensharing_status", { active: true });
        } catch (e) {
          console.error("Failed to sync screensharing status with backend:", e);
        }
      }
    } else {
      // Auto-unlock when audio capture stops ONLY if it was auto-locked
      if (currentlyAutoLocked) {
        setIsAutoLocked(false);
        localStorage.removeItem(SCREENSHARING_AUTOLOCKED_KEY);
        setIsScreenSharing(false);
        localStorage.setItem(SCREENSHARING_STORAGE_KEY, "false");
        window.dispatchEvent(new CustomEvent("nexus_screenshare_changed", { detail: false }));

        try {
          await invoke("set_screensharing_status", { active: false });
        } catch (e) {
          console.error("Failed to sync screensharing status with backend:", e);
        }
      }
    }
  }, []);

  return {
    isScreenSharing,
    isAutoLocked,
    toggleScreenSharing,
    setAutoLock,
  };
};
