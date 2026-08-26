import { describe, expect, it } from "vitest";
import { diffMigrations, listLocalMigrationFiles } from "./verify-migrations";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

describe("verify-migrations helpers", () => {
  it("lists local migration sql files in sorted order", () => {
    const root = mkdtempSync(path.join(tmpdir(), "campus-migrations-"));
    mkdirSync(root, { recursive: true });
    writeFileSync(path.join(root, "20260718000007_db_versioning.sql"), "-- ok");
    writeFileSync(path.join(root, "007_post_reactions.sql"), "-- ok");
    writeFileSync(path.join(root, "README.md"), "ignore");

    expect(listLocalMigrationFiles(root)).toEqual([
      "007_post_reactions.sql",
      "20260718000007_db_versioning.sql",
    ]);
  });

  it("detects migrations missing from db_versions", () => {
    expect(
      diffMigrations(
        ["001_init.sql", "002_profiles.sql", "003_events.sql"],
        ["001_init.sql", "003_events.sql"],
      ),
    ).toEqual({
      missingMigrations: ["002_profiles.sql"],
      extraDbVersions: [],
    });
  });

  it("detects db_versions rows without matching local files", () => {
    expect(diffMigrations(["001_init.sql"], ["001_init.sql", "old.sql"])).toEqual({
      missingMigrations: [],
      extraDbVersions: ["old.sql"],
    });
  });
});
