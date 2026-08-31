/**
 * Database Change Data Capture (CDC) Audit Log Utilities
 * Issue: #2327 - [REFACTOR]: Setup Database Audit Log (CDC) via Postgres Triggers
 */

export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

export interface AuditLogRecord {
  id: string;
  table_name: string;
  record_id: string | null;
  action: AuditAction;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string | null;
  created_at: string;
}

export interface AuditFieldDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface AuditLogFilterOptions {
  tableName?: string;
  action?: AuditAction;
  recordId?: string;
  changedBy?: string;
  startDate?: string | Date;
  endDate?: string | Date;
}

/**
 * Returns SQL command to set local session user ID in a PostgreSQL transaction.
 * Read by the log_audit_event trigger function via current_setting('myapp.current_user_id').
 */
export function setUserContextSql(userId: string): string {
  // Validate UUID format to prevent SQL injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new Error(`Invalid UUID provided for user context: ${userId}`);
  }
  return `SET LOCAL myapp.current_user_id = '${userId}';`;
}

/**
 * Computes deep differences between old_data and new_data for UPDATE audit logs.
 */
export function computeFieldDiffs(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): AuditFieldDiff[] {
  if (!oldData || !newData) {
    return [];
  }

  const diffs: AuditFieldDiff[] = [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  // System/internal fields to ignore in diff display
  const ignoredFields = new Set(["id", "created_at", "updated_at", "version"]);

  for (const key of allKeys) {
    if (ignoredFields.has(key)) continue;

    const oldVal = oldData[key];
    const newVal = newData[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  return diffs;
}

/**
 * Formats an audit log record into a human-readable activity description.
 */
export function formatAuditLogSummary(log: AuditLogRecord, actorName?: string): string {
  const actor = actorName || (log.changed_by ? `User (${log.changed_by.slice(0, 8)})` : "System");
  const actionPastTense: Record<AuditAction, string> = {
    INSERT: "created",
    UPDATE: "updated",
    DELETE: "deleted",
  };

  const verb = actionPastTense[log.action] || log.action.toLowerCase();
  const tableDisplay = formatTableName(log.table_name);

  // Extract entity name if available
  const entityData = log.new_data || log.old_data;
  let entityLabel = "";
  if (entityData) {
    if (typeof entityData.title === "string") entityLabel = ` "${entityData.title}"`;
    else if (typeof entityData.name === "string") entityLabel = ` "${entityData.name}"`;
    else if (typeof entityData.full_name === "string") entityLabel = ` "${entityData.full_name}"`;
  }

  return `${actor} ${verb} ${tableDisplay}${entityLabel}`;
}

/**
 * Formats snake_case table name into Title Case string
 */
function formatTableName(tableName: string): string {
  const tableMap: Record<string, string> = {
    clubs: "Club",
    events: "Event",
    profiles: "Profile",
    club_members: "Club Member",
    posts: "Post",
    comments: "Comment",
  };

  if (tableMap[tableName]) return tableMap[tableName];

  return tableName
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Filters an array of audit logs in-memory using filter options.
 */
export function filterAuditLogs(
  logs: AuditLogRecord[],
  options: AuditLogFilterOptions = {},
): AuditLogRecord[] {
  return logs.filter((log) => {
    if (options.tableName && log.table_name !== options.tableName) return false;
    if (options.action && log.action !== options.action) return false;
    if (options.recordId && log.record_id !== options.recordId) return false;
    if (options.changedBy && log.changed_by !== options.changedBy) return false;

    if (options.startDate) {
      const start = new Date(options.startDate).getTime();
      const created = new Date(log.created_at).getTime();
      if (created < start) return false;
    }

    if (options.endDate) {
      const end = new Date(options.endDate).getTime();
      const created = new Date(log.created_at).getTime();
      if (created > end) return false;
    }

    return true;
  });
}

/**
 * Checks whether an audit log entry has passed the retention period (default 90 days).
 */
export function isAuditRetentionExpired(createdAt: string | Date, retentionDays = 90): boolean {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - createdDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays >= retentionDays;
}
