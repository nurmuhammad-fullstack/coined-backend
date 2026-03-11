// bot.js — CoinEd Telegram Bot
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose    = require('mongoose');
const bcrypt      = require('bcryptjs');
const User        = require('./models/User');
const express     = require('express');
const { startScheduler } = require('./services/scheduler');

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://coin-system-eight.vercel.app';
const PORT       = process.env.BOT_PORT || 5002;

// Check if we're in webhook mode or polling mode
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';

// Create bot instance based on mode
let bot;
if (USE_WEBHOOK) {
  // Webhook mode - more reliable, no 409 conflicts
  bot = new TelegramBot(BOT_TOKEN);
} else {
  // Polling mode with error handling
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  
  // Handle polling errors gracefully
  bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error.code, error.message);
    if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
      console.log('⚠️ 409 Conflict detected - stopping polling to prevent conflicts');
      bot.stopPolling().then(() => {
        console.log('✅ Polling stopped. Consider using webhook mode for production.');
      });
    }
  });
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Bot connected to MongoDB');
    // Start the schedule notification scheduler
    startScheduler(bot);
  })
  .catch(err => console.error('❌ MongoDB error:', err));

// Pending login state
const pending = {}; // { chatId: { step, email } }

// ── Keyboards ─────────────────────────────────────
const mainKeyboard = {
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [
      [{ text: '🌐 CoinEd ni ochish', web_app: { url: WEBAPP_URL } }],
      [
        { text: '🪙 Balansim',  callback_data: 'balance'     },
        { text: '🏆 Reyting',   callback_data: 'leaderboard' },
      ],
      [
        { text: '🔓 Chiqish',   callback_data: 'unlink'      },
        { text: '❓ Yordam',    callback_data: 'help'        },
      ],
    ]
  }
};

const loginKeyboard = {
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [
      [{ text: '🌐 CoinEd ni ochish', web_app: { url: WEBAPP_URL } }],
      [{ text: '🔐 Kirish',           callback_data: 'link'         }],
    ]
  }
};

const notifyKeyboard = {
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [[
      { text: '🌐 CoinEd ni ochish', web_app: { url: WEBAPP_URL } },
      { text: '🪙 Balansim',         callback_data: 'balance'      },
    ]]
  }
};

// ── /start ───────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId  = msg.chat.id;
  const name    = msg.from.first_name || 'Student';
  const student = await User.findOne({ telegramId: chatId.toString(), role: 'student' }).catch(() => null);

  if (student) {
    return bot.sendMessage(chatId,
      `👋 Xush kelibsiz, *${student.name}*!\n\n🪙 Balansingiz: *${student.coins} coin*\n\nNima qilmoqchisiz?`,
      mainKeyboard
    );
  }

  return bot.sendMessage(chatId,
    `👋 Salom, *${name}*!\n\n🪙 *CoinEd* — O'quvchilar uchun mukofot platformasi!\n\nPlatformadagi login va parolingiz bilan kiring:`,
    loginKeyboard
  );
});

// ── Callback query ────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId  = query.message.chat.id;
  const msgId   = query.message.message_id;
  const data    = query.data;
  await bot.answerCallbackQuery(query.id);

  const student = await User.findOne({ telegramId: chatId.toString(), role: 'student' }).catch(() => null);
  const edit = (text, opts = {}) => bot.editMessageText(text, { chat_id: chatId, message_id: msgId, ...mainKeyboard, ...opts });

  if (data === 'link') {
    if (student) return edit(`✅ Hisobingiz allaqachon ulangan!\n*${student.name}* — 🪙 ${student.coins} coin`);
    pending[chatId] = { step: 'email' };
    return bot.editMessageText(
      `🔐 *Hisobga kirish*\n\nPlatformadagi *emailingizni* yuboring:`,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
    );
  }

  if (data === 'unlink') {
    if (student) { student.telegramId = null; await student.save(); }
    delete pending[chatId];
    return bot.editMessageText(`✅ Hisobdan chiqildi.`, { chat_id: chatId, message_id: msgId, ...loginKeyboard });
  }

  if (data === 'balance') {
    if (!student) return bot.editMessageText(`⚠️ Hisob ulanmagan.`, { chat_id: chatId, message_id: msgId, ...loginKeyboard });
    const level = getLevel(student.coins);
    return edit(`🪙 *${student.name}* — Balans\n\n💰 *${student.coins.toLocaleString()} coin*\n🏅 ${level.name}\n📚 Sinf: ${student.class || '—'}\n\n${level.bar}`);
  }

  if (data === 'leaderboard') {
    const top    = await User.find({ role: 'student' }).sort({ coins: -1 }).limit(10);
    const medals = ['🥇','🥈','🥉'];
    let text = `🏆 *Top O'quvchilar*\n\n`;
    top.forEach((s, i) => { text += `${medals[i] || (i+1)+'.'} *${s.name}* — 🪙 ${s.coins.toLocaleString()}\n`; });
    if (student) {
      const rank = await User.countDocuments({ role: 'student', coins: { $gt: student.coins } });
      text += `\n📍 Sizning o'rningiz: *#${rank + 1}*`;
    }
    return edit(text);
  }

  if (data === 'help') {
    return edit(
      `🤖 *CoinEd Bot*\n\n` +
      `🌐 Ilovani to'g'ridan-to'g'ri ochish\n` +
      `🪙 Coin balansini ko'rish\n` +
      `🏆 Reyting jadvalini ko'rish\n` +
      `🔓 Hisobdan chiqish\n\n` +
      `💡 Platformadagi email va parolingiz bilan kirasiz`
    );
  }
});

