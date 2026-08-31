// backend/controllers/auctionController.js
// Manages point bidding state machines, anti-sniping windows, and currency deflation loops

// Mock Models for demonstration purposes
const ResourceAuction = {
  findById: async () => ({
    status: 'ACTIVE',
    currentHighestBid: 500,
    endTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    currentLeadingClubId: 'club_1',
    resourceId: 'res_1',
    timeslot: 'slot_1',
    save: async function() { return this; }
  })
};

const GamificationPoints = {
  findOne: async () => ({ availablePoints: 2000 }),
  findOneAndUpdate: async () => ({})
};

const ResourceBooking = {
  create: async () => ({})
};

export const placeAuctionBid = async (req, res) => {
  const { auctionId, bidAmount } = req.body;
  const biddingClubId = req.user.clubId; // Securely pulled via user role-auth middleware

  try {
    const auction = await ResourceAuction.findById(auctionId);
    if (!auction || auction.status !== 'ACTIVE') {
      return res.status(400).json({ error: "Bidding window is closed for this resource." });
    }

    // 1. Verify point balances and minimum incremental step over previous high bid
    if (bidAmount <= auction.currentHighestBid) {
      return res.status(400).json({ error: "Bid must exceed the current highest offer." });
    }

    const clubBalance = await GamificationPoints.findOne({ clubId: biddingClubId });
    if (!clubBalance || clubBalance.availablePoints < bidAmount) {
      return res.status(400).json({ error: "Insufficient gamification points available." });
    }

    // 2. Anti-Sniping Protection Logic (Extend by 5 mins if bid lands within the final 5 mins)
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const timeRemaining = new Date(auction.endTime).getTime() - Date.now();

    if (timeRemaining <= FIVE_MINUTES_MS) {
      auction.endTime = new Date(new Date(auction.endTime).getTime() + FIVE_MINUTES_MS);
      console.log(`[Anti-Sniping Triggered]: Auction extended for ID: ${auctionId}`);
    }

    // 3. Update the leading position atomically
    auction.currentHighestBid = bidAmount;
    auction.currentLeadingClubId = biddingClubId;
    await auction.save();

    return res.status(200).json({ 
      success: "Bid processed successfully.", 
      newHighestBid: auction.currentHighestBid,
      newEndTime: auction.endTime 
    });
  } catch (error) {
    return res.status(500).json({ error: "Auction transaction parsing error.", details: error.message });
  }
};

export const finalizeAuctionAndBurnPoints = async (auctionId) => {
  // Executed via event scheduler or background worker when endTime lapses
  const auction = await ResourceAuction.findById(auctionId);
  if (auction && auction.status === 'ACTIVE') {
    auction.status = 'COMPLETED';
    await auction.save();

    // Deduct and permanently remove points from the active club's balance economy
    await GamificationPoints.findOneAndUpdate(
      { clubId: auction.currentLeadingClubId },
      { $inc: { availablePoints: -auction.currentHighestBid, burnedPointsHistory: auction.currentHighestBid } }
    );

    // Formally assign the disputed asset timeslot reservation to the winning club
    await ResourceBooking.create({
      resourceId: auction.resourceId,
      clubId: auction.currentLeadingClubId,
      timeslot: auction.timeslot,
      status: 'CONFIRMED'
    });
  }
};
