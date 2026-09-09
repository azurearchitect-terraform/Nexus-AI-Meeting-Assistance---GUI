import { useState, useEffect, type FormEvent } from "react";
import { PageLayout } from "@/layouts";
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Target,
  MessageSquareMore,
  BadgeInfo,
  BookOpen,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Tag,
  Activity,
  Send,
  RotateCcw,
} from "lucide-react";
import {
  type StoryBankItem,
  type InterviewMode,
  type InterviewCoachInsight,
  type InterviewDebrief,
  loadStoryBank,
  addStoryItem,
  deleteStoryItem,
  loadInterviewDebriefs,
  saveInterviewDebriefs,
  loadInterviewMode,
  saveInterviewMode,
  buildInterviewCoachInsight,
  buildDebriefFromInsight,
  EVENT_STORY_BANK_UPDATED,
} from "@/lib";

const MODE_COPY: Array<{ id: InterviewMode; title: string; hint: string }> = [
  { id: "mixed", title: "Mixed", hint: "General interview conversation" },
  { id: "behavioral", title: "Behavioral", hint: "STAR stories and team culture" },
  { id: "technical", title: "Technical", hint: "Implementation details & trade-offs" },
  { id: "system-design", title: "System Design", hint: "Architecture & scalability" },
  { id: "hr", title: "HR Screen", hint: "Culture, motivation & company fit" },
  { id: "recruiter", title: "Recruiter", hint: "Career trajectory & expectations" },
  { id: "leadership", title: "Leadership", hint: "Ownership, conflict & delivery" },
];

