import { describe, expect, it } from "vitest";
import {
  setUserContextSql,
  computeFieldDiffs,
  formatAuditLogSummary,
  filterAuditLogs,
  isAuditRetentionExpired,
  type AuditLogRecord,
} from "./auditCdc";

describe("auditCdc utilities", () => {
  describe("setUserContextSql", () => {
    it("generates valid SQL statement for valid UUID", () => {
      const uuid = "12345678-1234-1234-1234-123456789abc";
      expect(setUserContextSql(uuid)).toBe(
        "SET LOCAL myapp.current_user_id = '12345678-1234-1234-1234-123456789abc';",
      );
    });

    it("throws error for invalid UUID format to prevent SQL injection", () => {
      expect(() => setUserContextSql("'; DROP TABLE clubs; --")).toThrow();
      expect(() => setUserContextSql("invalid-id")).toThrow();
    });
  });

  describe("computeFieldDiffs", () => {
    it("returns empty array when either oldData or newData is null", () => {
      expect(computeFieldDiffs(null, { name: "New Club" })).toEqual([]);
      expect(computeFieldDiffs({ name: "Old Club" }, null)).toEqual([]);
    });

    it("identifies changed fields between old and new row states", () => {
      const oldData = {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Old Robotics Club",
        description: "Old Description",
        visibility: "public",
      };
      const newData = {
        id: "11111111-1111-1111-1111-111111111111",
        name: "New Robotics Club",
        description: "New Description",
        visibility: "public",
      };

      const diffs = computeFieldDiffs(oldData, newData);
      expect(diffs).toHaveLength(2);
      expect(diffs).toEqual([
        { field: "name", oldValue: "Old Robotics Club", newValue: "New Robotics Club" },
        { field: "description", oldValue: "Old Description", newValue: "New Description" },
      ]);
    });

    it("ignores internal fields like id, created_at, updated_at", () => {
      const oldData = {
        id: "11111111-1111-1111-1111-111111111111",
        updated_at: "2026-08-01T00:00:00Z",
        name: "Same Name",
      };
      const newData = {
        id: "11111111-1111-1111-1111-111111111111",
        updated_at: "2026-08-02T00:00:00Z",
        name: "Same Name",
      };

      expect(computeFieldDiffs(oldData, newData)).toEqual([]);
    });
  });

  describe("formatAuditLogSummary", () => {
    it("formats INSERT action summary with entity name", () => {
      const log: AuditLogRecord = {
        id: "log-1",
        table_name: "clubs",
        record_id: "club-1",
        action: "INSERT",
        old_data: null,
        new_data: { name: "Coding Club" },
        changed_by: "12345678-1234-1234-1234-123456789abc",
        created_at: "2026-08-20T10:00:00Z",
      };

      expect(formatAuditLogSummary(log, "Alice Admin")).toBe(
        'Alice Admin created Club "Coding Club"',
      );
    });

    it("formats UPDATE action summary", () => {
      const log: AuditLogRecord = {
        id: "log-2",
        table_name: "events",
        record_id: "event-1",
        action: "UPDATE",
        old_data: { title: "Hackathon 2026" },
        new_data: { title: "Hackathon 2026 Spring" },
        changed_by: null,
        created_at: "2026-08-20T10:00:00Z",
      };

      expect(formatAuditLogSummary(log)).toBe('System updated Event "Hackathon 2026 Spring"');
    });

    it("formats DELETE action summary", () => {
      const log: AuditLogRecord = {
        id: "log-3",
        table_name: "profiles",
        record_id: "prof-1",
        action: "DELETE",
        old_data: { full_name: "John Doe" },
        new_data: null,
        changed_by: "12345678-1234-1234-1234-123456789abc",
        created_at: "2026-08-20T10:00:00Z",
      };

      expect(formatAuditLogSummary(log, "SuperAdmin")).toBe(
        'SuperAdmin deleted Profile "John Doe"',
      );
    });
  });

  describe("filterAuditLogs", () => {
    const mockLogs: AuditLogRecord[] = [
      {
        id: "1",
        table_name: "clubs",
        record_id: "c1",
        action: "UPDATE",
        old_data: { description: "Old" },
        new_data: { description: "New" },
        changed_by: "u1",
        created_at: "2026-08-01T12:00:00Z",
      },
      {
        id: "2",
        table_name: "events",
        record_id: "e1",
        action: "DELETE",
        old_data: { title: "Old Event" },
        new_data: null,
        changed_by: "u2",
        created_at: "2026-08-15T12:00:00Z",
      },
      {
        id: "3",
        table_name: "clubs",
        record_id: "c2",
        action: "INSERT",
        old_data: null,
        new_data: { name: "Art Club" },
        changed_by: "u1",
        created_at: "2026-08-25T12:00:00Z",
      },
    ];

    it("filters by table_name", () => {
      const result = filterAuditLogs(mockLogs, { tableName: "clubs" });
      expect(result).toHaveLength(2);
      expect(result.every((l) => l.table_name === "clubs")).toBe(true);
    });

    it("filters by action", () => {
      const result = filterAuditLogs(mockLogs, { action: "DELETE" });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
    });

    it("filters by changed_by", () => {
      const result = filterAuditLogs(mockLogs, { changedBy: "u1" });
      expect(result).toHaveLength(2);
    });

    it("filters by date range", () => {
      const result = filterAuditLogs(mockLogs, {
        startDate: "2026-08-10T00:00:00Z",
        endDate: "2026-08-20T00:00:00Z",
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
    });
  });

  describe("isAuditRetentionExpired", () => {
    it("returns false for logs created recently (e.g. 10 days ago)", () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      expect(isAuditRetentionExpired(tenDaysAgo, 90)).toBe(false);
    });

    it("returns true for logs older than retention period (e.g. 95 days ago)", () => {
      const ninetyFiveDaysAgo = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
      expect(isAuditRetentionExpired(ninetyFiveDaysAgo, 90)).toBe(true);
    });
  });
});
