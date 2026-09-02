const mongoose = require('mongoose');

const RadiusAccountingLogSchema = new mongoose.Schema({
  zkProofIdentifier: { type: String, required: true, index: true },
  homeInstitution: { type: String, required: true, default: 'Harvard University' },
  hostInstitution: { type: String, required: true, default: 'MIT' },
  bytesIn: { type: Number, required: true, default: 0 },
  bytesOut: { type: Number, required: true, default: 0 },
  sessionStartTime: { type: Date, required: true },
  sessionEndTime: { type: Date },
  billingStatus: { type: String, enum: ['UNBILLED', 'INVOICED', 'PAID'], default: 'UNBILLED' }
}, { timestamps: true });

module.exports = mongoose.model('RadiusAccountingLog', RadiusAccountingLogSchema);
