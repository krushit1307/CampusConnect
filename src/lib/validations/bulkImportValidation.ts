import { z } from "zod";

export const UserRoleSchema = z.enum(["student", "faculty", "admin", "club_leader", "guest"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const BulkUserRowSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .toLowerCase()
    .email({ message: "Invalid email format" }),
  name: z
    .string({ required_error: "Full name is required" })
    .trim()
    .min(2, { message: "Name must be at least 2 characters long" })
    .max(100, { message: "Name cannot exceed 100 characters" }),
  role: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .default("student")
    .transform((val) => {
      const normalized = val.toLowerCase();
      if (["student", "faculty", "admin", "club_leader", "guest"].includes(normalized)) {
        return normalized as UserRole;
      }
      return "student" as UserRole;
    }),
  department: z.string().trim().max(100).optional().default("General"),
  studentId: z.string().trim().max(50).optional().default(""),
  phone: z.string().trim().max(20).optional().default(""),
});

export type RawUserCsvRow = Record<string, string>;

export type ValidatedUserRow = z.infer<typeof BulkUserRowSchema> & {
  rowNumber: number;
  importedAt: string;
};

export interface FailedRowReport {
  rowNumber: number;
  email?: string;
  error: string;
  rawRow: RawUserCsvRow;
}

export interface BulkImportOptions {
  batchSize?: number;
  skipHeader?: boolean;
  maxFailedRowsLog?: number;
  targetRoleOverride?: UserRole;
}

export interface BulkImportSummary {
  success: boolean;
  totalProcessed: number;
  insertedCount: number;
  failedCount: number;
  failedRows: FailedRowReport[];
  executionTimeMs: number;
  batchSize: number;
  memoryMetrics: {
    initialHeapMB: number;
    peakHeapMB: number;
    finalHeapMB: number;
  };
}

/**
 * Normalizes raw object keys from CSV header (e.g., "Full Name" -> "name", "E-Mail Address" -> "email")
 */
export function normalizeCsvHeaderKeys(rawRow: RawUserCsvRow): RawUserCsvRow {
  const normalized: RawUserCsvRow = {};
  for (const [key, value] of Object.entries(rawRow)) {
    const cleanKey = key
      .trim()
      .toLowerCase()
      .replace(/[\s\-_]+/g, "");
    if (["email", "mail", "emailaddress"].includes(cleanKey)) {
      normalized.email = value;
    } else if (["name", "fullname", "username", "studentname"].includes(cleanKey)) {
      normalized.name = value;
    } else if (["role", "userrole", "type", "accounttype"].includes(cleanKey)) {
      normalized.role = value;
    } else if (["department", "dept", "faculty", "major"].includes(cleanKey)) {
      normalized.department = value;
    } else if (["studentid", "id", "rollno", "matricno"].includes(cleanKey)) {
      normalized.studentId = value;
    } else if (["phone", "phonenumber", "mobile", "contact"].includes(cleanKey)) {
      normalized.phone = value;
    } else {
      normalized[key.trim()] = value;
    }
  }
  return normalized;
}

/**
 * Helper to generate mock CSV content for benchmarks & unit testing
 */
export function generateDummyUserCsv(totalRows: number, invalidRowIndices: number[] = []): string {
  const invalidSet = new Set(invalidRowIndices);
  const lines: string[] = ["email,name,role,department,studentId,phone"];

  for (let i = 1; i <= totalRows; i++) {
    if (invalidSet.has(i)) {
      if (i % 2 === 0) {
        // Invalid email missing domain
        lines.push(
          `invalid-user-${i}-email-missing,Student ${i},student,Computer Science,CS${1000 + i},+1555000${i}`,
        );
      } else {
        // Missing required name field
        lines.push(
          `student${i}@campusconnect.edu,,student,Mathematics,MATH${1000 + i},+1555000${i}`,
        );
      }
    } else {
      const dept =
        i % 3 === 0
          ? "Computer Science"
          : i % 3 === 1
            ? "Electrical Engineering"
            : "Business Administration";
      lines.push(
        `student${i}@campusconnect.edu,Student ${i},student,${dept},STU${10000 + i},+15551234${(i % 1000).toString().padStart(3, "0")}`,
      );
    }
  }

  return lines.join("\n");
}
