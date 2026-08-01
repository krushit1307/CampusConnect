import { useState } from "react";
import { useAuditLogs, AuditLog } from "@/hooks/useAuditLogs";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Admin dashboard component to display the tamper-proof audit logs.
 * Features pagination, JSON diffing, and neubrutalist styling.
 */
export function AuditLogViewer() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { data, isLoading, isError } = useAuditLogs(page, pageSize);

  if (isLoading) {
    return (
      <Card className="w-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="w-full border-2 border-red-500 bg-red-50 dark:bg-red-950">
        <CardContent className="flex h-64 items-center justify-center text-destructive font-mono">
          Failed to load audit logs. Check permissions.
        </CardContent>
      </Card>
    );
  }

  const logs = data?.logs || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "INSERT":
        return "bg-green-500 text-white border-black";
      case "UPDATE":
        return "bg-yellow-500 text-black border-black";
      case "DELETE":
        return "bg-red-500 text-white border-black";
      default:
        return "bg-gray-500 text-white border-black";
    }
  };

  return (
    <Card className="w-full border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
      <CardHeader className="border-b-2 border-black bg-muted/30">
        <CardTitle className="font-mono text-xl uppercase tracking-wider">
          System Audit Logs
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-black bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-mono w-[150px]">Time</TableHead>
                <TableHead className="font-mono w-[100px]">User</TableHead>
                <TableHead className="font-mono w-[120px]">Table</TableHead>
                <TableHead className="font-mono w-[100px]">Action</TableHead>
                <TableHead className="font-mono">Record ID</TableHead>
                <TableHead className="font-mono">Changes (JSONB)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: AuditLog) => (
                <TableRow key={log.id} className="border-b border-border">
                  <TableCell className="font-mono text-xs">
                    {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.changed_by?.substring(0, 8) || "System"}
                  </TableCell>
                  <TableCell className="font-mono font-bold uppercase text-primary">
                    {log.table_name}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("font-mono border-2", getActionBadgeColor(log.action))}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.record_id.substring(0, 8)}...
                  </TableCell>
                  <TableCell className="max-w-xs font-mono text-xs">
                    <details className="cursor-pointer">
                      <summary className="hover:underline text-primary">View Diff</summary>
                      <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-[10px] border border-border">
                        {JSON.stringify(log.old_data || log.new_data, null, 2)}
                      </pre>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center font-mono">
                    No audit logs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t-2 border-black p-4 bg-muted/10">
          <div className="font-mono text-sm">
            Page {page} of {totalPages} ({totalCount} total logs)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border-2 border-black font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="border-2 border-black font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
