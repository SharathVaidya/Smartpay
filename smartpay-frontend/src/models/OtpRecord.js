const mongoose = require('mongoose');

const otpRecordSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  otp: String,
  expiresAt: Date,
  attempts: { type: Number, default: 0 },
  lockedUntil: Date,
});

module.exports = mongoose.model('OtpRecord', otpRecordSchema);
