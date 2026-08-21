import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db, saveEventDraft, getEventDraft, deleteEventDraft, DRAFT_VERSION } from "./draftsDb";

describe("Offline Event Drafts DB Suite (#2669)", () => {
  const testDraftId = "event_draft_123";

  beforeEach(async () => {
    await db.event_drafts.clear();
  });

  it("saves a draft to local IndexedDB store", async () => {
    const formData = { title: "Hackathon 2026", description: "Coding contest" };
    await saveEventDraft(testDraftId, formData);

    const retrieved = await getEventDraft(testDraftId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.form_data.title).toBe("Hackathon 2026");
    expect(retrieved?.version).toBe(DRAFT_VERSION);
  });

  it("deletes a draft from store upon successful submission", async () => {
    const formData = { title: "Workshop", description: "AI Dev" };
    await saveEventDraft(testDraftId, formData);

    await deleteEventDraft(testDraftId);
    const retrieved = await getEventDraft(testDraftId);
    expect(retrieved).toBeUndefined();
  });
});
