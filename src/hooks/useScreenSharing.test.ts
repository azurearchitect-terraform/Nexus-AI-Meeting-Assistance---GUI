import { describe, expect, it, beforeEach } from "vitest";

const SCREENSHARING_STORAGE_KEY = "nexus_screensharing_active";
const SCREENSHARING_AUTOLOCKED_KEY = "nexus_screensharing_autolocked";

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, String(value)),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
};
globalThis.localStorage = localStorageMock as any;

// Helper to simulate the auto-lock state machine of useScreenSharing
class ScreenSharingSimulator {
  isScreenSharing: boolean;
  isAutoLocked: boolean;

  constructor() {
    this.isScreenSharing = localStorage.getItem(SCREENSHARING_STORAGE_KEY) === "true";
    this.isAutoLocked = localStorage.getItem(SCREENSHARING_AUTOLOCKED_KEY) === "true";
  }

  toggle(explicitVal?: boolean) {
    const nextVal = typeof explicitVal === "boolean" ? explicitVal : !this.isScreenSharing;
    this.isAutoLocked = false;
    localStorage.removeItem(SCREENSHARING_AUTOLOCKED_KEY);
    this.isScreenSharing = nextVal;
    localStorage.setItem(SCREENSHARING_STORAGE_KEY, String(nextVal));
  }

  setAutoLock(active: boolean) {
    const currentlySharing = localStorage.getItem(SCREENSHARING_STORAGE_KEY) === "true";
    const currentlyAutoLocked = localStorage.getItem(SCREENSHARING_AUTOLOCKED_KEY) === "true";

    if (active) {
      if (!currentlySharing) {
        this.isAutoLocked = true;
        localStorage.setItem(SCREENSHARING_AUTOLOCKED_KEY, "true");
        this.isScreenSharing = true;
        localStorage.setItem(SCREENSHARING_STORAGE_KEY, "true");
      }
    } else {
      if (currentlyAutoLocked) {
        this.isAutoLocked = false;
        localStorage.removeItem(SCREENSHARING_AUTOLOCKED_KEY);
        this.isScreenSharing = false;
        localStorage.setItem(SCREENSHARING_STORAGE_KEY, "false");
      }
    }
  }
}

describe("ScreenSharing Auto-Lock State Machine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("automatically engages screen sharing protection when audio capture starts", () => {
    const sim = new ScreenSharingSimulator();
    expect(sim.isScreenSharing).toBe(false);
    expect(sim.isAutoLocked).toBe(false);

    // Audio capture starts (Option A)
    sim.setAutoLock(true);
    expect(sim.isScreenSharing).toBe(true);
    expect(sim.isAutoLocked).toBe(true);

    // Audio capture stops (Option A)
    sim.setAutoLock(false);
    expect(sim.isScreenSharing).toBe(false);
    expect(sim.isAutoLocked).toBe(false);
  });

  it("does not turn off screen sharing on capture stop if user manually engaged it beforehand", () => {
    const sim = new ScreenSharingSimulator();
    
    // User manually clicks to enable screen sharing
    sim.toggle(true);
    expect(sim.isScreenSharing).toBe(true);
    expect(sim.isAutoLocked).toBe(false);

    // Audio starts
    sim.setAutoLock(true);
    expect(sim.isScreenSharing).toBe(true);
    expect(sim.isAutoLocked).toBe(false);

    // Audio stops -> screen sharing MUST stay on because user enabled it manually
    sim.setAutoLock(false);
    expect(sim.isScreenSharing).toBe(true);
    expect(sim.isAutoLocked).toBe(false);
  });

  it("allows user to manually override/turn off screen sharing during active audio capture", () => {
    const sim = new ScreenSharingSimulator();

    // Auto-lock engaged
    sim.setAutoLock(true);
    expect(sim.isScreenSharing).toBe(true);
    expect(sim.isAutoLocked).toBe(true);

    // User manually clicks toggle to turn it off
    sim.toggle(false);
    expect(sim.isScreenSharing).toBe(false);
    expect(sim.isAutoLocked).toBe(false);

    // Later audio capture stops -> remains false
    sim.setAutoLock(false);
    expect(sim.isScreenSharing).toBe(false);
    expect(sim.isAutoLocked).toBe(false);
  });
});