// ── Message handler ───────────────────────────────
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text   = msg.text?.trim();
  if (!text || text.startsWith('/')) return;

  const state = pending[chatId];

  // Step 1: Email
  if (state?.step === 'email') {
    if (!text.includes('@') || !text.includes('.')) {
      return bot.sendMessage(chatId, `❌ To'g'ri email kiriting.\n_(Masalan: alex@school.uz)_`, { parse_mode: 'Markdown' });
    }
    pending[chatId] = { step: 'password', email: text.toLowerCase() };
    return bot.sendMessage(chatId,
      `📧 Email: *${text}*\n\n🔒 Endi *parolingizni* yuboring:`,
      { parse_mode: 'Markdown' }
    );
  }

  // Step 2: Parol
  if (state?.step === 'password') {
    const { email } = state;
    delete pending[chatId];

    try {
      const student = await User.findOne({ email, role: 'student' });
      if (!student) {
        return bot.sendMessage(chatId,
          `❌ *${email}* topilmadi.\n\nO'qituvchingiz bergan emailni to'g'ri yozing.`,
          loginKeyboard
        );
      }

      const isMatch = await bcrypt.compare(text, student.password);
      if (!isMatch) {
        return bot.sendMessage(chatId,
          `❌ *Parol noto'g'ri!*\n\nQaytadan urinib ko'ring:`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔐 Qayta kirish', callback_data: 'link' }]] }
          }
        );
      }

      if (student.telegramId && student.telegramId !== chatId.toString()) {
        return bot.sendMessage(chatId, `⚠️ Bu hisob boshqa Telegram ga ulangan.`, { parse_mode: 'Markdown' });
      }

      student.telegramId = chatId.toString();
      await student.save();

      return bot.sendMessage(chatId,
        `✅ *${student.name}* — muvaffaqiyatli kirdingiz!\n\n🪙 Balans: *${student.coins} coin*\n\nNima qilmoqchisiz?`,
        mainKeyboard
      );
    } catch (err) {
      console.error(err);
      return bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
    }
  }
});

// ── Level system ──────────────────────────────────
function getLevel(coins) {
  if (coins >= 5000) return { name: '💎 Diamond', bar: '██████████ MAX' };
  if (coins >= 2000) return { name: '🥇 Gold',    bar: '████████░░ ' + coins + '/5000' };
  if (coins >= 1000) return { name: '🥈 Silver',  bar: '██████░░░░ ' + coins + '/2000' };
  if (coins >= 500)  return { name: '🥉 Bronze',  bar: '████░░░░░░ ' + coins + '/1000' };
  return               { name: '🌱 Beginner',     bar: '██░░░░░░░░ ' + coins + '/500'  };
}

// ── Notification (coins route dan chaqiriladi) ────
async function notifyStudent(telegramId, message) {
  if (!telegramId) return;
  try {
    await bot.sendMessage(telegramId, message, notifyKeyboard);
  } catch (err) {
    console.log('Notify error:', err.message);
  }
}

module.exports = { bot, notifyStudent };

// ── Webhook Mode Setup (for production to avoid 409 conflicts) ──
if (USE_WEBHOOK) {
  const app = express();
  app.use(express.json());
  
  const botWebhookPath = `/bot${BOT_TOKEN}`;
  
  // Set webhook
  const WEBHOOK_URL = process.env.WEBHOOK_URL;
  if (WEBHOOK_URL) {
    bot.setWebHook(`${WEBHOOK_URL}${botWebhookPath}`)
      .then(() => {
        console.log(`✅ Webhook set to: ${WEBHOOK_URL}${botWebhookPath}`);
      })
      .catch(err => console.error('❌ Webhook error:', err));
  }
  
  // Handle webhook updates
  app.post(botWebhookPath, (req, res) => {
    bot.processUpdate(req.body);
    res.send('OK');
  });
  
  app.listen(PORT, () => {
    console.log(`🤖 CoinEd Telegram Bot running on webhook port ${PORT}`);
    console.log(`📍 Webhook URL: ${WEBHOOK_URL}${botWebhookPath}`);
  });
} else {
  console.log('🤖 CoinEd Telegram Bot started in polling mode!');
  console.log('💡 Set USE_WEBHOOK=true and WEBHOOK_URL for production');
}
