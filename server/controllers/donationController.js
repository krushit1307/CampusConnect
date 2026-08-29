import { trackCryptoDonation, activeDonationTracks } from '../services/cryptoDonationService.js';

export const submitCryptoDonationTrack = async (req, res) => {
  try {
    const { clubId, txHash, donorAddress, amount } = req.body;

    if (!txHash || !clubId) {
      return res.status(400).json({ error: "Missing transaction hash or club ID" });
    }

    // Fire and forget tracking function
    trackCryptoDonation(clubId, txHash, donorAddress, amount);

    return res.status(202).json({
      success: true,
      message: "Transaction added to Web3 Monitor queue. Validating on-chain...",
      statusUrl: `/api/donations/crypto/status/${txHash}`
    });

  } catch (error) {
    return res.status(500).json({ error: "Failed to initialize Web3 tracking" });
  }
};

export const getDonationStatus = async (req, res) => {
  const { txHash } = req.params;
  const statusRecord = activeDonationTracks.get(txHash);

  if (!statusRecord) {
    return res.status(404).json({ error: "Transaction not found in monitor queue" });
  }

  return res.status(200).json({ status: statusRecord.status });
};
