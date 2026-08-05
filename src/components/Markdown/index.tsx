import React from "react";
import { Streamdown } from "streamdown";
import "katex/dist/katex.min.css";
import { openUrl } from "@tauri-apps/plugin-opener";

interface MarkdownRendererProps {
  children: string;
  isStreaming?: boolean;
}

export function Markdown({
  children = "",
  isStreaming = false,
}: MarkdownRendererProps) {
  // During streaming: instantly display raw text (no markdown parser buffering)
  // After streaming: render fully through Streamdown for rich formatting
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
 * Raw streaming text view — no markdown parser, zero buffering.
 * Renders each line as it arrives from the AI stream.
 * Preserves markdown characters visually (bullets, bold, code) as plain text
 * so the user can read line-by-line in real time.
 */
function StreamingTextView({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="streaming-text-view font-mono text-[0.85rem] leading-relaxed whitespace-pre-wrap break-words">
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1;
        return (
          <div key={i} className="streaming-line">
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
