// seed.js — Run once to add demo users & shop items
// Usage: node seed.js

require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('./models/User');
const ShopItem = require('./models/ShopItem');
const connectDB = require('./config/db');

const USERS = [
  { name: "Nurmuhammad",   email: "teacher@school.uz", password: "admin", role: "teacher", class: "",    avatar: "MJ", color: "#f97316" },
  { name: "TestUser",  email: "test@school.uz",   password: "1234",  role: "student", class: "11-A", avatar: "MG", color: "#3b82f6", coins: 0  },
];

const SHOP_ITEMS = [
  { name: "Pro Backpack", cost: 1200, category: "School Supplies", emoji: "🎒", tag: "NEW", desc: "Premium quality backpack"        },
];

const seed = async () => {
  await connectDB();

  // Clear existing
  await User.deleteMany({});
  await ShopItem.deleteMany({});
  console.log('🗑️  Cleared old data');

  // Insert users
  for (const u of USERS) {
    await User.create(u);
  }
  console.log(`👥 Created ${USERS.length} users`);

  // Insert shop items
  await ShopItem.insertMany(SHOP_ITEMS);
  console.log(`🏪 Created ${SHOP_ITEMS.length} shop items`);

  console.log('\n✅ Seed complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Teacher:  teacher@school.uz / admin');
  console.log('Student:  umar@school.uz / 1234');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
