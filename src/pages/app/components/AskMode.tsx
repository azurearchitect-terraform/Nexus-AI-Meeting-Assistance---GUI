import { useState } from "react";
import { Button, Markdown } from "@/components";
import { ActionToolbar } from "./ActionToolbar";
import { useApp as useAppHook, useChatCompletion } from "@/hooks";
import {
  MicIcon,
  ImageIcon,
  ArrowUpIcon,
  UserIcon,
  SparklesIcon,
  Loader2,
  XIcon,
} from "lucide-react";
import { ChatConversation } from "@/types";
import moment from "moment";

export const AskMode = () => {
  const [messages, setMessages] = useState<ChatConversation | null>(null);
  const { systemAudio } = useAppHook();
  const { capturing, startCapture, stopCapture } = systemAudio;
  
  // We use a blank conversationId for a fresh chat session in Ask mode
  const completion = useChatCompletion("", messages, setMessages);

  const handleLibraryClick = () => {
    const fileInput = document.getElementById("folder-upload");
    if (fileInput) {
      fileInput.click();
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    let contextStr = "";
    
    for (const file of files) {
      // Filter text-based source files
      if (
        file.name.match(/\.(txt|md|js|ts|tsx|jsx|json|csv|py|java|c|cpp|go|rs|html|css)$/i) || 
        file.type.startsWith("text/")
      ) {
        if (contextStr.length > 50000) break; // 50k char limit safeguard
        const text = await file.text();
        contextStr += `\n\n--- ${file.webkitRelativePath || file.name} ---\n${text}`;
      }
    }
    
    if (contextStr) {
      const existing = completion.input ? completion.input + "\n" : "";
      completion.setInput(existing + "Here is some context from my local folder:" + contextStr);
    }
    // reset input
    e.target.value = "";
  };

  const handleAttachClick = () => {
    // We can programmatically click the hidden file input
    const fileInput = document.getElementById("ask-file-upload");
    if (fileInput) {
      fileInput.click();
    }
  };

  const handleSelectionClick = () => {
    completion.setScreenshotConfiguration({ ...completion.screenshotConfiguration, enabled: false });
    setTimeout(() => {
      completion.captureScreenshot();
    }, 50);
  };

  const handleCaptureClick = () => {
    completion.setScreenshotConfiguration({ ...completion.screenshotConfiguration, enabled: true, mode: "manual" });
    setTimeout(() => {
      completion.captureScreenshot();
    }, 50);
  };

  const handlePushToTalkToggle = () => {
    if (capturing) {
      stopCapture();
    } else {
      startCapture();
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden p-4">
      {/* Chat Area */}
      <div className="flex-1 min-h-0 overflow-y-auto py-4 pr-2 flex flex-col">
        {messages?.messages && messages.messages.length > 0 ? (
          <div className="flex flex-col gap-6 w-full">
            {messages.messages.map((message, index) => (
              <div key={message.id} className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  {message.role === "user" ? (
                    <UserIcon className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <SparklesIcon className="h-3 w-3 text-primary" />
                  )}
                  <span className="text-xs font-semibold tracking-wider opacity-70">
                    {message.role.toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {moment(message.timestamp).format("hh:mm A")}
                  </span>
                </div>
                <div className="text-sm text-foreground leading-relaxed">
                  <Markdown isStreaming={completion.isLoading && message.role === "assistant" && index === messages.messages.length - 1}>
                    {message.content}
                  </Markdown>
                </div>
              </div>
            ))}
            <div ref={completion.messagesEndRef} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2">
            <SparklesIcon className="h-10 w-10 mb-2" />
            <p>How can I help you today?</p>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border/50 pt-3 flex flex-col gap-3">
        <div className="flex items-center gap-3 w-full">
          <Button 
            variant={capturing ? "default" : "outline"} 
            onClick={handlePushToTalkToggle}
            className={`rounded-xl border-border/50 h-10 px-4 cursor-pointer transition-all shrink-0 font-medium ${
              capturing ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" : "bg-background/60 hover:bg-muted/80"
            }`}
          >
            <MicIcon className={`h-4 w-4 mr-2 ${capturing ? "text-white" : "text-primary"}`} />
            {capturing ? "Listening..." : "Push to talk"}
            <span className="ml-2 text-[10px] font-mono border border-border/50 bg-muted/60 rounded px-1.5 py-0.5 text-muted-foreground">Space</span>
          </Button>

          <div className="flex-1 min-w-0">
            <ActionToolbar 
              onCapture={handleCaptureClick}
              onSelection={handleSelectionClick}
              onAttach={handleAttachClick}
              onLibrary={handleLibraryClick}
              attachedFilesCount={completion.attachedFiles.length}
              isLoading={completion.isScreenshotLoading}
            />
          </div>
        </div>

        {/* Attached Files Preview */}
        {completion.attachedFiles.length > 0 && (
          <div className="flex gap-2 px-2 overflow-x-auto">
            {completion.attachedFiles.map((file) => (
              <div key={file.id} className="relative group rounded-md overflow-hidden border border-border bg-muted/50 w-12 h-12 flex-shrink-0">
                {file.type.startsWith("image/") ? (
                  <img src={`data:${file.type};base64,${file.base64}`} alt={file.name} className="object-cover w-full h-full" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-[10px] text-muted-foreground break-all px-1 text-center">
                    {file.name}
                  </div>
                )}
                <div 
                  className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                  onClick={() => completion.removeFile(file.id)}
                >
                  <XIcon className="h-4 w-4 text-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          type="file"
          id="ask-file-upload"
          multiple
          className="hidden"
          onChange={completion.handleFileSelect}
          accept="image/*"
        />

        <input
          type="file"
          id="folder-upload"
          className="hidden"
          onChange={handleFolderSelect}
          {...({ webkitdirectory: "true", directory: "true" } as any)}
        />

        <div className="relative flex items-center bg-background/50 border border-border/50 rounded-2xl p-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
          <textarea
            ref={completion.inputRef}
            value={completion.input}
            onChange={(e) => completion.setInput(e.target.value)}
            onKeyDown={completion.handleKeyPress}
            onPaste={completion.handlePaste}
            placeholder="Ask anything, or paste a screenshot..."
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none h-10 py-2.5 px-3 text-sm"
            rows={1}
            disabled={completion.isLoading}
          />
          
          <div className="flex items-center gap-2 px-2">
            <Button variant="outline" size="sm" className="h-8 rounded-full border-border/50 bg-background/50" onClick={handleAttachClick}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Use image
            </Button>
            <div className="text-xs text-muted-foreground border border-border/50 bg-muted/50 rounded px-1.5 py-0.5">
              ↵
            </div>
            <Button 
              size="icon" 
              className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90"
              onClick={() => completion.submit()}
              disabled={completion.isLoading || !completion.input.trim()}
            >
              {completion.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpIcon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
