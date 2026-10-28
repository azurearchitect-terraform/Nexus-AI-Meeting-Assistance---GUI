import React, { useState, useEffect, useCallback } from "react";
import { PageLayout } from "@/layouts";
import {
  FileText,
  Upload,
  Check,
  Trash2,
  Loader2,
  Download,
  Eye,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addStoryItem,
  loadStoryBank,
  deleteStoryItem,
  StoryBankItem,
} from "@/lib/story-bank";

import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

if (typeof window !== "undefined") {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.js",
    import.meta.url
  ).toString();
}

type UploadStatus = "idle" | "extracting" | "ready" | "saved" | "error";

interface UploadedResume {
  id: string;
  fileName: string;
  fileType: string;
  extractedText: string;
  uploadedAt: number;
}

const ResumeUpload = () => {
const [status, setStatus] = useState<UploadStatus>("idle");
const [extractedText, setExtractedText] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  const [stories, setStories] = useState<StoryBankItem[]>([]);
  const [uploadedResumes, setUploadedResumes] = useState<UploadedResume[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    setStories(loadStoryBank());
  }, []);

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
      setError("Please upload a PDF or Word (.docx/.doc) file.");
      return;
    }
    setError(null);

    setStatus("extracting");
    setIsExtracting(true);

    try {
      const text = await extractTextFromFile(selectedFile);
      setExtractedText(text);
      setStatus("ready");
      setIsExtracting(false);

      const existing = uploadedResumes.find((r) => r.fileName === selectedFile.name);
      if (!existing) {
        setUploadedResumes((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            fileName: selectedFile.name,
            fileType: selectedFile.type,
            extractedText: text,
            uploadedAt: Date.now(),
          },
        ]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to extract text from file.");
      setStatus("idle");
      setIsExtracting(false);
    }
  };

  const handleSaveToStory = async () => {
    if (!extractedText.trim() || !storyTitle.trim()) return;

    setStatus("saved");

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
    setStatus("idle");

    setTimeout(() => setStatus("idle"), 2000);
  };

  const handleDeleteStory = (id: string) => {
    deleteStoryItem(id);
    setStories(loadStoryBank());
  };

  const handleDownloadResume = (resume: UploadedResume) => {
    const blob = new Blob([resume.extractedText], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${resume.fileName.replace(/\.[^/.]+$/, "")}_extracted.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <PageLayout
      title="Resume & Story Upload"
      description="Upload your resume (PDF or Word) to build your story bank for 'Tell me about yourself' answers."
    >
      <div className="max-w-5xl mx-auto py-6 space-y-8">
        {/* Upload Card */}
        <Card className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload Resume or Story Document
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Supports PDF (.pdf) and Word (.docx, .doc). Extracted text will be saved to your
              Story Bank and used to answer "Tell me about yourself" and other personal questions.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-xl p-8 text-center transition-colors hover:border-primary">
                <input
                  type="file"
                  id="resume-upload"
                  accept=".pdf,.docx,.doc"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <label
                  htmlFor="resume-upload"
                  className="flex flex-col items-center gap-3 cursor-pointer"
                >
                  <div className="flex flex-col items-center gap-2">
                    {isExtracting ? (
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : (
                      <FileText className="h-10 w-10 text-muted-foreground/40" />
                    )}
                    <p className="text-sm font-medium">
                      {isExtracting
                        ? "Extracting text..."
                        : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF or Word document
                    </p>
                  </div>
                </label>
              </div>

              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  {error}
                </div>
              )}

              {status === "ready" && extractedText && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Story Title
                    </label>
                    <span className="text-xs text-muted-foreground">
                      Used as the story title in your Story Bank
                    </span>
                  </div>
                  <input
                    type="text"
                    value={storyTitle}
                    onChange={(e) => setStoryTitle(e.target.value)}
                    placeholder="e.g. Software Engineer at Tech Corp - 8 Years Experience"
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Extracted Text Preview
                    </label>
                    <textarea
                      value={extractedText}
                      onChange={(e) => setExtractedText(e.target.value)}
                      rows={8}
                      readOnly
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
                    {(status as string) === "saved" ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Saved to Story Bank
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save to Story Bank
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Previously Uploaded Resumes */}
        {uploadedResumes.length > 0 && (
          <Card className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Previously Uploaded Resumes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {uploadedResumes.map((resume) => (
                  <div
                    key={resume.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {resume.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {resume.extractedText.length} chars •
                          {" "}
                          {new Date(resume.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleDownloadResume(resume)}
                        className="h-8 w-8"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() =>
                          setUploadedResumes(
                            uploadedResumes.filter((r) => r.id !== resume.id)
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

        {/* Story Bank Items */}
        <Card className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Your Story Bank ({stories.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Stories are automatically injected into AI answers when relevant.
            </p>
          </CardHeader>
          <CardContent>
            {stories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No stories yet. Upload a resume above to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stories.map((story) => (
                  <div
                    key={story.id}
                    className="px-4 py-3 rounded-xl border border-border bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {story.title}
                        </p>
                        {story.summary && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {story.summary}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Tags: {story.tags.join(", ")}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => handleDeleteStory(story.id)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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

export default ResumeUpload;
