import React, { useState, useEffect, useRef } from "react";
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
  const [displayedText, setDisplayedText] = useState(isStreaming ? "" : children);
  const targetTextRef = useRef(children);
  const currentIndexRef = useRef(isStreaming ? 0 : children.length);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    targetTextRef.current = children;

    // If not streaming, update immediately
    if (!isStreaming) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setDisplayedText(children);
      currentIndexRef.current = children.length;
      return;
    }

    // If new text is shorter than current index (new query started), reset
    if (children.length < currentIndexRef.current) {
      currentIndexRef.current = 0;
      setDisplayedText("");
    }

    // Start typewriter loop if not active
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        const target = targetTextRef.current;
        const currentLen = currentIndexRef.current;

        if (currentLen < target.length) {
          const diff = target.length - currentLen;
          const step = diff > 40 ? 5 : diff > 15 ? 2 : 1;
          const nextIndex = Math.min(target.length, currentLen + step);
          currentIndexRef.current = nextIndex;
          setDisplayedText(target.slice(0, nextIndex));
        }
      }, 12);
    }
  }, [children, isStreaming]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const textToRender = isStreaming ? displayedText : children;

  return (
    <Streamdown
      mode={isStreaming ? "streaming" : "static"}
      parseIncompleteMarkdown={isStreaming}
      isAnimating={isStreaming}
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
      {textToRender}
    </Streamdown>
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
