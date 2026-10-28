import { useState, useEffect, useCallback } from "react";
import { PageLayout } from "@/layouts";
import {
  Trash2,
  Edit2,
  FileText,
  Loader2,
  Check,
  Briefcase,
  Sparkles,
  Upload,
  AlertCircle,
  Download,
} from "lucide-react";
import { Button } from "@/components";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addStoryItem,
  loadStoryBank,
  deleteStoryItem,
  updateStoryItem,
  StoryBankItem,
} from "@/lib/story-bank";

import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

if (typeof window !== "undefined") {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs?url",
    import.meta.url
  ).toString();
}

type UploadStatus = "idle" | "extracting" | "ready" | "error";

interface UploadedStoryFile {
  id: string;
  fileName: string;
  extractedText: string;
  uploadedAt: number;
}

const StoryBank = () => {
  const [stories, setStories] = useState<StoryBankItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    title?: string;
    summary?: string;
    situation?: string;
    task?: string;
    action?: string;
    result?: string;
    tags?: string;
  }>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Upload state
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [extractedText, setExtractedText] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  const [uploadedStoryFiles, setUploadedStoryFiles] = useState<UploadedStoryFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setStories(loadStoryBank());
  }, []);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const extractTextFromFile = useCallback(async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const textParts: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: any) => item.str)
          .join(" ");
        textParts.push(pageText);
      }
      return textParts.join("\n");
    }

    if (
      file.name.toLowerCase().endsWith(".docx") ||
      file.name.toLowerCase().endsWith(".doc")
    ) {
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }

    throw new Error("Unsupported file type. Please upload a PDF or Word document.");
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    const validExtensions = [".pdf", ".docx", ".doc"];
    const isValid =
      validTypes.includes(selectedFile.type) ||
      validExtensions.some((ext) =>
        selectedFile.name.toLowerCase().endsWith(ext)
      );

    if (!isValid) {
      setUploadError("Please upload a PDF or Word (.docx/.doc) file.");
      return;
    }

    setUploadError(null);
    setUploadStatus("extracting");
    setIsUploading(true);

    try {
      const text = await extractTextFromFile(selectedFile);
      setExtractedText(text);
      setUploadStatus("ready");
      setIsUploading(false);

      setUploadedStoryFiles((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          fileName: selectedFile.name,
          extractedText: text,
          uploadedAt: Date.now(),
        },
      ]);
    } catch (err: any) {
      setUploadError(err.message || "Failed to extract text from file.");
      setUploadStatus("idle");
      setIsUploading(false);
    }
  };

  const handleSaveToStory = async () => {
    if (!extractedText.trim() || !storyTitle.trim()) return;

    setUploadStatus("ready");

    const story: Omit<StoryBankItem, "id" | "createdAt"> = {
      title: storyTitle.trim(),
      summary: extractedText.trim().slice(0, 200),
      situation: "",
      task: "",
      action: "",
      result: "",
      metrics: [],
      tags: ["resume", "uploaded", storyTitle.trim().split(" ")[0]],
      roleFocus: "mixed",
    };

    addStoryItem(story);
    setStories(loadStoryBank());
    setStoryTitle("");
    setExtractedText("");
    setUploadStatus("idle");
    setUploadError(null);

    setStatusMessage("Story saved from uploaded document.");
  };

  const handleDownloadStoryFile = (file: UploadedStoryFile) => {
    const blob = new Blob([file.extractedText], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.fileName.replace(/\.[^/.]+$/, "")}_extracted.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startEdit = (story: StoryBankItem) => {
    setEditingId(story.id);
    setEditValues({
      title: story.title,
      summary: story.summary,
      situation: story.situation,
      task: story.task,
      action: story.action,
      result: story.result,
      tags: story.tags.join(", "),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(id);
    try {
      const tags = editValues.tags
        ? editValues.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      const updated = updateStoryItem(id, {
        title: editValues.title || "",
        summary: editValues.summary || "",
        situation: editValues.situation || "",
        task: editValues.task || "",
        action: editValues.action || "",
        result: editValues.result || "",
        tags,
      });
      if (updated) {
        setStories(loadStoryBank());
        setEditingId(null);
        setEditValues({});
        setStatusMessage("Story updated successfully.");
      }
    } catch (err: any) {
      setStatusMessage(err.message || "Failed to update story.");
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this story? This cannot be undone.")) return;
    deleteStoryItem(id);
    setStories(loadStoryBank());
    setStatusMessage("Story deleted.");
  };

  return (
    <PageLayout
      title="Story Bank"
      description="Manage your STAR stories. Upload PDF/Word documents or create stories manually. Stories are automatically used by AI for behavioral and 'Tell me about yourself' answers."
    >
      <div className="max-w-5xl mx-auto py-6 space-y-8">
        {/* Upload Card */}
        <Card className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload Document to Story Bank
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Upload PDF or Word documents to convert them into STAR stories for your Story Bank.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-xl p-8 text-center transition-colors hover:border-primary">
                <input
                  type="file"
                  id="story-upload"
                  accept=".pdf,.docx,.doc"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <label
                  htmlFor="story-upload"
                  className="flex flex-col items-center gap-2 cursor-pointer"
                >
                  <div className="flex flex-col items-center gap-2">
                    {isUploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : (
                      <FileText className="h-10 w-10 text-muted-foreground/40" />
                    )}
                    <p className="text-sm font-medium">
                      {isUploading
                        ? "Extracting text..."
                        : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF or Word document
                    </p>
                  </div>
                </label>
              </div>

              {uploadError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  {uploadError}
                </div>
              )}

              {uploadStatus === "ready" && extractedText && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Story Title
                    </label>
                    <input
                      type="text"
                      value={storyTitle}
                      onChange={(e) => setStoryTitle(e.target.value)}
                      placeholder="e.g. Leadership - Azure Migration at Tech Corp"
                      className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Extracted Text Preview
                    </label>
                    <textarea
                      value={extractedText}
                      onChange={(e) => setExtractedText(e.target.value)}
                      rows={8}
                      className="w-full rounded-xl border border-input bg-muted/50 px-4 py-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      {extractedText.length} characters extracted.
                    </p>
                  </div>

                  <Button
                    onClick={handleSaveToStory}
                    disabled={!storyTitle.trim()}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Save to Story Bank
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add Manual Story Section */}
        <Card className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Add Manual Story
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Create a STAR story manually.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Story Title
                </label>
                <input
                  type="text"
                  value={editValues.title || ""}
                  onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                  placeholder="e.g. Led migration to Azure Kubernetes"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={editValues.tags || ""}
                  onChange={(e) => setEditValues({ ...editValues, tags: e.target.value })}
                  placeholder="e.g. leadership, azure, migration"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Situation
                </label>
                <textarea
                  value={editValues.situation || ""}
                  onChange={(e) => setEditValues({ ...editValues, situation: e.target.value })}
                  rows={2}
                  placeholder="What was the context?"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Task
                </label>
                <textarea
                  value={editValues.task || ""}
                  onChange={(e) => setEditValues({ ...editValues, task: e.target.value })}
                  rows={2}
                  placeholder="What needed to be done?"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Action
                </label>
                <textarea
                  value={editValues.action || ""}
                  onChange={(e) => setEditValues({ ...editValues, action: e.target.value })}
                  rows={2}
                  placeholder="What did you do?"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Result
                </label>
                <textarea
                  value={editValues.result || ""}
                  onChange={(e) => setEditValues({ ...editValues, result: e.target.value })}
                  rows={2}
                  placeholder="What was the outcome? Include metrics."
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Summary
                </label>
                <textarea
                  value={editValues.summary || ""}
                  onChange={(e) => setEditValues({ ...editValues, summary: e.target.value })}
                  rows={2}
                  placeholder="One-line summary of this story"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <div className="col-span-2 flex justify-end">
                <Button
                  onClick={() => {
                    if (!editingId) {
                      const newStory: Omit<StoryBankItem, "id" | "createdAt"> = {
                        title: editValues.title || "",
                        summary: editValues.summary || "",
                        situation: editValues.situation || "",
                        task: editValues.task || "",
                        action: editValues.action || "",
                        result: editValues.result || "",
                        metrics: [],
                        tags: editValues.tags
                          ? editValues.tags.split(",").map((t) => t.trim()).filter(Boolean)
                          : [],
                        roleFocus: "mixed",
                      };
                      addStoryItem(newStory);
                      setStories(loadStoryBank());
                      setEditValues({});
                      setStatusMessage("Story added to Story Bank.");
                    } else {
                      handleSaveEdit(editingId);
                    }
                  }}
                  disabled={saving === editingId}
                  className="w-full"
                >
                  {saving === editingId ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : editingId ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Update Story
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Add Story
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelEdit}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Previously Uploaded Story Files */}
        {uploadedStoryFiles.length > 0 && (
          <Card className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Previously Uploaded Story Documents ({uploadedStoryFiles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {uploadedStoryFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {file.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {file.extractedText.length} chars •
                          {" "}
                          {new Date(file.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleDownloadStoryFile(file)}
                        className="h-8 w-8"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() =>
                          setUploadedStoryFiles(
                            uploadedStoryFiles.filter((r) => r.id !== file.id)
                          )
                        }
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stories List */}
        <Card className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Your Stories ({stories.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-10 w-10 mb-2 opacity-40" />
                <p>No stories yet.</p>
                <p className="text-xs mt-2">
                  Upload a document above or add a story manually.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stories.map((story) => (
                  <div
                    key={story.id}
                    className="rounded-xl border border-border bg-muted/50 p-4"
                  >
                    {editingId === story.id ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Title
                          </label>
                          <input
                            value={editValues.title || story.title}
                            onChange={(e) =>
                              setEditValues({ ...editValues, title: e.target.value })
                            }
                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Summary
                          </label>
                          <textarea
                            value={editValues.summary || story.summary}
                            onChange={(e) =>
                              setEditValues({ ...editValues, summary: e.target.value })}
                            rows={2}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Situation
                          </label>
                          <textarea
                            value={editValues.situation || story.situation}
                            onChange={(e) =>
                              setEditValues({ ...editValues, situation: e.target.value })}
                            rows={2}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Task
                          </label>
                          <textarea
                            value={editValues.task || story.task}
                            onChange={(e) =>
                              setEditValues({ ...editValues, task: e.target.value })}
                            rows={2}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Action
                          </label>
                          <textarea
                            value={editValues.action || story.action}
                            onChange={(e) =>
                              setEditValues({ ...editValues, action: e.target.value })}
                            rows={2}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Result
                          </label>
                          <textarea
                            value={editValues.result || story.result}
                            onChange={(e) =>
                              setEditValues({ ...editValues, result: e.target.value })}
                            rows={2}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleSaveEdit(story.id)}
                            disabled={saving === story.id}
                            className="w-full"
                          >
                            {saving === story.id ? "Saving..." : "Save Changes"}
                          </Button>
                          <Button variant="outline" onClick={cancelEdit} className="w-full">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {story.title}
                          </p>
                          {story.summary && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {story.summary}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-1">
                            {story.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs text-foreground font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 flex gap-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              {story.roleFocus}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {new Date(story.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => startEdit(story)}
                            className="h-8 w-8"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => handleDelete(story.id)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default StoryBank;
