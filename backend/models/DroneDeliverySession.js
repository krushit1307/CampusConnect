const mongoose = require('mongoose');

const DroneDeliverySessionSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  droneId: { type: String, required: true },
  robotProvider: { type: String, enum: ['STARSHIP', 'KIWIBOT'], required: true },
  cargoBayStatus: { type: String, enum: ['LOCKED', 'UNLOCKED_OPEN', 'CLOSED_EMPTY'], default: 'LOCKED' },
  hardwareVerificationSignature: { type: String }, // Cryptographically signed hardware payload
  completionToken: { type: String, required: true, unique: true }, // Passed to Organizer UI for unlock authentication
  escrowStatus: { type: String, enum: ['HELD', 'RELEASED', 'SLASHED_DELAYED'], default: 'HELD' },
  actualDeliveryTime: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('DroneDeliverySession', DroneDeliverySessionSchema);
