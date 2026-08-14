import { describe, it, expect } from "vitest";
import {
  checkAllergenConflict,
  analyzeTableSafety,
  autoResolveSeatingSafety,
  type SeatingAssignment,
  type TableInfo,
} from "./dietaryMatchmaking";

describe("Banquet Dietary Requirement Matchmaking Engine (#3015)", () => {
  const tables: TableInfo[] = [
    { id: "tbl_1", tableNumber: 1, tableName: "Table 1", capacity: 10 },
    { id: "tbl_2", tableNumber: 2, tableName: "Table 2", capacity: 10 },
  ];

  it("identifies allergen conflicts between severe allergies and meal choices", () => {
    expect(checkAllergenConflict("Peanuts", "Peanut Curry Dish")).toBe(true);
    expect(checkAllergenConflict("Peanuts", "Steak & Veggies")).toBe(false);
    expect(checkAllergenConflict("Gluten", "Wheat & Gluten Pasta")).toBe(true);
    expect(checkAllergenConflict("Gluten", "Gluten-Free Pasta")).toBe(false);
  });

  it("detects severe allergen cross-contamination and raises CRITICAL_WARNING", () => {
    const assignments: SeatingAssignment[] = [
      {
        userId: "usr_1",
        userName: "Alice",
        tableId: "tbl_1",
        dietaryNeeds: ["Vegan"],
        severeAllergies: ["Peanuts"],
        mealChoice: "Vegan Salad",
      },
      {
        userId: "usr_2",
        userName: "Bob",
        tableId: "tbl_1",
        dietaryNeeds: [],
        severeAllergies: [],
        mealChoice: "Thai Peanut Noodles",
      },
    ];

    const analysis = analyzeTableSafety(assignments, tables);
    const table1 = analysis.find((a) => a.tableId === "tbl_1");

    expect(table1?.hasCriticalWarning).toBe(true);
    expect(table1?.safetyScore).toBe(0);
    expect(table1?.warnings[0]).toContain("CRITICAL_WARNING");
    expect(table1?.warnings[0]).toContain("Peanuts");
  });

  it("auto-resolves unsafe seating arrangements using greedy heuristic algorithm", () => {
    const unsafeAssignments: SeatingAssignment[] = [
      {
        userId: "usr_1",
        userName: "Alice",
        tableId: "tbl_1",
        dietaryNeeds: ["Vegan"],
        severeAllergies: ["Peanuts"],
        mealChoice: "Vegan Salad",
      },
      {
        userId: "usr_2",
        userName: "Bob",
        tableId: "tbl_1",
        dietaryNeeds: [],
        severeAllergies: [],
        mealChoice: "Thai Peanut Noodles",
      },
      {
        userId: "usr_3",
        userName: "Charlie",
        tableId: "tbl_2",
        dietaryNeeds: [],
        severeAllergies: [],
        mealChoice: "Steak & Veggies",
      },
    ];

    const result = autoResolveSeatingSafety(unsafeAssignments, tables);
    expect(result.isFullyResolved).toBe(true);

    const postAnalysis = analyzeTableSafety(result.resolvedAssignments, tables);
    expect(postAnalysis.every((t) => !t.hasCriticalWarning)).toBe(true);
  });
});
