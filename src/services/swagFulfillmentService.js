const axios = require('axios');
const db = require('../models');

async function processGraduationSwag(user, clubId) {
  try {
    // 1. Validate eligibility (> 10k points OR executive role)
    const isEligible = user.gamificationPoints > 10000 || user.isExecutive;
    if (!isEligible) {
      return { fulfilled: false, reason: 'User does not meet eligibility criteria.' };
    }

    // 2. Check club ledger balance for $50 available
    const club = await db.Club.findByPk(clubId);
    if (!club || club.ledgerBalance < 50) {
      return { fulfilled: false, reason: 'Insufficient club ledger balance.' };
    }

    const podPayload = {
      recipient: {
        name: user.name,
        address: user.shippingAddress
      },
      item: 'Exclusive Alumni Sweatshirt',
      logoUrl: club.vectorLogoUrl
    };

    // 3. Dispatch Print-on-Demand API webhook first
    const response = await axios.post(process.env.POD_WEBHOOK_URL, podPayload, {
      headers: { Authorization: `Bearer ${process.env.POD_API_KEY}` }
    });

    // 4. Deduct funds only after successful vendor confirmation
    club.ledgerBalance -= 50;
    await club.save();

    return {
      fulfilled: true,
      trackingNumber: response.data.trackingNumber
    };
  } catch (error) {
    console.error('Failed to process graduation swag fulfillment:', error);
    throw error;
  }
}

module.exports = { processGraduationSwag };
