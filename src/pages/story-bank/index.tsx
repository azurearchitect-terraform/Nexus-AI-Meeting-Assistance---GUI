import { useState, useEffect } from "react";
import { PageLayout } from "@/layouts";
import {
  Trash2,
  Edit2,
  FileText,
  Loader2,
  Check,
  Briefcase,
  Sparkles,
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

  useEffect(() => {
    setStories(loadStoryBank());
  }, []);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

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
      description="Manage your STAR stories. These are automatically used by the AI to answer behavioral and 'Tell me about yourself' questions."
    >
      <div className="max-w-5xl mx-auto py-6 space-y-8">
        {/* Add Story Section */}
        <Card className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Add Manual Story
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Create a STAR story manually, or upload a resume on the Resume Upload page.
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
                  Add a story above or upload a resume on the Resume Upload page.
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
                              setEditValues({ ...editValues, summary: e.target.value })
                            }
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
                              setEditValues({ ...editValues, situation: e.target.value })
                            }
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
                              setEditValues({ ...editValues, task: e.target.value })
                            }
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
                              setEditValues({ ...editValues, action: e.target.value })
                            }
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
                              setEditValues({ ...editValues, result: e.target.value })
                            }
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
