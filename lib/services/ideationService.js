import { db } from '@/lib/db';

/**
 * Automatically checks and resolves expired ideation events (72-hour window).
 */
export async function resolveExpiredIdeationEvents() {
  const now = new Date();
  
  // Find events in ideation phase whose 72-hour window has elapsed
  const expiredEvents = await db.query(
    `SELECT * FROM events WHERE status = 'ideation_phase' AND ideation_ends_at <= $1`,
    [now]
  );

  for (const event of expiredEvents.rows) {
    // Determine highest voted options per category
    const winningProposals = await db.query(
      `SELECT DISTINCT ON (category) id, category, option_value 
       FROM event_proposals 
       WHERE event_id = $1 
       ORDER BY category, votes_count DESC`,
      [event.id]
    );

    // Update event with winning options and transition status to 'published' (or 'draft')
    await db.query(
      `UPDATE events SET status = 'published', finalized_attributes = $1 WHERE id = $2`,
      [JSON.stringify(winningProposals.rows), event.id]
    );

    // Notify all users who participated in the ideation phase
    const participants = await db.query(
      `SELECT DISTINCT user_id FROM proposal_votes pv 
       JOIN event_proposals ep ON pv.proposal_id = ep.id 
       WHERE ep.event_id = $1`,
      [event.id]
    );

    for (const participant of participants.rows) {
      await createNotification({
        userId: participant.user_id,
        title: `Event "${event.title}" is now Live!`,
        message: `The co-creation poll has concluded and your event has been published.`
      });
    }
  }
}
