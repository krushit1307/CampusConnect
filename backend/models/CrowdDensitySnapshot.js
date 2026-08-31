const mongoose = require('mongoose');

const CrowdDensitySnapshotSchema = new mongoose.Schema({
  venueId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  totalTrackedDevices: { type: Number, required: true },
  flaggedHazards: [{
    centroidX: { type: Number, required: true },
    centroidY: { type: Number, required: true },
    deviceCountInCluster: { type: Number, required: true },
    estimatedDensityPerSqMeter: { type: Number, required: true },
    polygonBounds: [[Number]] // Array of [x, y] coordinates forming the danger zone
  }],
  relayActionTriggered: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('CrowdDensitySnapshot', CrowdDensitySnapshotSchema);
