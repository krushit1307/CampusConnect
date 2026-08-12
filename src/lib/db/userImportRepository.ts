import { ValidatedUserRow } from "../validations/bulkImportValidation";

export interface DBUserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  studentId: string;
  phone: string;
  createdAt: string;
}

/**
 * Repository handling batch database insertions for stream user imports.
 * In a live backend deployment, this executes parameterized SQL queries:
 * `INSERT INTO users (id, email, name, role, department, student_id, phone, created_at) VALUES ($1, $2, ...)`
 */
export class UserImportRepository {
  private static mockDatabase: Map<string, DBUserRecord> = new Map();
  private insertedCount: number = 0;

  /**
   * Resets the mock user database for test runs
   */
  public resetDatabase(): void {
    UserImportRepository.mockDatabase.clear();
    this.insertedCount = 0;
  }

  /**
   * Performs bulk insertion for a chunk of validated user rows.
   * Handles batching, database constraints, and returns list of successful & failed records.
   */
  public async bulkInsertUsers(batch: ValidatedUserRow[]): Promise<{
    inserted: number;
    failed: Array<{ rowNumber: number; email: string; error: string; rawRow: any }>;
  }> {
    if (batch.length === 0) {
      return { inserted: 0, failed: [] };
    }

    const failedInBatch: Array<{ rowNumber: number; email: string; error: string; rawRow: any }> =
      [];
    let batchInserted = 0;

    for (const row of batch) {
      try {
        // Check for email collision in database
        if (UserImportRepository.mockDatabase.has(row.email)) {
          failedInBatch.push({
            rowNumber: row.rowNumber,
            email: row.email,
            error: `Duplicate user error: Email '${row.email}' already exists in database`,
            rawRow: { email: row.email, name: row.name, role: row.role },
          });
          continue;
        }

        const userRecord: DBUserRecord = {
          id: `usr_${Math.random().toString(36).substring(2, 11)}`,
          email: row.email,
          name: row.name,
          role: row.role || "student",
          department: row.department || "General",
          studentId: row.studentId || "",
          phone: row.phone || "",
          createdAt: new Date().toISOString(),
        };

        UserImportRepository.mockDatabase.set(row.email, userRecord);
        batchInserted++;
      } catch (err: any) {
        failedInBatch.push({
          rowNumber: row.rowNumber,
          email: row.email,
          error: `Database constraint failure: ${err?.message || "Unknown db error"}`,
          rawRow: { email: row.email, name: row.name },
        });
      }
    }

    this.insertedCount += batchInserted;
    return {
      inserted: batchInserted,
      failed: failedInBatch,
    };
  }

  /**
   * Retrieves total users inserted in database instance
   */
  public getTotalUserCount(): number {
    return UserImportRepository.mockDatabase.size;
  }

  /**
   * Looks up a user record by email
   */
  public getUserByEmail(email: string): DBUserRecord | undefined {
    return UserImportRepository.mockDatabase.get(email.toLowerCase());
  }
}
