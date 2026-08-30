// =============================================================================
// Utility: Audit Log Formatter & Diffing
// Issue: #2727 - Implement a Unified Audit Log of all Admin Actions
// Description: Helper functions to format raw JSONB audit data into
// human-readable strings for the UI timeline.
// =============================================================================

import { AuditLogEntry } from "../hooks/useAuditLogs";

/**
 * Maps table names to user-friendly display names
 */
const TABLE_DISPLAY_NAMES: Record<string, string> = {
  events: "Event",
  clubs: "Club Profile",
  club_members: "Membership",
  posts: "Post",
  certificates: "Certificate",
};

/**
 * Maps action types to past-tense verbs for the timeline
 */
const ACTION_VERBS: Record<string, string> = {
  INSERT: "created",
  UPDATE: "updated",
  DELETE: "deleted",
};

/**
 * Generates a human-readable summary of the audit action.
 * Example: "John Doe updated the Event 'Winter Gala'"
 */
export function formatAuditSummary(log: AuditLogEntry): string {
  const actorName = log.actor_profile?.full_name || "System";
  const actionVerb = ACTION_VERBS[log.action] || log.action.toLowerCase();
  const tableName = TABLE_DISPLAY_NAMES[log.table_name] || log.table_name;

  // Try to extract a meaningful title from the data
  const data = log.new_data || log.old_data;
  let entityTitle = "";

  if (data) {
    if (data.title) entityTitle = ` "${data.title}"`;
    else if (data.name) entityTitle = ` "${data.name}"`;
    else if (data.full_name) entityTitle = ` "${data.full_name}"`;
  }

  return `${actorName} ${actionVerb} ${tableName}${entityTitle}`;
}
export async function auditLog(
  userId: string,
  eventType: string,
  metadata?: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    await supabase
      .from('phishing_simulation_audit_log')
      .insert([
        {
          user_id: userId,
          event_type: eventType,
          ip_address: ipAddress || null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          metadata: metadata || {},
        },
      ]);
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
/**
 * Computes the differences between old_data and new_data for UPDATE actions.
 * Returns an array of changed fields with their old and new values.
 */
export function computeFieldDiffs(log: AuditLogEntry): Array<{
  field: string;
  oldValue: any;
  newValue: any;
}> {
  if (log.action !== "UPDATE" || !log.old_data || !log.new_data) {
    return [];
  }

  const diffs: Array<{ field: string; oldValue: any; newValue: any }> = [];
  const allKeys = new Set([...Object.keys(log.old_data), ...Object.keys(log.new_data)]);

  allKeys.forEach((key) => {
    // Skip internal/system fields
    if (["id", "created_at", "updated_at"].includes(key)) return;

    const oldVal = log.old_data![key];
    const newVal = log.new_data![key];

    // Deep equality check for simple types
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({
        field: formatFieldName(key),
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  });

  return diffs;
}

/**
 * Converts snake_case field names to Title Case for display
 */
function formatFieldName(fieldName: string): string {
  return fieldName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Formats a timestamp into a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Returns the appropriate Tailwind color classes for the action type
 */
export function getActionColorClasses(action: string): string {
  switch (action) {
    case "INSERT":
      return "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30";
    case "UPDATE":
      return "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30";
    case "DELETE":
      return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
    default:
      return "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800";
  }
}
