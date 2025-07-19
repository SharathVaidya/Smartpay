const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  username: String,
  otp: String,
  expiresAt: Date,
  attempts: { type: Number, default: 0 },
  sentCount: { type: Number, default: 1 }, // per hour
  createdAt: { type: Date, default: Date.now }
});

otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 }); // auto-delete after 1 hour

module.exports = mongoose.model('Otp', otpSchema);
