import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Users,
  Lock,
  Unlock,
  Download,
  Bold,
  Italic,
  List,
  Code,
  Clock,
  Sparkles,
  CheckCircle2,
  Share2,
} from "lucide-react";
import {
  NoteActiveCursor,
  NoteTextOperation,
  applyTextOperation,
  generateUserCursorColor,
  formatNotesExport,
  canEditDocument,
} from "@/lib/collaborativeNotes";
import { cn } from "@/lib/utils";

export interface LiveCollaborativeNotesProps {
  eventId?: string;
  eventTitle?: string;
  eventEndTime?: string;
  currentUserId?: string;
  currentUserName?: string;
  isOrganizer?: boolean;
  initialContent?: string;
  initialFrozen?: boolean;
  initialContributors?: string[];
  initialCursors?: NoteActiveCursor[];
  onContentChange?: (content: string) => void;
  onFreezeToggle?: (isFrozen: boolean) => void;
  className?: string;
}

export const MOCK_INITIAL_CURSORS: NoteActiveCursor[] = [
  {
    userId: "u-alex",
    userName: "Alex Rivera",
    userColor: "#10b981",
    cursorPosition: 120,
    lastActive: Date.now(),
  },
  {
    userId: "u-sam",
    userName: "Sam Chen",
    userColor: "#6366f1",
    cursorPosition: 280,
    lastActive: Date.now(),
  },
  {
    userId: "u-taylor",
    userName: "Taylor Swift",
    userColor: "#ec4899",
    cursorPosition: 410,
    lastActive: Date.now(),
  },
];

export const DEFAULT_LECTURE_NOTES = `# 🎙️ Guest Lecture: Intro to LLMs & Autonomous Agents
Speaker: Dr. Aris Thorne (DeepMind)
Date: Spring 2026

## Key Concepts & Architecture
- Transformer attention mechanisms allow contextual token embeddings.
- Retrieval-Augmented Generation (RAG) grounds answers with real-time knowledge.
- Multi-Agent Orchestration enables complex multi-step reasoning.

## Open Q&A Discussion
- Q: How to prevent hallucination in production?
- A: Use structured JSON output schemas, confidence thresholding, and tool groundings.
`;

