// models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  login:   { type: String, required: true, unique: true, trim: true }, // Username for login
  name:    { type: String, required: true, trim: true },
  email:   { type: String, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 4 },
  role:    { type: String, enum: ['student', 'teacher'], default: 'student' },
  class:   { type: String, default: '' },   // e.g. "8-B"
  avatar:  { type: String, default: '' },   // initials e.g. "AT"
  color:   { type: String, default: '#22c55e' },
  coins:   { type: Number, default: 0 },
  // Teacher-Student relationship
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // For students: references their teacher
}, { timestamps: true });

// Hash password before save
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password
UserSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

// Don't return password
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
