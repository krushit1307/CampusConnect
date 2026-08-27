// src/services/__tests__/faceAutoTaggingService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FaceAutoTaggingService } from "../faceAutoTaggingService";

// Mock Supabase client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockList = vi.fn();
const mockRemove = vi.fn();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockInvoke = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: (...args: any[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: any[]) => {
            mockEq(...eqArgs);
            return {
              maybeSingle: mockMaybeSingle,
              eq: mockEq,
            };
          },
        };
      },
      upsert: (...args: any[]) => {
        mockUpsert(...args);
        return Promise.resolve({ error: null });
      },
      delete: () => ({
        eq: (...args: any[]) => {
          mockDelete(...args);
          return Promise.resolve({ error: null });
        },
      }),
    }),
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
        list: mockList,
        remove: mockRemove,
      }),
    },
    functions: {
      invoke: mockInvoke,
    },
  }),
}));

describe("FaceAutoTaggingService", () => {
  const mockUserId = "user-123-abc";

  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({
      data: {
        user_id: mockUserId,
        opted_in: true,
        face_photos: ["http://test.com/photo1.jpg", "http://test.com/photo2.jpg", "http://test.com/photo3.jpg"],
        face_indexed_at: "2026-08-12T00:00:00Z",
        created_at: "2026-08-12T00:00:00Z",
        updated_at: "2026-08-12T00:00:00Z",
      },
      error: null,
    });

    mockUpload.mockResolvedValue({ data: { path: "user-123-abc/ref.jpg" }, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "http://test.com/photo.jpg" } });
    mockInvoke.mockResolvedValue({ data: { success: true, message: "OK" }, error: null });
    mockList.mockResolvedValue({ data: [] });
    mockRemove.mockResolvedValue({ error: null });
  });

  it("should fetch opt-in status correctly", async () => {
    const status = await FaceAutoTaggingService.getOptInStatus(mockUserId);
    expect(status).not.toBeNull();
    expect(status?.optedIn).toBe(true);
    expect(status?.facePhotos.length).toBe(3);
  });

  it("should throw an error if trying to opt in with fewer than 3 photos", async () => {
    const fakeFile1 = new File(["dummy1"], "face1.jpg", { type: "image/jpeg" });
    const fakeFile2 = new File(["dummy2"], "face2.jpg", { type: "image/jpeg" });

    await expect(
      FaceAutoTaggingService.optInUser(mockUserId, [fakeFile1, fakeFile2])
    ).rejects.toThrow("You must upload 3 clear reference photos");
  });

  it("should successfully opt in user with 3 photos", async () => {
    const fakeFile1 = new File(["dummy1"], "face1.jpg", { type: "image/jpeg" });
    const fakeFile2 = new File(["dummy2"], "face2.jpg", { type: "image/jpeg" });
    const fakeFile3 = new File(["dummy3"], "face3.jpg", { type: "image/jpeg" });

    const res = await FaceAutoTaggingService.optInUser(mockUserId, [fakeFile1, fakeFile2, fakeFile3]);

    expect(res.success).toBe(true);
    expect(mockUpload).toHaveBeenCalledTimes(3);
  });

  it("should opt out user and invoke cleanup", async () => {
    const res = await FaceAutoTaggingService.optOutUser(mockUserId);

    expect(res.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith("facial-recognition", {
      body: { action: "opt_out" },
    });
  });

  it("should remove a photo tag", async () => {
    const res = await FaceAutoTaggingService.removePhotoTag({ tagId: "tag-1", userId: mockUserId });
    expect(res).toBe(true);
  });
});