export default function InterviewPrep() {
  const [interviewMode, setInterviewModeState] = useState<InterviewMode>(loadInterviewMode());
  const [stories, setStories] = useState<StoryBankItem[]>([]);
  const [debriefs, setDebriefs] = useState<InterviewDebrief[]>([]);
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  // Form states
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [situation, setSituation] = useState("");
  const [task, setTask] = useState("");
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [tags, setTags] = useState("");
  const [metrics, setMetrics] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Practice evaluator states
  const [evalQuestion, setEvalQuestion] = useState("");
  const [evalAnswer, setEvalAnswer] = useState("");
  const [coachInsight, setCoachInsight] = useState<InterviewCoachInsight | null>(null);

  useEffect(() => {
    setStories(loadStoryBank());
    setDebriefs(loadInterviewDebriefs());

    const handleUpdate = () => {
      setStories(loadStoryBank());
    };

    window.addEventListener(EVENT_STORY_BANK_UPDATED, handleUpdate);
    return () => window.removeEventListener(EVENT_STORY_BANK_UPDATED, handleUpdate);
  }, []);

  const handleModeChange = (mode: InterviewMode) => {
    setInterviewModeState(mode);
    saveInterviewMode(mode);
  };

  const clearForm = () => {
    setTitle("");
    setSummary("");
    setSituation("");
    setTask("");
    setAction("");
    setResult("");
    setTags("");
    setMetrics("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !summary.trim() && !situation.trim()) return;

    addStoryItem({
      title: title.trim() || summary.trim().slice(0, 40) || "Untitled Story",
      summary: summary.trim() || [situation, task, action, result].filter(Boolean).join(" "),
      situation: situation.trim(),
      task: task.trim(),
      action: action.trim(),
      result: result.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      metrics: metrics
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      roleFocus: interviewMode,
    });

    setStories(loadStoryBank());
    clearForm();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleDelete = (id: string) => {
    deleteStoryItem(id);
    setStories(loadStoryBank());
  };

  const handleEvaluate = (e: FormEvent) => {
    e.preventDefault();
    if (!evalQuestion.trim() || !evalAnswer.trim()) return;

    const insight = buildInterviewCoachInsight(evalQuestion, evalAnswer, interviewMode, stories);
    setCoachInsight(insight);

    const debrief = buildDebriefFromInsight(
      evalQuestion,
      evalAnswer,
      interviewMode,
      insight,
      insight.storyMatchHint
    );
    const updatedDebriefs = [
      debrief,
      ...debriefs.filter((d) => d.question !== evalQuestion || d.answer !== evalAnswer),
    ].slice(0, 30);

    setDebriefs(updatedDebriefs);
    saveInterviewDebriefs(updatedDebriefs);
  };

  const filteredStories = stories.filter((story) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return (
      story.title.toLowerCase().includes(query) ||
      story.summary.toLowerCase().includes(query) ||
      story.tags.some((t) => t.toLowerCase().includes(query)) ||
      story.roleFocus.toLowerCase().includes(query)
    );
  });

  return (
    <PageLayout
      title="Interview Lab & Story Bank"
      description="Build, organize, and match your STAR stories with real-time answer structure scoring."
    >
      {/* 1. Interview Mode Selector */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary" /> Active Interview Round
          </h3>
          <span className="text-xs text-muted-foreground">
            Current mode: <strong className="text-foreground capitalize">{interviewMode}</strong>
          </span>
        </div>

        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
          {MODE_COPY.map((mode) => {
            const isSelected = interviewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleModeChange(mode.id)}
                className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? "border-primary/50 bg-primary/10 shadow-sm"
                    : "border-border/60 bg-card/40 hover:border-border hover:bg-card/70"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {mode.title}
                  </span>
                  {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80 line-clamp-2">
                  {mode.hint}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Main Two-Column Workspace */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* LEFT COLUMN: Practice Coach & Evaluator */}
        <div className="space-y-5">
          {/* Answer Simulator */}
          <section className="rounded-2xl border border-border/60 bg-card/50 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BadgeInfo className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Practice Coach & Answer Scorer</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">Local Heuristic Scoring</span>
            </div>

            <form onSubmit={handleEvaluate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Interviewer Question
                </label>
                <input
                  type="text"
                  value={evalQuestion}
                  onChange={(e) => setEvalQuestion(e.target.value)}
                  placeholder="e.g. Tell me about a time you handled a severe production outage."
                  className="w-full rounded-xl border border-border/70 bg-background/80 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Your Answer
                </label>
                <textarea
                  rows={4}
                  value={evalAnswer}
                  onChange={(e) => setEvalAnswer(e.target.value)}
                  placeholder="Type or paste your spoken answer to evaluate structure, STAR coverage, and metrics..."
                  className="w-full rounded-xl border border-border/70 bg-background/80 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEvalQuestion("");
                    setEvalAnswer("");
                    setCoachInsight(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-3 w-3" /> Clear
                </button>

                <button
                  type="submit"
                  disabled={!evalQuestion.trim() || !evalAnswer.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all"
                >
                  <Send className="h-3.5 w-3.5" /> Score Answer
                </button>
              </div>
            </form>

            {/* Coach Insights Output */}
            {coachInsight && (
              <div className="pt-3 border-t border-border/50 space-y-3.5 animate-fadeIn">
                {/* Score Pills */}
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
                    Overall {coachInsight.overallScore}/100
                  </span>
                  <span className="rounded-full bg-muted/50 border border-border px-2.5 py-1 text-xs text-muted-foreground">
                    Structure {coachInsight.structureScore}/100
                  </span>
                  <span className="rounded-full bg-muted/50 border border-border px-2.5 py-1 text-xs text-muted-foreground">
                    Clarity {coachInsight.clarityScore}/100
                  </span>
                  <span className="rounded-full bg-muted/50 border border-border px-2.5 py-1 text-xs text-muted-foreground">
                    Specificity {coachInsight.specificityScore}/100
                  </span>
                </div>

                {/* Best Story Match Banner */}
                {coachInsight.storyMatchHint && (
                  <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-3 text-xs flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-primary">Matched Story: </span>
                      <span className="text-foreground">{coachInsight.storyMatchHint}</span>
                    </div>
                  </div>
                )}

                {/* Coach Tip & Next Move */}
                <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-foreground">Coaching Cue: </span>
                    <span className="text-muted-foreground leading-relaxed">{coachInsight.coachingTip}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Next Best Move: </span>
                    <span className="text-muted-foreground leading-relaxed">{coachInsight.nextBestMove}</span>
                  </div>
                </div>

                {/* Coverage Checklist */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Structure & Content Checklist
                  </h4>
                  <div className="space-y-1.5">
                    {coachInsight.checklist.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-muted/20 p-2.5 text-xs"
                      >
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 mt-0.5 ${
                            item.covered ? "text-emerald-500" : "text-muted-foreground/30"
                          }`}
                        />
                        <div className="flex-1">
                          <p className={`font-medium ${item.covered ? "text-foreground" : "text-muted-foreground"}`}>
                            {item.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground/70">{item.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Follow-up Predictions */}
                {coachInsight.likelyFollowUps.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquareMore className="h-3.5 w-3.5 text-primary" /> Likely Follow-Up Questions
                    </h4>
                    <div className="space-y-1.5">
                      {coachInsight.likelyFollowUps.map((fu, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-2 rounded-xl border border-border/40 bg-muted/20 p-2.5 text-xs"
                        >
                          <div>
                            <p className="font-medium text-foreground">{fu.question}</p>
                            {fu.reason && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{fu.reason}</p>}
                          </div>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {fu.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Practice History / Debriefs */}
          <section className="rounded-2xl border border-border/60 bg-card/50 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Recent Debrief History</h3>
              </div>
              <span className="text-xs text-muted-foreground">{debriefs.length} recorded</span>
            </div>

            {debriefs.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 italic p-3 text-center border border-dashed border-border/40 rounded-xl">
                No practice debriefs yet. Score an answer above to log feedback here.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {debriefs.slice(0, 6).map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-border/50 bg-background/50 p-3 text-xs space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-foreground leading-snug">{item.question}</p>
                      <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] text-primary capitalize shrink-0">
                        {item.mode}
                      </span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 leading-relaxed">{item.summary}</p>
                    {item.storyTitle && (
                      <p className="text-[11px] text-primary/80 font-medium">Matched: {item.storyTitle}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: Add Story & Story Bank */}
        <div className="space-y-5">
          {/* Add Story Card */}
          <section className="rounded-2xl border border-border/60 bg-card/50 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Add Story (STAR Format)</h3>
              </div>
              {savedSuccess && (
                <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1 animate-fadeIn">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Story saved!
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Story Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Petabyte Database Migration to Cosmos DB"
                  className="w-full rounded-xl border border-border/70 bg-background/80 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  One-Line Summary
                </label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="High-level elevator pitch of the project and outcome"
                  className="w-full rounded-xl border border-border/70 bg-background/80 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                />
              </div>

              {/* STAR Inputs Grid */}
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                    Situation
                  </label>
                  <textarea
                    rows={2}
                    value={situation}
                    onChange={(e) => setSituation(e.target.value)}
                    placeholder="Context, legacy constraints, or urgency..."
                    className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                    Task
                  </label>
                  <textarea
                    rows={2}
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    placeholder="What you personally needed to solve..."
                    className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                    Action (Your Ownership)
                  </label>
                  <textarea
                    rows={2}
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    placeholder="Technical design, architecture decisions, execution..."
                    className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-foreground/80 mb-1">
                    Result (Business Impact)
                  </label>
                  <textarea
                    rows={2}
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                    placeholder="Measurable outcomes, SLAs, metrics, lessons learned..."
                    className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Tags & Metrics */}
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Tag className="h-3 w-3 text-primary" /> Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="azure, migration, cosmos-db, high-availability"
                    className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Activity className="h-3 w-3 text-primary" /> Metrics (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={metrics}
                    onChange={(e) => setMetrics(e.target.value)}
                    placeholder="99.99% uptime, 40% cost reduction, 0 downtime"
                    className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> Save to Story Bank
                </button>
              </div>
            </form>
          </section>

          {/* Story Bank Listing */}
          <section className="rounded-2xl border border-border/60 bg-card/50 p-5 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Story Bank</h3>
              </div>
              <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                {stories.length} stories
              </span>
            </div>

            {/* Filter */}
            {stories.length > 0 && (
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search stories by title, tag, or focus..."
                className="w-full rounded-xl border border-border/70 bg-background/80 px-3.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
              />
            )}

            {filteredStories.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 italic p-6 text-center border border-dashed border-border/40 rounded-xl">
                {stories.length === 0
                  ? "Your Story Bank is empty. Add 5 to 10 reusable STAR stories to ace your interviews!"
                  : "No stories match your filter query."}
              </p>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {filteredStories.map((story) => {
                  const isExpanded = expandedStoryId === story.id;
                  return (
                    <div
                      key={story.id}
                      className="rounded-xl border border-border/60 bg-background/60 p-4 text-xs space-y-2.5 transition-all hover:border-border"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm text-foreground">{story.title}</h4>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                              {story.roleFocus}
                            </span>
                          </div>
                          {story.summary && (
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{story.summary}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setExpandedStoryId(isExpanded ? null : story.id)}
                            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                            title={isExpanded ? "Collapse STAR details" : "Expand STAR details"}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(story.id)}
                            className="rounded p-1 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete story"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Expandable STAR Details */}
                      {isExpanded && (
                        <div className="pt-2 border-t border-border/40 grid gap-2 sm:grid-cols-2 text-xs animate-fadeIn">
                          <div className="rounded-lg bg-muted/20 p-2.5 border border-border/30">
                            <span className="font-semibold text-[11px] text-foreground block mb-0.5">Situation</span>
                            <p className="text-muted-foreground leading-relaxed">
                              {story.situation || <span className="italic text-muted-foreground/50">Not specified</span>}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/20 p-2.5 border border-border/30">
                            <span className="font-semibold text-[11px] text-foreground block mb-0.5">Task</span>
                            <p className="text-muted-foreground leading-relaxed">
                              {story.task || <span className="italic text-muted-foreground/50">Not specified</span>}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/20 p-2.5 border border-border/30">
                            <span className="font-semibold text-[11px] text-foreground block mb-0.5">Action</span>
                            <p className="text-muted-foreground leading-relaxed">
                              {story.action || <span className="italic text-muted-foreground/50">Not specified</span>}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/20 p-2.5 border border-border/30">
                            <span className="font-semibold text-[11px] text-foreground block mb-0.5">Result</span>
                            <p className="text-muted-foreground leading-relaxed">
                              {story.result || <span className="italic text-muted-foreground/50">Not specified</span>}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Tags & Metrics Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {story.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="rounded-full bg-muted/40 border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            #{t}
                          </span>
                        ))}
                        {story.metrics.map((m, idx) => (
                          <span
                            key={idx}
                            className="rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-medium text-emerald-500"
                          >
                            ✓ {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
