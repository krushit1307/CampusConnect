import { query, closePool } from "../graphql/db";
import { v4 as uuidv4 } from "uuid";
import { sendMissingPhotoReminderEmail } from "../src/lib/email/service";

/**
 * Sweeps the database to find events that ended >= 48 hours ago,
 * have zero uploaded photos, and haven't had a reminder sent yet.
 * Generates a magic link and queues an email reminder.
 */
export const runMissingPhotoChaser = async () => {
  console.log("[SYSTEM] Running Missing Photo Chaser cron...");

  try {
    // 1. Find eligible events
    // - end_date is <= 48 hours ago
    // - no photo_reminder_sent_at
    // - no associated event_photos or gallery_images
    // - has a valid created_by organizer with an email in auth.users
    const selectQuery = `
      SELECT e.id as event_id, e.title, e.created_by as organizer_id, u.email as organizer_email, p.full_name as organizer_name
      FROM events e
      JOIN profiles p ON e.created_by = p.id
      JOIN auth.users u ON e.created_by = u.id
      LEFT JOIN event_photos ep ON ep.event_id = e.id
      LEFT JOIN gallery_images gi ON gi.event_id = e.id
      WHERE e.end_date <= NOW() - INTERVAL '48 hours'
        AND e.photo_reminder_sent_at IS NULL
      GROUP BY e.id, e.title, e.created_by, u.email, p.full_name
      HAVING COUNT(ep.id) = 0 AND COUNT(gi.id) = 0;
    `;

    const { rows: eligibleEvents } = await query<{
      event_id: string;
      title: string;
      organizer_id: string;
      organizer_email: string;
      organizer_name: string;
    }>(selectQuery);

    console.log(
      `[SYSTEM] Found ${eligibleEvents.length} eligible events for missing photo reminders.`,
    );

    for (const event of eligibleEvents) {
      // 2. Generate a secure, single-purpose magic link token
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now

      const insertTokenQuery = `
        INSERT INTO public.photo_upload_tokens (token, event_id, organizer_id, expires_at)
        VALUES ($1, $2, $3, $4)
      `;
      await query(insertTokenQuery, [token, event.event_id, event.organizer_id, expiresAt]);

      // 3. Queue the email
      const uploadUrl = `${process.env.VITE_PUBLIC_URL || "http://localhost:3000"}/upload/magic/${token}`;

      await sendMissingPhotoReminderEmail({
        to: event.organizer_email,
        organizerName: event.organizer_name,
        eventTitle: event.title,
        uploadUrl,
      });
      console.log(`[SYSTEM] Sent email to ${event.organizer_email} for event ${event.event_id}`);
    }

    // 4. Mark events as reminded
    if (eligibleEvents.length > 0) {
      const eventIds = eligibleEvents.map((e) => e.event_id);

      // Constructing IN clause
      const params = eventIds.map((_, i) => `$${i + 1}`).join(",");
      const markRemindedQuery = `
        UPDATE events
        SET photo_reminder_sent_at = NOW()
        WHERE id IN (${params})
      `;

      await query(markRemindedQuery, eventIds);
      console.log(`[SYSTEM] Marked ${eligibleEvents.length} events as reminded.`);
    }
  } catch (error) {
    console.error("[SYSTEM ERROR] Missing Photo Chaser failed:", error);
    throw error;
  }
};

// Self-executing if invoked directly via CLI (e.g. npx tsx cron/missingPhotoChaser.ts)
if (
  process.argv[1] &&
  (process.argv[1].endsWith("missingPhotoChaser.ts") ||
    process.argv[1].endsWith("missingPhotoChaser.js"))
) {
  (async () => {
    try {
      await runMissingPhotoChaser();
      await closePool();
      process.exit(0);
    } catch (err) {
      console.error("[CLI Execution] Failed:", err);
      try {
        await closePool();
      } catch (e) {
        // ignore
      }
      process.exit(1);
    }
  })();
}
