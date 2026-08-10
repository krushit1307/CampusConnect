import Dexie, { Table } from "dexie";

export interface EventDraft {
  id: string;
  updated_at: string;
  form_data: Record<string, unknown>;
  version: number;
}

export class DraftsDatabase extends Dexie {
  event_drafts!: Table<EventDraft>;

  constructor() {
    super("CampusConnectDrafts");
    this.version(1).stores({
      event_drafts: "id, updated_at",
    });
  }
}

export const db = new DraftsDatabase();

export const DRAFT_VERSION = 1;

export async function saveEventDraft(
  draftId: string,
  formData: Record<string, unknown>,
): Promise<void> {
  await db.event_drafts.put({
    id: draftId,
    updated_at: new Date().toISOString(),
    form_data: formData,
    version: DRAFT_VERSION,
  });
}

export async function getEventDraft(draftId: string): Promise<EventDraft | undefined> {
  return await db.event_drafts.get(draftId);
}

export async function deleteEventDraft(draftId: string): Promise<void> {
  await db.event_drafts.delete(draftId);
}
