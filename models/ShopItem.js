// models/ShopItem.js
const mongoose = require('mongoose');

const ShopItemSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  cost:     { type: Number, required: true, min: 1 },
  category: { type: String, enum: ['School Supplies', 'Snacks', 'Academic', 'Fun'], default: 'Fun' },
  emoji:    { type: String, default: '🎁' },
  desc:     { type: String, default: '' },
  tag:      { type: String, default: null },   // "NEW" | "HOT" | null
  active:   { type: Boolean, default: true },
  createdBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('ShopItem', ShopItemSchema);
