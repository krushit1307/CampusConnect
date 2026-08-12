// src/services/__tests__/eventSubmissionService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventSubmissionService } from "../eventSubmissionService";
import { isValidSubmissionFileType, formatFileSize } from "@/types/eventSubmission";

const mockSelect = vi.fn();
const mockUpload = vi.fn();
const mockRemove = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: mockSelect,
          }),
        }),
      }),
      upsert: () => ({
        select: () => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "sub-123",
              event_id: "evt-123",
              user_id: "usr-123",
              file_name: "deck.pdf",
              file_size: 1024500,
              file_type: "application/pdf",
            },
            error: null,
          }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        upload: mockUpload,
        remove: mockRemove,
        getPublicUrl: () => ({ data: { publicUrl: "https://example.com/file.pdf" } }),
      }),
    },
  }),
}));

describe("EventSubmissionService & Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates allowed file extensions correctly", () => {
    const pdfFile = new File(["content"], "presentation.pdf", { type: "application/pdf" });
    const zipFile = new File(["content"], "project.zip", { type: "application/zip" });
    const pptxFile = new File(["content"], "deck.pptx", { type: "application/vnd.ms-powerpoint" });
    const exeFile = new File(["content"], "malware.exe", { type: "application/x-msdownload" });

    expect(isValidSubmissionFileType(pdfFile)).toBe(true);
    expect(isValidSubmissionFileType(zipFile)).toBe(true);
    expect(isValidSubmissionFileType(pptxFile)).toBe(true);
    expect(isValidSubmissionFileType(exeFile)).toBe(false);
  });

  it("formats file sizes nicely", () => {
    expect(formatFileSize(0)).toBe("0 Bytes");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1048576)).toBe("1 MB");
    expect(formatFileSize(524288000)).toBe("500 MB");
  });

  it("rejects invalid file types on upload", async () => {
    const file = new File(["data"], "test.txt", { type: "text/plain" });

    await expect(
      EventSubmissionService.uploadSubmission({
        eventId: "evt-1",
        userId: "usr-1",
        file,
      })
    ).rejects.toThrow(/Invalid file type/);
  });

  it("uploads valid file and returns submission record", async () => {
    mockSelect.mockResolvedValue({ data: null, error: null });
    mockUpload.mockResolvedValue({ data: { path: "evt-1/usr-1/deck.pdf" }, error: null });

    const file = new File(["pdf contents"], "deck.pdf", { type: "application/pdf" });

    const submission = await EventSubmissionService.uploadSubmission({
      eventId: "evt-123",
      userId: "usr-123",
      file,
      teamName: "CyberKnights",
    });

    expect(submission.id).toBe("sub-123");
    expect(submission.file_name).toBe("deck.pdf");
  });
});
