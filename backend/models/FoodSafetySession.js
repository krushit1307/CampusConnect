const mongoose = require('mongoose');

const FoodSafetySessionSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  catererId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inspectionImageRef: { type: String, required: true }, // Secure S3 Object URI
  telemetrySnapshot: {
    reportedSensorTempCelsius: { type: Number },
    ambientHumidityPercent: { type: Number }
  },
  cvAnalysisResults: {
    microbialProliferationIndex: { type: Number, required: true }, // Range: 0.00 - 1.00
    proteinOxidationConfidence: { type: Number, required: true },   // Percentage confidence
    surfaceDiscolorationDetected: { type: Boolean, default: false },
    detectedPathogenMarkers: [{ type: String, enum: ['Salmonella', 'E_Coli', 'Pseudomonas', 'None'] }]
  },
  safetyStatus: { 
    type: String, 
    enum: ['PENDING_VALIDATION', 'VERIFIED_SAFE', 'CONDEMNED_HAZARD'], 
    default: 'PENDING_VALIDATION' 
  },
  stripeEscrowState: { type: String, enum: ['HELD', 'RELEASED', 'FROZEN_LOCKED'], default: 'HELD' }
}, { timestamps: true });

module.exports = mongoose.model('FoodSafetySession', FoodSafetySessionSchema);
