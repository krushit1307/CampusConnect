import { db } from '@/lib/db';
import { sendSMS, sendPushNotification } from '@/lib/services/notifications';

/**
 * Cron task running periodically to handle safety check-ins and escalations.
 */
export async function runSafetyEscalationProtocol() {
  const now = new Date();

  // 1. Send push notifications 2 hours after event end time for safety-ping events
  const pendingNotificationEvents = await db.query(
    `SELECT id, title FROM events 
     WHERE requires_safety_ping = TRUE 
     AND end_time <= $1 
     AND notification_sent = FALSE`,
    [new Date(now.getTime() - 2 * 60 * 60 * 1000)]
  );

  for (const event of pendingNotificationEvents.rows) {
    const attendees = await db.query(
      `SELECT user_id FROM event_attendees WHERE event_id = $1 AND status = 'attended'`,
      [event.id]
    );

    for (const attendee of attendees.rows) {
      await sendPushNotification(
        attendee.user_id,
        `Safety Check-In: ${event.title}`,
        'Please confirm you have safely returned from the trip.'
      );
    }

    await db.query(`UPDATE events SET notification_sent = TRUE WHERE id = $1`, [event.id]);
  }

  // 2. Midnight Escalation: Check for unconfirmed users on completed trips
  const midnightQueryEvents = await db.query(
    `SELECT id, title, club_id FROM events 
     WHERE requires_safety_ping = TRUE 
     AND end_time::date = CURRENT_DATE`
  );

  for (const event of midnightQueryEvents.rows) {
    const unconfirmedUsers = await db.query(
      `SELECT ea.user_id, u.phone_number, u.name 
       FROM event_attendees ea 
       JOIN users u ON ea.user_id = u.id 
       LEFT JOIN safety_confirmations sc ON sc.event_id = ea.event_id AND sc.user_id = ea.user_id
       WHERE ea.event_id = $1 AND ea.status = 'attended' AND (sc.confirmed IS NULL OR sc.confirmed = FALSE)`,
      [event.id]
    );

    if (unconfirmedUsers.rows.length > 0) {
      // Fetch Club President contact
      const president = await db.query(
        `SELECT u.phone_number FROM club_memberships cm 
         JOIN club_roles cr ON cm.role_id = cr.id 
         JOIN users u ON cm.user_id = u.id 
         WHERE cm.club_id = $1 AND cr.title = 'President'`,
        [event.club_id]
      );

      const presidentPhone = president.rows[0]?.phone_number;

      for (const missingUser of unconfirmedUsers.rows) {
        if (presidentPhone) {
          await sendSMS(
            presidentPhone,
            `URGENT: ${missingUser.name} has not confirmed their safe return from "${event.title}". Please contact them immediately.`
          );
        }
      }
    }
  }
}
