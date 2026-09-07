import React from "react";
import { Streamdown } from "streamdown";
import "katex/dist/katex.min.css";
import { openUrl } from "@tauri-apps/plugin-opener";

interface MarkdownRendererProps {
  children?: string;
  isStreaming?: boolean;
}

export function Markdown({
  children = "",
  isStreaming = false,
}: MarkdownRendererProps) {
  // During streaming: instantly display raw text with smooth real-time typewriter animation
  // (bypasses heavy markdown parser/Shiki buffering so user can read line-by-line in real time)
  if (isStreaming) {
    return <StreamingTextView text={children} />;
  }

  return (
    <Streamdown
      mode="static"
      shikiTheme={["github-light", "github-dark"]}
      components={COMPONENTS as any}
      controls={{
        table: true,
        code: true,
        mermaid: {
          download: true,
          copy: true,
          fullscreen: false,
          panZoom: false,
        },
      }}
    >
      {children}
    </Streamdown>
  );
}

/**
 * Raw streaming text view with real-time smooth typewriter animation.
 * Zero markdown parser buffering, line-by-line typing animation.
 */
function StreamingTextView({ text }: { text: string }) {
  const [displayedLength, setDisplayedLength] = React.useState(0);
  const targetTextRef = React.useRef(text);
  const currentLengthRef = React.useRef(0);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    targetTextRef.current = text;

    // Reset if text was reset/cleared
    if (text.length < currentLengthRef.current) {
      currentLengthRef.current = 0;
      setDisplayedLength(0);
    }

    if (!timerRef.current && currentLengthRef.current < text.length) {
      timerRef.current = setInterval(() => {
        const target = targetTextRef.current;
        const current = currentLengthRef.current;

        if (current < target.length) {
          // Advance smoothly character by character (or faster if falling behind)
          const diff = target.length - current;
          const step = diff > 200 ? Math.ceil(diff / 8) : diff > 80 ? 4 : diff > 30 ? 2 : 1;
          const next = Math.min(target.length, current + step);
          currentLengthRef.current = next;
          setDisplayedLength(next);
        } else if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }, 15);
    }
  }, [text]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const visibleText = text.slice(0, displayedLength);
  const lines = visibleText.split("\n");

  return (
    <div className="streaming-text-view leading-relaxed whitespace-pre-wrap break-words text-foreground">
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1;
        return (
          <div key={i} className="streaming-line min-h-[1.25em]">
            {line}
            {isLast && (
              <span className="inline-block w-[2px] h-[1em] bg-primary align-middle ml-[1px] animate-pulse" />
            )}
          </div>
        );
      })}
    </div>
  );
}

const COMPONENTS = {
  a: ({ children, href, ...props }: any) => {
    const handleClick = async (e: React.MouseEvent) => {
      e.preventDefault();
      if (href) {
        try {
          await openUrl(href);
        } catch (error) {
          console.error("Failed to open URL:", error);
        }
      }
    };

    return (
      <a
        href={href}
        className="text-gray-600 underline underline-offset-2 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 cursor-pointer"
        onClick={handleClick}
        {...props}
      >
        {children}
      </a>
    );
  },
};
