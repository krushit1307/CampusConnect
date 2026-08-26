export interface RosterImportRow {
  email: string;
  role: string;
}

export interface RosterImportValidationError {
  row: number;
  email?: string;
  message: string;
}

export interface RosterMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string;
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DEFAULT_ROSTER_BATCH_SIZE = 20;

/**
 * Client-Side CSV Parser & Line-by-Line Validator:
 * Validates required headers ("Email", "Role") and checks every email format,
 * flagging exact row numbers with errors (e.g., "Row 15: Invalid email format").
 */
export function parseAndValidateRosterCsv(csvText: string): {
  valid: boolean;
  rows: RosterImportRow[];
  errors: RosterImportValidationError[];
} {
  if (!csvText || !csvText.trim()) {
    return {
      valid: false,
      rows: [],
      errors: [{ row: 0, message: "CSV file content is empty." }],
    };
  }

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return {
      valid: false,
      rows: [],
      errors: [{ row: 0, message: "No data rows found in CSV." }],
    };
  }

  // Parse header
  const headerCols = lines[0].split(",").map((h) =>
    h
      .replace(/^["']|["']$/g, "")
      .trim()
      .toLowerCase(),
  );
  const emailIdx = headerCols.findIndex((h) => h === "email" || h === "email address");
  const roleIdx = headerCols.findIndex((h) => h === "role" || h === "club role");

  if (emailIdx === -1) {
    return {
      valid: false,
      rows: [],
      errors: [{ row: 1, message: 'Missing required header column: "Email"' }],
    };
  }

  const parsedRows: RosterImportRow[] = [];
  const errors: RosterImportValidationError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const cols = rawLine.split(",").map((c) => c.replace(/^["']|["']$/g, "").trim());

    const email = cols[emailIdx] || "";
    const role = roleIdx !== -1 && cols[roleIdx] ? cols[roleIdx] : "Member";

    const rowNum = i + 1; // 1-based index (header = row 1)

    if (!email) {
      errors.push({ row: rowNum, message: `Row ${rowNum}: Email address is missing.` });
      continue;
    }

    if (!EMAIL_REGEX.test(email)) {
      errors.push({
        row: rowNum,
        email,
        message: `Row ${rowNum}: Invalid email format (${email}).`,
      });
      continue;
    }

    parsedRows.push({ email, role });
  }

  return {
    valid: errors.length === 0,
    rows: parsedRows,
    errors,
  };
}

/**
 * Rate-Limit Batching Engine: Groups rows into 20-item batches to prevent triggering Supabase Auth rate limits.
 */
export function batchProcessRosterImport(
  rows: RosterImportRow[],
  batchSize = DEFAULT_ROSTER_BATCH_SIZE,
): RosterImportRow[][] {
  if (!rows || rows.length === 0) return [];

  const batches: RosterImportRow[][] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    batches.push(rows.slice(i, i + batchSize));
  }

  return batches;
}

/**
 * Export Roster to CSV tool: Dumps club members table into downloadable CSV format.
 * Columns: Full Name, Email, Role, Status, Joined Date
 */
export function exportRosterToCsv(members: RosterMember[]): string {
  const headers = ["Full Name", "Email", "Role", "Status", "Joined Date"];

  const rows = members.map((m) => [
    `"${(m.name || "Club Member").replace(/"/g, '""')}"`,
    `"${(m.email || "").replace(/"/g, '""')}"`,
    `"${(m.role || "Member").replace(/"/g, '""')}"`,
    `"${(m.status || "Approved").replace(/"/g, '""')}"`,
    `"${new Date(m.joinedAt || Date.now()).toLocaleDateString("en-US")}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
