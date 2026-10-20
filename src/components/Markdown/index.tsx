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
  // During streaming: instantly display text as tokens arrive from the AI
  // (bypasses heavy markdown parser/Shiki buffering so user reads in real time from first response)
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
 * Raw streaming text view that renders tokens instantly in real time with a live cursor.
 * Zero buffering, zero artificial character delay - starts displaying on first response.
 */
function StreamingTextView({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");

  return (
    <div className="streaming-text-view leading-relaxed whitespace-pre-wrap break-words text-foreground">
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1;
        return (
          <div key={i} className="streaming-line min-h-[1.25em]">
            {line}
            {isLast && (
              <span className="inline-block w-[2px] h-[1em] bg-primary align-middle ml-[2px] animate-pulse" />
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
