const { verifyPasskeyAssertion } = require('../services/webauthnService');
// Mock waitlist model since it doesn't exist
const Waitlist = {
  findByIdAndUpdate: async (id, update, options) => {
    return { id, ...update };
  }
};

async function handleManualBypassCheckIn(req, res) {
  try {
    const { waitlistEntryId, assertionPayload, expectedChallenge } = req.body;
    const bouncerId = req.user.id; // Resolves logged-in bouncer identity

    if (!assertionPayload) {
      return res.status(401).json({
        error: 'Biometric 2FA Required',
        message: 'A native biometric Passkey assertion is required to authorize manual entry bypasses.'
      });
    }

    // 1. Cryptographically enforce physical bouncer verification bounds
    const verification = await verifyPasskeyAssertion(bouncerId, assertionPayload, expectedChallenge);
    if (!verification.verified) {
      return res.status(403).json({
        error: 'Security Abort',
        message: `Biometric 2FA Verification Failed: ${verification.error}`
      });
    }

    // 2. Safely process the database transaction after authentication
    const updatedEntry = await Waitlist.findByIdAndUpdate(
      waitlistEntryId,
      { status: 'PROMOTED', checkInMethod: 'MANUAL_BYPASS', verifiedBy: bouncerId },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Bypass authorization verified. Entry promoted cleanly.',
      entry: updatedEntry
    });

  } catch (error) {
    console.error('Bypass verification engine dropped error:', error);
    return res.status(500).json({ error: 'Internal system authorization error.' });
  }
}

module.exports = { handleManualBypassCheckIn };
