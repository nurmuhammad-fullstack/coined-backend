// seed.js — Run once to add demo users & shop items
// Usage: node seed.js

require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('./models/User');
const ShopItem = require('./models/ShopItem');
const connectDB = require('./config/db');

const USERS = [
  { login: "teacher", name: "Ms. Johnson",   email: "teacher@school.uz", password: "admin", role: "teacher", class: "",    avatar: "MJ", color: "#f97316" },
];

const SHOP_ITEMS = [
  { name: "Pro Backpack",       cost: 1200, category: "School Supplies", emoji: "🎒", tag: "NEW", desc: "Premium quality backpack"        },
  { name: "Lunch Express Pass", cost: 450,  category: "Snacks",          emoji: "🍕", tag: null,  desc: "Skip the lunch line for a week"  },
  { name: "Premium Journal",    cost: 300,  category: "School Supplies", emoji: "📓", tag: null,  desc: "Hardcover ruled notebook"         },
  { name: "+5 Quiz Points",     cost: 500,  category: "Academic",        emoji: "⭐", tag: null,  desc: "Bonus points on next quiz"        },
  { name: "Homework Pass",      cost: 800,  category: "Academic",        emoji: "📝", tag: "HOT", desc: "Skip one homework assignment"     },
  { name: "Movie Day Ticket",   cost: 600,  category: "Fun",             emoji: "🎬", tag: null,  desc: "Join the class movie day"         },
  { name: "Candy Bar",          cost: 100,  category: "Snacks",          emoji: "🍫", tag: null,  desc: "Your favorite candy"              },
  { name: "Extra Recess",       cost: 350,  category: "Fun",             emoji: "⚽", tag: null,  desc: "15 extra minutes of recess"       },
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
  console.log('Teacher:  teacher / admin');
  console.log('Student:  alex / 1234');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });

