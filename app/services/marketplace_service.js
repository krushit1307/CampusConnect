/**
 * Service orchestrating the transaction pipeline for the graphic design gig marketplace.
 */
class MarketplaceService {
  /**
   * Evaluates and processes the approval of a design draft, executing direct ledger fund transfers.
   */
  static async acceptDesignDraft(submissionId, dbClient) {
    // Initiate transaction mapping to guarantee financial safety bounds
    await dbClient.query('BEGIN');

    try {
      // 1. Fetch submission details coupled with the parent bounty parameters
      const submissionRes = await dbClient.query(
        `SELECT s.id, s.bounty_id, s.student_id, s.high_res_url, b.club_id, b.payout_amount, b.event_id
         FROM gig_submissions s
         JOIN gig_bounties b ON s.bounty_id = b.id
         WHERE s.id = $1 AND s.status = 'PENDING' AND b.status = 'OPEN'`,
        [submissionId]
      );

      if (submissionRes.rows.length === 0) {
        throw new Error('Invalid or un-processable submission transaction state.');
      }

      const { bounty_id, student_id, high_res_url, club_id, payout_amount, event_id } = submissionRes.rows[0];

      // 2. Debit the buyer club's ledger balance
      const clubLedgerRes = await dbClient.query(
        `UPDATE club_ledgers SET balance = balance - $1 WHERE club_id = $2 AND balance >= $1 RETURNING balance`,
        [payout_amount, club_id]
      );

      if (clubLedgerRes.rows.length === 0) {
        throw new Error('Insufficient Funds: Club ledger balance cannot support this payout amount.');
      }

      // 3. Credit the student's personal platform cashout balance
      await dbClient.query(
        `UPDATE users SET stripe_balance = stripe_balance + $1 WHERE id = $2`,
        [payout_amount, student_id]
      );

      // 4. Synchronize states on the bounty and submission tables
      await dbClient.query(`UPDATE gig_submissions SET status = 'ACCEPTED' WHERE id = $1`, [submissionId]);
      await dbClient.query(`UPDATE gig_bounties SET status = 'FILLED' WHERE id = $2`, [bounty_id]);
      await dbClient.query(`UPDATE gig_submissions SET status = 'REJECTED' WHERE bounty_id = $1 AND id != $2`, [bounty_id, submissionId]);

      // 5. Automatically attach the high-res image directly to the target Event Draft
      if (event_id) {
        await dbClient.query(
          `UPDATE events SET flyer_asset_url = $1 WHERE id = $2`,
          [high_res_url, event_id]
        );
      }

      await dbClient.query('COMMIT');
      return { status: 'SUCCESS', payout_transferred: payout_amount };

    } catch (error) {
      await dbClient.query('ROLLBACK');
      console.error('Marketplace escrow pipeline aborted:', error.message);
      throw error;
    }
  }
}

module.exports = MarketplaceService;
