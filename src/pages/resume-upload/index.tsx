import React, { useState, useCallback } from "react";
import { PageLayout } from "@/layouts";
import {
  FileText,
  Upload,
  Trash2,
  Loader2,
  Download,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

if (typeof window !== "undefined") {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs?url",
    import.meta.url
  ).toString();
}

type UploadStatus = "idle" | "extracting" | "ready" | "error";

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
  const [uploadedResumes, setUploadedResumes] = useState<UploadedResume[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

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
    } catch (err: any) {
      setError(err.message || "Failed to extract text from file.");
      setStatus("idle");
      setIsExtracting(false);
    }
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
      title="Resume Upload"
      description="Upload your resume (PDF or Word) to extract text and save it for interview preparation."
    >
      <div className="max-w-5xl mx-auto py-6 space-y-8">
        {/* Upload Card */}
        <Card className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload Resume
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Supports PDF (.pdf) and Word (.docx, .doc). Extracted text is saved
              independently and can be used for interview preparation.
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
                  className="flex flex-col items-center gap-2 cursor-pointer"
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
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Extracted Text Preview
                    </label>
                    <textarea
                      value={extractedText}
                      readOnly
                      rows={10}
                      className="w-full rounded-xl border border-input bg-muted/50 px-4 py-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      {extractedText.length} characters extracted.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        const blob = new Blob([extractedText], {
                          type: "text/plain",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "resume_extracted.txt";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Extracted Text
                    </Button>
                    <Button
                      onClick={() => {
                        setExtractedText("");
                        setStatus("idle");
                        setError(null);
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      Clear
                    </Button>
                  </div>
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
                Previously Uploaded Resumes ({uploadedResumes.length})
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
      </div>
    </PageLayout>
  );
};

export default ResumeUpload;
