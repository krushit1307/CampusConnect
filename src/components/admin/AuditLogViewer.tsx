import React, { useState, useMemo } from "react";
import { useAuditLogs, AuditLogEntry, AuditFilters } from "@/hooks/useAuditLogs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// =============================================================================
// Component: AuditLogViewer
// Issue: #2727 - Implement a Unified Audit Log of all Admin Actions
// Description: Renders the chronological timeline of administrative actions
// for a club. Includes filtering controls, diff viewing for updates, and
// infinite scrolling. Fully supports Dark/Light mode.
// =============================================================================

interface AuditLogViewerProps {
  clubId: string;
}

export function AuditLogViewer({ clubId }: AuditLogViewerProps) {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useAuditLogs(clubId, filters);

  // Flatten infinite query pages into a single array
  const logs = useMemo(() => data?.pages.flat() ?? [], [data]);

  const handleFilterChange = (key: keyof AuditFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const toggleExpand = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  if (isError) {
    return (
      <Card className="w-full border-2 border-red-500 bg-red-50 dark:bg-red-950">
        <CardContent className="flex h-64 items-center justify-center text-destructive font-mono">
          Failed to load audit logs: {error?.message || "Check permissions."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-6xl mx-auto border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)] overflow-hidden">
      {/* Header & Filters */}
      <CardHeader className="border-b-2 border-black bg-muted/30 space-y-4">
        <CardTitle className="font-mono text-xl uppercase tracking-wider">
          Club Activity Audit Log
        </CardTitle>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-mono font-bold uppercase text-muted-foreground mb-1">
              Filter by Table
            </label>
            <select
              value={filters.tableName || ""}
              onChange={(e) => handleFilterChange("tableName", e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded-none bg-background font-mono text-sm focus:ring-0 focus:outline-none focus:bg-accent"
            >
              <option value="">All Tables</option>
              <option value="events">Events</option>
              <option value="clubs">Club Profile</option>
              <option value="club_members">Memberships</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase text-muted-foreground mb-1">
              Filter by Action
            </label>
            <select
              value={filters.action || ""}
              onChange={(e) => handleFilterChange("action", e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded-none bg-background font-mono text-sm focus:ring-0 focus:outline-none focus:bg-accent"
            >
              <option value="">All Actions</option>
              <option value="INSERT">Created</option>
              <option value="UPDATE">Updated</option>
              <option value="DELETE">Deleted</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase text-muted-foreground mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate || ""}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded-none bg-background font-mono text-sm focus:ring-0 focus:outline-none focus:bg-accent"
            />
          </div>
        </div>
      </CardHeader>

      {/* Timeline Feed */}
      <CardContent className="p-6 max-h-[600px] overflow-y-auto custom-scrollbar bg-background">
        {isLoading && logs.length === 0 && (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {!isLoading && logs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground font-mono">
            <p className="text-lg font-bold uppercase">No activity recorded</p>
            <p className="text-sm mt-1">Administrative actions will appear here.</p>
          </div>
        )}

        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          {logs.map((log) => (
            <AuditLogItem
              key={log.id}
              log={log}
              isExpanded={expandedLogId === log.id}
              onToggle={() => toggleExpand(log.id)}
            />
          ))}
        </div>

        {/* Load More Button */}
        {hasNextPage && (
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="border-2 border-black font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              {isFetchingNextPage ? "Loading..." : "Load Older Activity"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Sub-component: Individual Audit Log Item
 */
const AuditLogItem: React.FC<{
  log: AuditLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ log, isExpanded, onToggle }) => {
  const diffs = computeFieldDiffs(log);
  const colorClasses = getActionColorClasses(log.action);

  return (
    <div className="relative pl-12 pb-8 last:pb-0 group">
      {/* Timeline Node */}
      <div
        className={cn(
          "absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-background border-2 border-black",
          colorClasses,
        )}
      >
        {log.action === "INSERT" && (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {log.action === "UPDATE" && (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        )}
        {log.action === "DELETE" && (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      {/* Content Card */}
      <div
        className={cn(
          "bg-card border-2 border-black rounded-none p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer",
          isExpanded && "ring-2 ring-primary ring-offset-2",
        )}
        onClick={onToggle}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            {log.actor_profile?.avatar_url ? (
              <img
                src={log.actor_profile.avatar_url}
                alt={log.actor_profile.full_name}
                className="w-8 h-8 rounded-full object-cover border-2 border-black"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-muted border-2 border-black flex items-center justify-center text-muted-foreground text-xs font-mono font-bold">
                {log.actor_profile?.full_name?.charAt(0) || "S"}
              </div>
            )}
            <div>
              <p className="text-sm font-mono font-bold text-foreground">
                {formatAuditSummary(log)}
              </p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                {new Date(log.timestamp).toLocaleString()} • ID: {log.record_id.substring(0, 8)}...
              </p>
            </div>
          </div>

          <Badge className={cn("font-mono border-2 border-black uppercase", colorClasses)}>
            {log.action}
          </Badge>
        </div>

        {/* Expanded Diff View */}
        {isExpanded && diffs.length > 0 && (
          <div className="mt-4 border-t-2 border-border pt-4">
            <h4 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Changed Fields
            </h4>
            <div className="space-y-3">
              {diffs.map((diff, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded border-2 border-red-200 dark:border-red-900">
                    <span className="text-xs font-mono font-bold text-red-800 dark:text-red-300 block mb-1">
                      {diff.field} (Old)
                    </span>
                    <span className="text-red-900 dark:text-red-200 break-all font-mono text-xs">
                      {JSON.stringify(diff.oldValue) || "null"}
                    </span>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 p-2 rounded border-2 border-green-200 dark:border-green-900">
                    <span className="text-xs font-mono font-bold text-green-800 dark:text-green-300 block mb-1">
                      {diff.field} (New)
                    </span>
                    <span className="text-green-900 dark:text-green-200 break-all font-mono text-xs">
                      {JSON.stringify(diff.newValue) || "null"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isExpanded && diffs.length === 0 && log.action === "UPDATE" && (
          <p className="text-xs font-mono text-muted-foreground italic mt-2">
            No trackable field changes detected (possibly system metadata update).
          </p>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Inline Utilities (replaces external auditLogger dependency)
// -----------------------------------------------------------------------------

function formatAuditSummary(log: AuditLogEntry): string {
  const actor = log.actor_profile?.full_name || "System";
  const table = log.table_name.replace(/_/g, " ");

  switch (log.action) {
    case "INSERT":
      return `${actor} created a new ${table}`;
    case "UPDATE":
      return `${actor} updated ${table}`;
    case "DELETE":
      return `${actor} deleted ${table}`;
    default:
      return `${actor} performed ${log.action} on ${table}`;
  }
}

function getActionColorClasses(action: string): string {
  switch (action) {
    case "INSERT":
      return "bg-green-500 text-white";
    case "UPDATE":
      return "bg-yellow-500 text-black";
    case "DELETE":
      return "bg-red-500 text-white";
    default:
      return "bg-gray-500 text-white";
  }
}

interface FieldDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

function computeFieldDiffs(log: AuditLogEntry): FieldDiff[] {
  if (!log.old_data && !log.new_data) return [];
  if (log.action !== "UPDATE") return [];

  const oldData = (log.old_data || {}) as Record<string, unknown>;
  const newData = (log.new_data || {}) as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const diffs: FieldDiff[] = [];

  for (const key of allKeys) {
    const oldVal = oldData[key];
    const newVal = newData[key];

    // Skip unchanged fields and internal metadata
    if (key.startsWith("_") || key === "updated_at") continue;
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

    diffs.push({ field: key, oldValue: oldVal, newValue: newVal });
  }

  return diffs;
}
