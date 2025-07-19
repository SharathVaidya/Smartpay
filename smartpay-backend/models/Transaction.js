const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  username: String,
  type: String, // 'sent' or 'received'
  amount: Number,
  to: String,
  from: String,
  time: String,
  location: String
});

module.exports = mongoose.model('Transaction', TransactionSchema);
