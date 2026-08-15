/**
 * Banquet Dietary Requirement Matchmaking Engine (#3015).
 * Analyzes banquet table seating assignments for severe allergen cross-contamination
 * risks and provides a greedy heuristic auto-resolve algorithm.
 */

export interface SeatingAssignment {
  userId: string;
  userName: string;
  tableId: string;
  dietaryNeeds: string[];
  severeAllergies: string[];
  mealChoice?: string;
}

export interface TableInfo {
  id: string;
  tableNumber: number;
  tableName: string;
  capacity: number;
}

export interface TableSafetyAnalysis {
  tableId: string;
  hasCriticalWarning: boolean;
  warnings: string[];
  safetyScore: number; // 0 to 100
  assignedCount: number;
}

/**
 * Evaluates whether a severe allergy conflicts with a table mate's meal choice.
 * Handles singular/plural stem matching (e.g. "Peanuts" vs "Peanut Curry").
 */
export function checkAllergenConflict(severeAllergy: string, mealChoice?: string): boolean {
  if (!severeAllergy || !mealChoice) return false;
  const allergyClean = severeAllergy.toLowerCase().trim().replace(/s$/, "");
  const mealClean = mealChoice.toLowerCase().trim();

  // Special check for Gluten-Free meal choices (not a conflict for gluten allergy)
  if (allergyClean === "gluten" && mealClean.includes("gluten-free")) {
    return false;
  }

  return allergyClean.length >= 3 && mealClean.includes(allergyClean);
}

/**
 * Analyzes seating assignments per table to detect severe allergen cross-contamination risks.
 */
export function analyzeTableSafety(
  assignments: SeatingAssignment[],
  tables: TableInfo[],
): TableSafetyAnalysis[] {
  const tableAssignmentsMap = new Map<string, SeatingAssignment[]>();

  for (const t of tables) {
    tableAssignmentsMap.set(t.id, []);
  }

  for (const a of assignments) {
    if (tableAssignmentsMap.has(a.tableId)) {
      tableAssignmentsMap.get(a.tableId)!.push(a);
    }
  }

  const result: TableSafetyAnalysis[] = [];

  for (const t of tables) {
    const tableSeats = tableAssignmentsMap.get(t.id) || [];
    const warnings: string[] = [];
    let hasCriticalWarning = false;

    // Cross-reference every attendee's severe allergies against all meal choices at the table
    for (const attendee of tableSeats) {
      if (attendee.severeAllergies && attendee.severeAllergies.length > 0) {
        for (const allergy of attendee.severeAllergies) {
          for (const mate of tableSeats) {
            if (mate.userId !== attendee.userId && mate.mealChoice) {
              if (checkAllergenConflict(allergy, mate.mealChoice)) {
                hasCriticalWarning = true;
                warnings.push(
                  `CRITICAL_WARNING: ${attendee.userName} has severe allergy (${allergy}) but ${mate.userName} has meal choice (${mate.mealChoice}).`,
                );
              }
            }
          }
        }
      }
    }

    result.push({
      tableId: t.id,
      hasCriticalWarning,
      warnings,
      safetyScore: hasCriticalWarning ? 0 : 100,
      assignedCount: tableSeats.length,
    });
  }

  return result;
}

/**
 * Greedy heuristic auto-resolve algorithm that re-assigns unsafe attendees
 * to safe tables to achieve 100% safety compliance.
 */
export function autoResolveSeatingSafety(
  assignments: SeatingAssignment[],
  tables: TableInfo[],
): { resolvedAssignments: SeatingAssignment[]; isFullyResolved: boolean } {
  const resolved = assignments.map((a) => ({ ...a }));
  const initialAnalysis = analyzeTableSafety(resolved, tables);

  const unsafeTableIds = new Set(
    initialAnalysis.filter((a) => a.hasCriticalWarning).map((a) => a.tableId),
  );

  if (unsafeTableIds.size === 0) {
    return { resolvedAssignments: resolved, isFullyResolved: true };
  }

  // Iterate over attendees in unsafe tables and swap them with attendees in safe tables
  for (let i = 0; i < resolved.length; i++) {
    const attendee = resolved[i];
    if (unsafeTableIds.has(attendee.tableId) && attendee.severeAllergies.length > 0) {
      // Find a safe destination table that doesn't conflict
      for (const targetTable of tables) {
        if (targetTable.id !== attendee.tableId) {
          // Attempt temporary move
          const prevTableId = attendee.tableId;
          attendee.tableId = targetTable.id;

          const testAnalysis = analyzeTableSafety(resolved, tables);
          const currentTableAnalysis = testAnalysis.find((ta) => ta.tableId === targetTable.id);
          const oldTableAnalysis = testAnalysis.find((ta) => ta.tableId === prevTableId);

          if (currentTableAnalysis && !currentTableAnalysis.hasCriticalWarning) {
            // Move succeeded in reducing risk
            if (oldTableAnalysis && !oldTableAnalysis.hasCriticalWarning) {
              unsafeTableIds.delete(prevTableId);
            }
            break;
          } else {
            // Revert move if it didn't resolve safety
            attendee.tableId = prevTableId;
          }
        }
      }
    }
  }

  const finalAnalysis = analyzeTableSafety(resolved, tables);
  const isFullyResolved = finalAnalysis.every((a) => !a.hasCriticalWarning);

  return {
    resolvedAssignments: resolved,
    isFullyResolved,
  };
}
