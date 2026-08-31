import { useState } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Copy,
  ChevronUp,
  ChevronDown,
  Eye,
  BarChart3,
  Wand2,
  FileText,
  Settings,
  Play,
  X,
  Check,
} from "lucide-react";
import { useEventSurveyBuilder } from "@/hooks/useEventSurveyBuilder";
import type { QuestionType } from "@/hooks/useEventSurveyBuilder";
import { SurveyResultsView } from "./SurveyResultsView";

const QUESTION_TYPES: { type: QuestionType; icon: string; label: string }[] = [
  { type: "rating", icon: "⭐", label: "Rating" },
  { type: "text", icon: "📝", label: "Text" },
  { type: "multiple_choice", icon: "🔘", label: "Multiple Choice" },
  { type: "yes_no", icon: "✅", label: "Yes/No" },
  { type: "scale", icon: "📊", label: "Scale" },
];

function QuestionEditor({
  question,
  index,
  total,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  expanded,
  onToggleExpand,
}: {
  question: {
    id: string;
    type: QuestionType;
    title: string;
    description: string;
    required: boolean;
    options?: string[];
    min?: number;
    max?: number;
  };
  index: number;
  total: number;
  onUpdate: (update: Record<string, unknown>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (dir: "up" | "down") => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const meta = QUESTION_TYPES.find((t) => t.type === question.type)!;

  return (
    <div className="neu-border bg-white shadow-[2px_2px_0_0_#000] overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-cream/50 transition-colors"
      >
        <GripVertical size={14} className="text-gray-300 shrink-0" />
        <span className="text-lg shrink-0">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm truncate">
            {question.title || "Untitled Question"}
          </p>
          <p className="font-mono text-[10px] text-gray-400">
            {meta.label} {question.required && "· Required"}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove("up");
            }}
            disabled={index === 0}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove("down");
            }}
            disabled={index === total - 1}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="Duplicate"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 hover:bg-red-50 text-red-500 rounded"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </button>

      {/* Expanded Editor */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/50">
          <div>
            <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-1 block">
              Question Title
            </label>
            <input
              type="text"
              value={question.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="e.g. How would you rate the event?"
              className="w-full neu-border bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-cream"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-1 block">
              Description (optional)
            </label>
            <input
              type="text"
              value={question.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Additional context for the respondent"
              className="w-full neu-border bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-cream"
            />
          </div>

          {question.type === "multiple_choice" && (
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-1 block">
                Options
              </label>
              <div className="space-y-2">
                {(question.options || []).map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...(question.options || [])];
                        newOpts[oi] = e.target.value;
                        onUpdate({ options: newOpts });
                      }}
                      className="flex-1 neu-border bg-white px-3 py-1.5 font-mono text-sm outline-none focus:bg-cream"
                    />
                    <button
                      onClick={() => {
                        const newOpts = (question.options || []).filter((_, i) => i !== oi);
                        onUpdate({ options: newOpts });
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    onUpdate({
                      options: [
                        ...(question.options || []),
                        `Option ${(question.options || []).length + 1}`,
                      ],
                    })
                  }
                  className="flex items-center gap-1 font-mono text-[10px] font-bold text-gray-500 hover:text-black"
                >
                  <Plus size={12} /> Add option
                </button>
              </div>
            </div>
          )}

          {question.type === "scale" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-1 block">
                  Min
                </label>
                <input
                  type="number"
                  value={question.min || 1}
                  onChange={(e) => onUpdate({ min: Number(e.target.value) })}
                  className="w-full neu-border bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-cream"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-1 block">
                  Max
                </label>
                <input
                  type="number"
                  value={question.max || 10}
                  onChange={(e) => onUpdate({ max: Number(e.target.value) })}
                  className="w-full neu-border bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-cream"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdate({ required: !question.required })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold font-mono transition-all ${
                question.required
                  ? "bg-red-100 text-red-700 border border-red-200"
                  : "bg-gray-100 text-gray-500 border border-gray-200"
              }`}
            >
              {question.required ? <Check size={12} /> : null}
              Required
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SurveyPreview({
  questions,
}: {
  questions: {
    id: string;
    type: QuestionType;
    title: string;
    description: string;
    required: boolean;
    options?: string[];
    min?: number;
    max?: number;
  }[];
}) {
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string | number>>({});

  if (questions.length === 0) {
    return (
      <div className="neu-border bg-white p-12 text-center shadow-[2px_2px_0_0_#000]">
        <p className="font-display text-xl font-black text-gray-400">No questions yet</p>
        <p className="font-mono text-sm text-gray-400 mt-2">Add questions to preview your survey</p>
      </div>
    );
  }

  return (
    <div className="neu-border bg-white p-6 shadow-[2px_2px_0_0_#000] space-y-6">
      <div className="border-b-2 border-black pb-4">
        <h3 className="font-display text-xl font-black">Survey Preview</h3>
        <p className="font-mono text-[10px] text-gray-500 mt-1">
          This is how respondents will see your survey
        </p>
      </div>

      {questions.map((q, i) => (
        <div key={q.id} className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="neu-border bg-sky w-6 h-6 flex items-center justify-center font-mono text-[10px] font-black shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="font-display font-bold text-sm">
                {q.title || "Untitled"}
                {q.required && <span className="text-red-500 ml-1">*</span>}
              </p>
              {q.description && (
                <p className="font-mono text-[10px] text-gray-500">{q.description}</p>
              )}
            </div>
          </div>

          <div className="ml-8">
            {q.type === "rating" && (
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setPreviewAnswers((p) => ({ ...p, [q.id]: s }))}
                    className={`text-2xl transition-transform hover:scale-110 ${
                      (previewAnswers[q.id] as number) >= s ? "" : "opacity-30"
                    }`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            )}

            {q.type === "text" && (
              <textarea
                placeholder="Type your answer..."
                className="w-full neu-border bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-cream resize-none h-20"
                value={(previewAnswers[q.id] as string) || ""}
                onChange={(e) => setPreviewAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
              />
            )}

            {q.type === "yes_no" && (
              <div className="flex gap-2">
                {["Yes", "No"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setPreviewAnswers((p) => ({ ...p, [q.id]: v }))}
                    className={`px-4 py-2 rounded-lg text-sm font-bold font-mono transition-all ${
                      previewAnswers[q.id] === v
                        ? "bg-lime border-2 border-black"
                        : "bg-gray-100 border-2 border-gray-200"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}

            {q.type === "multiple_choice" && (
              <div className="space-y-1.5">
                {(q.options || []).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setPreviewAnswers((p) => ({ ...p, [q.id]: opt }))}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono transition-all ${
                      previewAnswers[q.id] === opt
                        ? "bg-lime border-2 border-black"
                        : "bg-gray-50 border-2 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        previewAnswers[q.id] === opt ? "border-black bg-black" : "border-gray-300"
                      }`}
                    >
                      {previewAnswers[q.id] === opt && (
                        <span className="w-1.5 h-1.5 bg-white rounded-full" />
                      )}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {q.type === "scale" && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-gray-500">{q.min || 1}</span>
                <input
                  type="range"
                  min={q.min || 1}
                  max={q.max || 10}
                  value={(previewAnswers[q.id] as number) || q.min || 1}
                  onChange={(e) =>
                    setPreviewAnswers((p) => ({ ...p, [q.id]: Number(e.target.value) }))
                  }
                  className="flex-1"
                />
                <span className="font-mono text-xs text-gray-500">{q.max || 10}</span>
                <span className="neu-border bg-lime px-2 py-0.5 font-mono text-xs font-bold min-w-[2rem] text-center">
                  {previewAnswers[q.id] || q.min || 1}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}

      <button className="w-full py-3 bg-black text-white rounded-lg font-mono text-sm font-bold hover:bg-gray-800 transition-colors">
        Submit Survey
      </button>
    </div>
  );
}

export function SurveyBuilderPage({ eventId }: { eventId?: string }) {
  const {
    config,
    setConfig,
    templates,
    addQuestion,
    updateQuestion,
    removeQuestion,
    duplicateQuestion,
    moveQuestion,
    loadTemplate,
    loadMockData,
    responses,
    stats,
    responseCount,
    view,
    setView,
  } = useEventSurveyBuilder(eventId);

  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-black uppercase tracking-tight">
            Survey Builder
          </h1>
          <p className="font-mono text-sm text-gray-500 mt-1">
            Create custom feedback surveys for your events
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadMockData}
            className="neu-border bg-white px-3 py-2 font-mono text-xs font-bold uppercase flex items-center gap-1.5 hover:bg-cream transition-colors shadow-[2px_2px_0_0_#000]"
          >
            <Play size={12} /> Load Mock Data
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {[
          { id: "build" as const, label: "Build", icon: Settings },
          { id: "preview" as const, label: "Preview", icon: Eye },
          { id: "results" as const, label: "Results", icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
              view === tab.id ? "bg-white shadow-sm text-black" : "text-gray-500 hover:text-black"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.id === "results" && responses.length > 0 && (
              <span className="bg-lime text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {responseCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* BUILD VIEW */}
      {view === "build" && (
        <div className="space-y-4">
          {/* Survey Meta */}
          <div className="neu-border bg-white p-5 shadow-[2px_2px_0_0_#000] space-y-4">
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-1 block">
                Survey Title
              </label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => setConfig((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Fall Festival Feedback"
                className="w-full neu-border bg-white px-3 py-2 font-display text-lg font-bold outline-none focus:bg-cream"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-1 block">
                Description
              </label>
              <textarea
                value={config.description}
                onChange={(e) => setConfig((p) => ({ ...p, description: e.target.value }))}
                placeholder="Tell respondents what this survey is about..."
                className="w-full neu-border bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-cream resize-none h-16"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 font-mono text-xs">
                <input
                  type="checkbox"
                  checked={config.allowAnonymous}
                  onChange={(e) => setConfig((p) => ({ ...p, allowAnonymous: e.target.checked }))}
                  className="accent-black"
                />
                Allow anonymous responses
              </label>
              <label className="flex items-center gap-2 font-mono text-xs">
                <input
                  type="checkbox"
                  checked={config.showResults}
                  onChange={(e) => setConfig((p) => ({ ...p, showResults: e.target.checked }))}
                  className="accent-black"
                />
                Show results to respondents
              </label>
            </div>
          </div>

          {/* Quick Start Templates */}
          {config.questions.length === 0 && (
            <div className="neu-border bg-white p-5 shadow-[2px_2px_0_0_#000]">
              <div className="flex items-center gap-2 mb-3">
                <Wand2 size={16} />
                <h3 className="font-display font-bold text-sm">Quick Start Templates</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => loadTemplate(tpl.id)}
                    className="neu-border p-3 text-left hover:bg-cream transition-colors shadow-[1px_1px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5"
                  >
                    <p className="font-display font-bold text-sm">{tpl.name}</p>
                    <p className="font-mono text-[10px] text-gray-500 mt-1">{tpl.description}</p>
                    <p className="font-mono text-[10px] text-gray-400 mt-2">
                      {tpl.questions.length} questions
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Questions */}
          <div className="space-y-3">
            {config.questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={i}
                total={config.questions.length}
                onUpdate={(u) => updateQuestion(q.id, u)}
                onRemove={() => removeQuestion(q.id)}
                onDuplicate={() => duplicateQuestion(q.id)}
                onMove={(d) => moveQuestion(q.id, d)}
                expanded={expandedQuestion === q.id}
                onToggleExpand={() => setExpandedQuestion(expandedQuestion === q.id ? null : q.id)}
              />
            ))}
          </div>

          {/* Add Question */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-full neu-border bg-white py-3 font-mono text-sm font-bold uppercase flex items-center justify-center gap-2 hover:bg-cream transition-colors shadow-[2px_2px_0_0_#000]"
            >
              <Plus size={16} /> Add Question
            </button>

            {showAddMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 neu-border bg-white shadow-[4px_4px_0_0_#000] p-2 grid grid-cols-5 gap-2 z-10">
                {QUESTION_TYPES.map((qt) => (
                  <button
                    key={qt.type}
                    onClick={() => {
                      addQuestion(qt.type);
                      setShowAddMenu(false);
                    }}
                    className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-cream transition-colors"
                  >
                    <span className="text-2xl">{qt.icon}</span>
                    <span className="font-mono text-[10px] font-bold">{qt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PREVIEW VIEW */}
      {view === "preview" && <SurveyPreview questions={config.questions} />}

      {/* RESULTS VIEW */}
      {view === "results" && (
        <SurveyResultsView
          questions={config.questions}
          responses={responses}
          responseCount={responseCount}
        />
      )}
    </div>
  );
}
