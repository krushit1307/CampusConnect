const mongoose = require('mongoose');

const biometricBaselineSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  metrics: {
    blinkRate: { mean: Number, stdDev: Number },
    microTwitches: { mean: Number, stdDev: Number },
    expressionIntensity: { mean: Number, stdDev: Number }
  },
  isCalibrated: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('BiometricBaseline', biometricBaselineSchema);
