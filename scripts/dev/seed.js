require('dotenv').config();

const User = require('../../models/User');
const ShopItem = require('../../models/ShopItem');
const connectDB = require('../../config/db');

const USERS = [
  {
    name: 'Teacher Demo',
    email: 'teacher@school.uz',
    password: 'admin',
    role: 'teacher',
    class: '',
    avatar: 'TD',
    color: '#f97316',
  },
  {
    name: 'Student Demo',
    email: 'student@school.uz',
    password: '1234',
    role: 'student',
    class: '11-A',
    avatar: 'SD',
    color: '#3b82f6',
    coins: 0,
  },
];

const SHOP_ITEMS = [
  {
    name: 'Pro Backpack',
    cost: 1200,
    category: 'School Supplies',
    emoji: '🎒',
    tag: 'NEW',
    desc: 'Premium quality backpack',
  },
];

const ensureDevelopmentMode = () => {
  if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
    throw new Error('scripts/dev/seed.js can only run when NODE_ENV is development');
  }
};

const seed = async () => {
  ensureDevelopmentMode();
  await connectDB();

  await User.deleteMany({});
  await ShopItem.deleteMany({});
  console.log('Cleared existing demo data');

  for (const user of USERS) {
    await User.create(user);
  }
  await ShopItem.insertMany(SHOP_ITEMS);

  console.log('Seed complete');
  console.log('Teacher: teacher@school.uz / admin');
  console.log('Student: student@school.uz / 1234');
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