export const LiveCollaborativeNotes: React.FC<LiveCollaborativeNotesProps> = ({
  eventId = "evt-guest-lecture-1",
  eventTitle = "Guest Lecture: Intro to LLMs & Autonomous Agents",
  eventEndTime,
  currentUserId = "u-me",
  currentUserName = "Jordan Lee",
  isOrganizer = true,
  initialContent = DEFAULT_LECTURE_NOTES,
  initialFrozen = false,
  initialContributors = ["Alex Rivera", "Sam Chen", "Taylor Swift", "Jordan Lee"],
  initialCursors = MOCK_INITIAL_CURSORS,
  onContentChange,
  onFreezeToggle,
  className,
}) => {
  const [content, setContent] = useState<string>(initialContent);
  const [isFrozen, setIsFrozen] = useState<boolean>(initialFrozen);
  const [activeCursors, setActiveCursors] = useState<NoteActiveCursor[]>(initialCursors);
  const [contributors, setContributors] = useState<string[]>(initialContributors);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const editable = canEditDocument(isFrozen, eventEndTime);
  const userColor = generateUserCursorColor(currentUserId);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!editable) return;
    const newText = e.target.value;
    setContent(newText);

    if (!contributors.includes(currentUserName)) {
      setContributors((prev) => [...prev, currentUserName]);
    }

    if (onContentChange) onContentChange(newText);
  };

  const handleInsertFormatting = (prefix: string, suffix: string = "") => {
    if (!editable || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${prefix}${selected || "text"}${suffix}`;

    const updated = content.substring(0, start) + replacement + content.substring(end);
    setContent(updated);
    if (onContentChange) onContentChange(updated);

    // Focus and restore cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 4));
    }, 10);
  };

  const handleInsertTimestamp = () => {
    const timeStr = `\n[${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}] `;
    handleInsertFormatting(timeStr);
  };

  const handleToggleFreeze = () => {
    if (!isOrganizer) return;
    const nextState = !isFrozen;
    setIsFrozen(nextState);
    if (onFreezeToggle) onFreezeToggle(nextState);
  };

  const handleExportStudyGuide = () => {
    const compiled = formatNotesExport(content, eventTitle, contributors);
    const blob = new Blob([compiled], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventTitle.toLowerCase().replace(/\s+/g, "_")}_study_guide.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportNotice("Study guide exported! Sent to event attendee digital swag bags.");
    setTimeout(() => setExportNotice(null), 5000);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-indigo-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-indigo-950">
            <FileText className="w-5 h-5 text-indigo-700" />
            <span>Live Collaborative Study Guide — {eventTitle}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Multiplayer notes document. All attendees take notes together in real-time to build a master study guide.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isOrganizer && (
            <button
              type="button"
              onClick={handleToggleFreeze}
              className={cn(
                "px-3.5 py-1.5 border-2 border-black font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5",
                isFrozen ? "bg-amber-300 text-black hover:bg-amber-400" : "bg-white text-black hover:bg-gray-100"
              )}
            >
              {isFrozen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{isFrozen ? "Locked (Read-Only)" : "Freeze Document"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportStudyGuide}
            className="px-3.5 py-1.5 border-2 border-black bg-black text-white hover:bg-gray-800 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Guide (.MD)
          </button>
        </div>
      </div>

      {/* Export Confirmation Banner */}
      {exportNotice && (
        <div className="p-3 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Active Presence & Cursors Bar */}
      <div className="p-3.5 bg-slate-50 border-b-2 border-black flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Presence Avatars */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-700 flex items-center gap-1.5 uppercase">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Active Note-Takers ({activeCursors.length + 1}):
          </span>

          <div className="flex items-center -space-x-1.5">
            <div
              className="w-6 h-6 rounded-full border border-black flex items-center justify-center font-bold text-[10px] text-white"
              style={{ backgroundColor: userColor }}
              title={`You (${currentUserName})`}
            >
              {currentUserName.charAt(0)}
            </div>

            {activeCursors.map((c) => (
              <div
                key={c.userId}
                className="w-6 h-6 rounded-full border border-black flex items-center justify-center font-bold text-[10px] text-white"
                style={{ backgroundColor: c.userColor }}
                title={c.userName}
              >
                {c.userName.charAt(0)}
              </div>
            ))}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-300">
            {contributors.length} Total Contributors
          </span>

          {isFrozen && (
            <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Event Ended — Read-Only Mode
            </span>
          )}
        </div>
      </div>

      {/* Formatting Toolbar */}
      {editable && (
        <div className="p-2 bg-white border-b-2 border-black flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => handleInsertFormatting("**", "**")}
            className="p-1.5 hover:bg-slate-100 rounded border border-transparent hover:border-black text-gray-700 font-bold"
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleInsertFormatting("*", "*")}
            className="p-1.5 hover:bg-slate-100 rounded border border-transparent hover:border-black text-gray-700"
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleInsertFormatting("\n### ", "")}
            className="px-2 py-1 hover:bg-slate-100 rounded border border-transparent hover:border-black text-[11px] font-bold"
            title="Heading"
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => handleInsertFormatting("\n- ", "")}
            className="p-1.5 hover:bg-slate-100 rounded border border-transparent hover:border-black text-gray-700"
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleInsertFormatting("\n```ts\n", "\n```\n")}
            className="p-1.5 hover:bg-slate-100 rounded border border-transparent hover:border-black text-gray-700"
            title="Code Snippet"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleInsertTimestamp}
            className="px-2 py-1 hover:bg-slate-100 rounded border border-transparent hover:border-black text-[11px] font-bold flex items-center gap-1 text-gray-700"
            title="Insert timestamp"
          >
            <Clock className="w-3 h-3" /> Timestamp
          </button>
        </div>
      )}

      {/* Editor Canvas */}
      <div className="p-4 bg-slate-50 relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextChange}
          readOnly={!editable}
          rows={14}
          placeholder="Start typing lecture notes collaboratively..."
          className={cn(
            "w-full p-4 border-2 border-black rounded-lg bg-white font-mono text-xs text-gray-900 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)]",
            !editable && "bg-slate-100 text-gray-700 cursor-not-allowed"
          )}
        />

        {/* Live Active Cursor Tags Indicator */}
        {activeCursors.length > 0 && editable && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-600 font-sans">
            <span className="font-bold font-mono">Live Cursor Hints:</span>
            {activeCursors.map((c) => (
              <span
                key={c.userId}
                className="px-2 py-0.5 rounded border text-[10px] font-bold"
                style={{
                  backgroundColor: `${c.userColor}20`,
                  borderColor: c.userColor,
                  color: c.userColor,
                }}
              >
                {c.userName} is typing...
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
