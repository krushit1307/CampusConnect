const mongoose = require('mongoose');

const plagiarismReportSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  studentAId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentBId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  similarityScore: { type: Number, required: true },
  repoA: { type: String, required: true },
  repoB: { type: String, required: true },
  status: { type: String, enum: ['FLAGGED', 'REVIEWED', 'CONFIRMED'], default: 'FLAGGED' },
  resolvedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('PlagiarismReport', plagiarismReportSchema);
