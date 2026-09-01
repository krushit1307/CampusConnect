import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

describe("event search synchronization", () => {
  it("stores event versions in the search document", () => {
    const source = fs.readFileSync(
      path.join(
        root,
        "supabase/functions/meilisearch-sync/index.ts",
      ),
      "utf8",
    );

    expect(source).toContain("_sync_version");
    expect(source).toContain("search_sync_version");
  });

  it("checks event versions before applying a webhook", () => {
    const source = fs.readFileSync(
      path.join(
        root,
        "supabase/functions/meilisearch-sync/index.ts",
      ),
      "utf8",
    );

    expect(source).toContain("isStaleEventUpdate");
    expect(source).toContain("stale_event_version");
    expect(source).toContain("incomingVersion < currentVersion");
  });

  it("stores synchronization versions in the DLQ", () => {
    const migration = fs.readFileSync(
      path.join(
        root,
        "supabase/migrations/20260831000003_event_search_sync_consistency.sql",
      ),
      "utf8",
    );

    const syncFunction = fs.readFileSync(
      path.join(
        root,
        "supabase/functions/meilisearch-sync/index.ts",
      ),
      "utf8",
    );

    expect(migration).toContain("sync_version");
    expect(migration).toContain(
      "idx_meilisearch_dlq_event_version",
    );
    expect(syncFunction).toContain("sync_version:");
  });

  it("does not allow stale DLQ events to overwrite newer events", () => {
    const source = fs.readFileSync(
      path.join(
        root,
        "supabase/functions/meilisearch-dlq-retry/index.ts",
      ),
      "utf8",
    );

    expect(source).toContain("currentEvent");
    expect(source).toContain("currentVersion");
    expect(source).toContain("row.sync_version < currentVersion");
  });

  it("excludes cancelled and deleted events from active search", () => {
    const source = fs.readFileSync(
      path.join(
        root,
        "supabase/functions/meilisearch-search/index.ts",
      ),
      "utf8",
    );

    expect(source).toContain("deleted_at IS NULL");
    expect(source).toContain(
      "status NOT IN [cancelled, canceled, archived]",
    );
  });

  it("includes deletion and version state during bulk synchronization", () => {
    const source = fs.readFileSync(
      path.join(
        root,
        "supabase/functions/meilisearch-bulk-sync/index.ts",
      ),
      "utf8",
    );

    expect(source).toContain("deleted_at");
    expect(source).toContain("search_sync_version");
    expect(source).toContain("_sync_version");
  });

  it("keeps the existing event search trigger enabled", () => {
    const migration = fs.readFileSync(
      path.join(
        root,
        "supabase/migrations/20260816000002_meilisearch_dlq.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "on_events_meilisearch_sync",
    );
    expect(migration).toContain(
      "notify_meilisearch_sync",
    );
  });
});