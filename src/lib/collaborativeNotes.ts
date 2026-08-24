export interface NoteActiveCursor {
  userId: string;
  userName: string;
  userColor: string;
  cursorPosition: number;
  lastActive: number;
}

export interface NoteTextOperation {
  id: string;
  userId: string;
  userName: string;
  type: "insert" | "delete" | "replace";
  position: number;
  text: string;
  length?: number;
  version: number;
  timestamp: number;
}

export interface EventCollaborativeDoc {
  eventId: string;
  content: string;
  version: number;
  isFrozen: boolean;
  activeCursors: NoteActiveCursor[];
  contributors: string[];
}

const CURSOR_COLORS = [
  "#10b981", // Emerald
  "#6366f1", // Indigo
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#8b5cf6", // Violet
  "#ef4444", // Rose
  "#14b8a6", // Teal
];

/**
 * Generates a stable vibrant cursor color based on userId or userName (#3564).
 */
export function generateUserCursorColor(identifier: string): string {
  if (!identifier) return CURSOR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
}

/**
 * Applies a collaborative text operation (insert / delete / replace) to a string (#3564).
 */
export function applyTextOperation(content: string, op: NoteTextOperation): string {
  const current = content || "";
  const pos = Math.max(0, Math.min(op.position, current.length));

  switch (op.type) {
    case "insert":
      return current.slice(0, pos) + op.text + current.slice(pos);

    case "delete": {
      const deleteLen = op.length || op.text.length || 1;
      return current.slice(0, pos) + current.slice(pos + deleteLen);
    }

    case "replace": {
      const replaceLen = op.length || 0;
      return current.slice(0, pos) + op.text + current.slice(pos + replaceLen);
    }

    default:
      return current;
  }
}

/**
 * Operational Transformation (OT) collision resolver for concurrent edits (#3564).
 */
export function transformOperation(
  incomingOp: NoteTextOperation,
  concurrentOp: NoteTextOperation
): NoteTextOperation {
  let adjustedPos = incomingOp.position;

  if (concurrentOp.type === "insert" && concurrentOp.position <= incomingOp.position) {
    adjustedPos += concurrentOp.text.length;
  } else if (concurrentOp.type === "delete" && concurrentOp.position < incomingOp.position) {
    const deleteLen = concurrentOp.length || concurrentOp.text.length || 1;
    adjustedPos = Math.max(concurrentOp.position, incomingOp.position - deleteLen);
  }

  return {
    ...incomingOp,
    position: adjustedPos,
    version: concurrentOp.version + 1,
  };
}

/**
 * Validates if the document can currently be edited (#3564).
 */
export function canEditDocument(isFrozen: boolean, eventEndTime?: string): boolean {
  if (isFrozen) return false;
  if (eventEndTime) {
    const end = new Date(eventEndTime).getTime();
    // Allow grace period of 2 hours after event end before hard freeze
    if (Date.now() > end + 2 * 60 * 60 * 1000) {
      return false;
    }
  }
  return true;
}

/**
 * Compiles and formats collaborative notes into a clean master study guide export (#3564).
 */
export function formatNotesExport(
  content: string,
  eventTitle: string,
  contributors: string[] = []
): string {
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const header = [
    `# 📚 Study Guide: ${eventTitle}`,
    `Generated on: ${dateStr}`,
    `Compiled collaboratively by ${contributors.length > 0 ? contributors.join(", ") : "Event Attendees"}`,
    `---`,
    "",
  ].join("\n");

  return `${header}${content.trim()}\n\n---\n*Preserved via CampusConnect Live Collaborative Notes*`;
}
