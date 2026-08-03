import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueueOfflineMutation,
  getPendingOfflineMutations,
  clearPendingOfflineMutation,
  replayOfflineMutations,
  QueuedMutationItem,
} from "./offlineMutationQueue";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("./supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-123" } } }, error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
    },
    from: (table: string) => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    }),
  }),
}));

// In-memory IndexedDB Mock for Vitest
function setupIndexedDBMock() {
  const storeMap = new Map<string, QueuedMutationItem>();

  const mockDB = {
    objectStoreNames: {
      contains: () => true,
    },
    createObjectStore: () => ({
      createIndex: () => {},
    }),
    transaction: () => ({
      objectStore: () => ({
        getAll: () => {
          const req: { result?: QueuedMutationItem[]; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
            result: Array.from(storeMap.values()),
            onsuccess: null,
            onerror: null,
          };
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        },
        put: (item: QueuedMutationItem) => {
          storeMap.set(item.id, item);
          const req: { onsuccess: (() => void) | null; onerror: (() => void) | null } = {
            onsuccess: null,
            onerror: null,
          };
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        },
        delete: (id: string) => {
          storeMap.delete(id);
          const req: { onsuccess: (() => void) | null; onerror: (() => void) | null } = {
            onsuccess: null,
            onerror: null,
          };
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        },
      }),
    }),
  };

  const mockIDB = {
    open: () => {
      const req: { result: typeof mockDB; onsuccess: (() => void) | null; onerror: (() => void) | null; onupgradeneeded: (() => void) | null } = {
        result: mockDB,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      setTimeout(() => {
        req.onupgradeneeded?.();
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };

  vi.stubGlobal("indexedDB", mockIDB);
  return storeMap;
}

describe("Offline Mutation Queue & Conflict Resolution (#1756)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    setupIndexedDBMock();
    const items = await getPendingOfflineMutations();
    for (const item of items) {
      await clearPendingOfflineMutation(item.id);
    }
  });

  it("queues an offline mutation into IndexedDB", async () => {
    const id = await enqueueOfflineMutation({
      type: "like",
      targetId: "post-101",
      action: "add",
      payload: { postId: "post-101", emoji: "❤️" },
    });

    expect(id).toBeDefined();

    const pending = await getPendingOfflineMutations();
    expect(pending.length).toBe(1);
    expect(pending[0].targetId).toBe("post-101");
    expect(pending[0].action).toBe("add");
  });

  it("squashes conflicting mutations (add followed by remove) so they cancel out", async () => {
    // 1. User likes post-202 offline
    await enqueueOfflineMutation({
      type: "like",
      targetId: "post-202",
      action: "add",
      payload: { postId: "post-202", emoji: "❤️" },
    });

    let pending = await getPendingOfflineMutations();
    expect(pending.length).toBe(1);

    // 2. User un-likes post-202 offline
    await enqueueOfflineMutation({
      type: "like",
      targetId: "post-202",
      action: "remove",
      payload: { postId: "post-202", emoji: "❤️" },
    });

    // 3. Conflict resolution: They squash and cancel each other out!
    pending = await getPendingOfflineMutations();
    expect(pending.length).toBe(0);
  });

  it("replays offline mutations sequentially on reconnect", async () => {
    await enqueueOfflineMutation({
      type: "rsvp",
      targetId: "evt-555",
      action: "add",
      payload: { eventId: "evt-555" },
    });

    const res = await replayOfflineMutations();
    expect(res.successCount).toBe(1);

    const pending = await getPendingOfflineMutations();
    expect(pending.length).toBe(0);
  });
});
