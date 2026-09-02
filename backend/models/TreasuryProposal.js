const mongoose = require('mongoose');

const TreasuryProposalSchema = new mongoose.Schema({
  clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true, index: true },
  proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetAmount: { type: Number, required: true }, // Locked Allocation Amount
  purpose: { type: String, required: true },
  recipientDetails: { type: String, required: true },
  expiresAt: { type: Date, required: true }, // 72-hour countdown cutoff
  votes: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vote: { type: String, enum: ['YEA', 'NAY'], required: true },
    signature: { type: String, required: true }, // Cryptographically signed approval token
    signedMessage: { type: String, required: true }
  }],
  status: { 
    type: String, 
    enum: ['PENDING_VOTE', 'APPROVED_EXECUTED', 'REJECTED_REVERTED', 'TIMED_OUT'], 
    default: 'PENDING_VOTE',
    index: true
  },
  totalEligibleVoters: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('TreasuryProposal', TreasuryProposalSchema);
