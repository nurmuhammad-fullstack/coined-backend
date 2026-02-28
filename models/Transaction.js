// models/Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  student:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacher:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  label:    { type: String, required: true },
  type:     { type: String, enum: ['earn', 'spend'], required: true },
  amount:   { type: Number, required: true },  // positive = earn, negative = spend
  category: { type: String, enum: ['homework', 'behavior', 'reward', 'shop', 'other'], default: 'other' },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
