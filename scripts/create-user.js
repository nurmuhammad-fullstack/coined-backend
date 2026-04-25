require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const existing = await User.findOne({ email: 'teacher@school.uz' });
  if (existing) {
    console.log('User already exists, deleting...');
    await User.deleteOne({ email: 'teacher@school.uz' });
  }

  const user = new User({
    name: 'Teacher',
    email: 'teacher@school.uz',
    password: 'admin',
    role: 'teacher',
  });

  await user.save();
  console.log('✅ User created:', user.email, '| role:', user.role);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
