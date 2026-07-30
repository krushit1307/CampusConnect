import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  queueOfflineEvent,
  getPendingOfflineEvents,
  clearPendingOfflineEvent,
  replayOfflineEvents,
  type QueuedEventPayload,
} from "./offlineSync";

interface FakeRequest<T> {
  result: T;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

// ── In-Memory Fake IndexedDB for Vitest Unit Tests ──
class FakeObjectStore {
  private data = new Map<string, unknown>();

  put(item: { id: string }) {
    this.data.set(item.id, item);
    const req: FakeRequest<undefined> = { result: undefined, onsuccess: null, onerror: null };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }

  getAll() {
    const items = Array.from(this.data.values());
    const req: FakeRequest<unknown[]> = { result: items, onsuccess: null, onerror: null };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }

  delete(id: string) {
    this.data.delete(id);
    const req: FakeRequest<undefined> = { result: undefined, onsuccess: null, onerror: null };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }
}

const sharedStore = new FakeObjectStore();

class FakeTransaction {
  objectStore() {
    return sharedStore;
  }
}

class FakeIDBDatabase {
  objectStoreNames = {
    contains: () => true,
  };
  transaction() {
    return new FakeTransaction();
  }
}

// Mock Supabase Client
const mockInsert = vi.fn();
vi.mock("./supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: mockInsert,
    }),
  }),
}));

// Mock Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Offline Background Sync Module (offlineSync.ts)", () => {
  let fakeDb: FakeIDBDatabase;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - reset private data
    sharedStore["data"].clear();
    fakeDb = new FakeIDBDatabase();

    // Mock global indexedDB
    const openReq: FakeRequest<FakeIDBDatabase> & { onupgradeneeded: (() => void) | null } = {
      result: fakeDb,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };

    // @ts-expect-error - mock indexedDB
    globalThis.indexedDB = {
      open: () => {
        setTimeout(() => openReq.onsuccess?.(), 0);
        return openReq;
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleEvent: QueuedEventPayload = {
    title: "Offline Campus Hackathon",
    description: "Building cool apps offline on campus",
    category_id: "cat-123",
    location: "Auditorium A",
    start_date: "2026-08-01T10:00:00.000Z",
    end_date: "2026-08-01T18:00:00.000Z",
    event_date: "2026-08-01T10:00:00.000Z",
    created_by: "usr-456",
    club_id: "club-789",
    requires_approval: false,
  };

  it("queueOfflineEvent stores event payload in IndexedDB and returns generated ID", async () => {
    const id = await queueOfflineEvent(sampleEvent);
    expect(typeof id).toBe("string");
    expect(id).toMatch(/^offline-evt-/);

    const pending = await getPendingOfflineEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0].payload.title).toBe("Offline Campus Hackathon");
  });

  it("clearPendingOfflineEvent removes item from IndexedDB queue", async () => {
    const id = await queueOfflineEvent(sampleEvent);
    let pending = await getPendingOfflineEvents();
    expect(pending).toHaveLength(1);

    await clearPendingOfflineEvent(id);
    pending = await getPendingOfflineEvents();
    expect(pending).toHaveLength(0);
  });

  it("replayOfflineEvents skips execution when navigator is offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

    await queueOfflineEvent(sampleEvent);
    const result = await replayOfflineEvents();

    expect(result).toEqual({ successCount: 0, failedCount: 0 });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("replayOfflineEvents syncs pending events to Supabase when online", async () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    mockInsert.mockResolvedValue({ data: null, error: null });

    const id = await queueOfflineEvent(sampleEvent);
    const result = await replayOfflineEvents();

    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(mockInsert).toHaveBeenCalledWith(sampleEvent);

    const pending = await getPendingOfflineEvents();
    expect(pending).toHaveLength(0);
  });
});
