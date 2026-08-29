const mongoose = require('mongoose');

const passkeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  credentialId: { type: String, required: true, unique: true },
  publicKey: { type: String, required: true }, // Base64URL encoded public key
  counter: { type: Number, default: 0 },
  transports: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Passkey', passkeySchema);
