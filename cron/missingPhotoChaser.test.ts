import { describe, it, expect, vi, beforeEach } from "vitest";
import { runMissingPhotoChaser } from "./missingPhotoChaser";
import { query } from "../graphql/db";
import { sendMissingPhotoReminderEmail } from "../src/lib/email/service";

// Mock the graphql/db query helper
vi.mock("../graphql/db", () => ({
  query: vi.fn(),
  closePool: vi.fn(),
}));

// Mock the email service
vi.mock("../src/lib/email/service", () => ({
  sendMissingPhotoReminderEmail: vi.fn(),
}));

describe("Missing Photo Chaser Cron Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should find eligible events with zero photos and no prior reminder", async () => {
    const mockQuery = vi.mocked(query);
    const mockSendEmail = vi.mocked(sendMissingPhotoReminderEmail);

    mockQuery.mockResolvedValueOnce({ 
      rows: [
        {
          event_id: "evt-123",
          title: "Test Event",
          organizer_id: "org-123",
          organizer_email: "org@example.com",
          organizer_name: "John Doe"
        }
      ], 
      rowCount: 1 
    }); 
    
    // For the insertTokenQuery
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    
    // For the markRemindedQuery
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await runMissingPhotoChaser();

    // Verify select query was called with correct conditions (Zero photo detection, duplicate prevention)
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.stringContaining("HAVING COUNT(ep.id) = 0 AND COUNT(gi.id) = 0"));
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.stringContaining("photo_reminder_sent_at IS NULL"));
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.stringContaining("end_date <="));

    // Verify token insertion
    expect(mockQuery).toHaveBeenNthCalledWith(2, expect.stringContaining("INSERT INTO public.photo_upload_tokens"), expect.any(Array));

    // Verify email queue
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: "org@example.com",
      organizerName: "John Doe",
      eventTitle: "Test Event",
      uploadUrl: expect.stringContaining("/upload/magic/"),
    });

    // Verify marking events as reminded (Duplicate reminder prevention)
    expect(mockQuery).toHaveBeenNthCalledWith(3, expect.stringContaining("UPDATE events"), ["evt-123"]);
    expect(mockQuery).toHaveBeenNthCalledWith(3, expect.stringContaining("SET photo_reminder_sent_at = NOW()"));
  });

  it("should not send emails if no eligible events found", async () => {
    const mockQuery = vi.mocked(query);
    const mockSendEmail = vi.mocked(sendMissingPhotoReminderEmail);

    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await runMissingPhotoChaser();

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
