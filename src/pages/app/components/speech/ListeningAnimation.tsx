import React from "react";

interface ListeningWaveVisualizerProps {
  capturing: boolean;
  isSpeechActive: boolean;
  audioLevel?: number;
  isPaused?: boolean;
  className?: string;
}

/**
 * 16-bar real-time soundwave visualizer for the meeting audio dock.
 * Accurately conveys listening vs. active voice capture.
 */
export const ListeningWaveVisualizer: React.FC<ListeningWaveVisualizerProps> = ({
  capturing,
  isSpeechActive,
  audioLevel = 0,
  isPaused = false,
  className = "",
}) => {
  // Staggered base heights for natural audio frequency curve
  const barHeights = [
    30, 45, 65, 85, 95, 80, 60, 90, 100, 75, 85, 55, 70, 40, 50, 30
  ];

  return (
    <div
      className={`flex items-center gap-2 h-7 px-2.5 rounded-lg border transition-all duration-200 select-none ${
        !capturing || isPaused
          ? "bg-muted/30 border-border/40 text-muted-foreground"
          : isSpeechActive
          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)] animate-voice-glow"
          : "bg-green-500/10 border-green-500/25 text-green-400"
      } ${className}`}
      title={
        isPaused
          ? "Audio capture paused"
          : isSpeechActive
          ? "Speech detected - Voice is actively being captured"
          : capturing
          ? "Listening to system audio - Ready for speech"
          : "Audio capture stopped"
      }
    >
      {/* 16 Responsive Waveform Bars */}
      <div className="flex items-end justify-center gap-[2.5px] h-4 min-w-[72px]">
        {barHeights.map((baseHeight, i) => {
          let heightPercent = 18;
          let barClass = "bg-muted-foreground/30";

          if (capturing && !isPaused) {
            if (isSpeechActive) {
              // Energetic active bouncing with real audioLevel modulation
              const dynamicBoost = Math.min(100, Math.round(baseHeight * (0.6 + audioLevel * 0.8)));
              heightPercent = Math.max(25, dynamicBoost);
              barClass = "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-soundwave-active";
            } else {
              // Gentle rhythmic idle listening wave
              heightPercent = Math.max(18, Math.round(baseHeight * 0.45));
              barClass = "bg-green-500/80 animate-soundwave-idle";
            }
          } else if (isPaused) {
            heightPercent = 20;
            barClass = "bg-amber-400/60";
          }

          return (
            <div
              key={i}
              className={`w-[2.5px] rounded-full transition-all duration-100 ${barClass}`}
              style={{
                height: `${heightPercent}%`,
                animationDelay: `${(i * 0.06).toFixed(2)}s`,
              }}
            />
          );
        })}
      </div>

      {/* Real-time Status Badge */}
      <div className="flex items-center gap-1.5 pl-1 text-[10px] font-semibold tracking-wider uppercase shrink-0">
        {capturing && !isPaused ? (
          isSpeechActive ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="hidden sm:inline">Capturing Voice</span>
              <span className="sm:hidden">Speaking</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-green-400/90 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>Listening</span>
            </div>
          )
        ) : isPaused ? (
          <div className="flex items-center gap-1 text-amber-400/80">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span>Paused</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-muted-foreground/60">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            <span>Idle</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface MiniSoundWaveProps {
  capturing: boolean;
  isSpeechActive?: boolean;
  className?: string;
  barsCount?: number;
}

/**
 * Compact 3 to 4-bar soundwave icon for buttons, tabs, and headers.
 */
export const MiniSoundWave: React.FC<MiniSoundWaveProps> = ({
  capturing,
  isSpeechActive = false,
  className = "",
  barsCount = 4,
}) => {
  const bars = Array.from({ length: barsCount });

  return (
    <div
      className={`inline-flex items-end justify-center gap-[2px] h-3.5 w-4 ${className}`}
      aria-hidden="true"
    >
      {bars.map((_, i) => {
        let heightPercent = 25;
        let barClass = "bg-current opacity-40";

        if (capturing) {
          if (isSpeechActive) {
            heightPercent = (i === 1 || i === 2) ? 100 : 65;
            barClass = "bg-emerald-400 animate-soundwave-active";
          } else {
            heightPercent = (i % 2 === 0) ? 60 : 35;
            barClass = "bg-green-400 animate-soundwave-idle";
          }
        }

        return (
          <span
            key={i}
            className={`w-[2px] rounded-full transition-all duration-150 ${barClass}`}
            style={{
              height: `${heightPercent}%`,
              animationDelay: `${(i * 0.12).toFixed(2)}s`,
            }}
          />
        );
      })}
    </div>
  );
};
