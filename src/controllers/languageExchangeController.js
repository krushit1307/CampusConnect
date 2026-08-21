const { findLanguageMatch } = require('../services/languageExchangeService');
const db = require('../models');

async function triggerMatchmaking(req, res) {
  try {
    const { userId } = req.body;
    const matchResult = await findLanguageMatch(userId);

    if (!matchResult.matched) {
      return res.status(200).json(matchResult);
    }

    // If perfect match found: send notification, create calendar invite, and secure chat channel
    const { partnerId, scheduledTime } = matchResult;

    // Simulate notification & secure chat creation
    // e.g., notificationService.send(userId, `We found a Language Partner! You are both free on ${scheduledTime.day}s at ${scheduledTime.hour}:00.`)

    return res.status(200).json({
      success: true,
      message: 'Language partner found!',
      partnerId,
      scheduledTime
    });
  } catch (error) {
    console.error('Error during language exchange matchmaking:', error);
    return res.status(500).json({ error: 'Internal server error during matchmaking.' });
  }
}

module.exports = { triggerMatchmaking };
