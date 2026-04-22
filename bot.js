require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const express = require('express');

const User = require('./models/User');
const { startScheduler } = require('./services/scheduler');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const PORT = process.env.BOT_PORT || 5002;
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';

if (!BOT_TOKEN || !WEBAPP_URL) {
  const reasons = [];
  if (!BOT_TOKEN) reasons.push('TELEGRAM_BOT_TOKEN');
  if (!WEBAPP_URL) reasons.push('WEBAPP_URL');
  console.log(`Telegram bot disabled: missing ${reasons.join(', ')}`);
  module.exports = { bot: null, notifyStudent: async () => {} };
  return;
}

let bot;
if (USE_WEBHOOK) {
  bot = new TelegramBot(BOT_TOKEN);
} else {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });

  bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code, error.message);
    if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
      console.log('409 conflict detected, stopping polling to prevent duplicate consumers');
      bot.stopPolling().catch((pollingErr) => {
        console.error('Failed to stop polling:', pollingErr.message);
      });
    }
  });
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Bot connected to MongoDB');
    startScheduler(bot);
  })
  .catch((err) => console.error('MongoDB error:', err));

const pending = {};

const mainKeyboard = {
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [
      [{ text: 'Open CoinEd', web_app: { url: WEBAPP_URL } }],
      [
        { text: 'My Balance', callback_data: 'balance' },
        { text: 'Leaderboard', callback_data: 'leaderboard' },
      ],
      [
        { text: 'Unlink', callback_data: 'unlink' },
        { text: 'Help', callback_data: 'help' },
      ],
    ],
  },
};

const loginKeyboard = {
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [
      [{ text: 'Open CoinEd', web_app: { url: WEBAPP_URL } }],
      [{ text: 'Link Account', callback_data: 'link' }],
    ],
  },
};

const notifyKeyboard = {
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [[
      { text: 'Open CoinEd', web_app: { url: WEBAPP_URL } },
      { text: 'My Balance', callback_data: 'balance' },
    ]],
  },
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'Student';
  const student = await User.findOne({ telegramId: chatId.toString(), role: 'student' }).catch(() => null);

  if (student) {
    return bot.sendMessage(
      chatId,
      `Welcome back, *${student.name}*!\n\nBalance: *${student.coins} coins*\n\nChoose an option below.`,
      mainKeyboard
    );
  }

  return bot.sendMessage(
    chatId,
    `Hello, *${firstName}*!\n\n*CoinEd* is the student rewards platform.\n\nLog in with the email and password from your teacher to link your account.`,
    loginKeyboard
  );
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  await bot.answerCallbackQuery(query.id);

  const student = await User.findOne({ telegramId: chatId.toString(), role: 'student' }).catch(() => null);
  const edit = (text, opts = {}) => bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    ...mainKeyboard,
    ...opts,
  });

  if (data === 'link') {
    if (student) {
      return edit(`Your account is already linked.\n*${student.name}* - ${student.coins} coins`);
    }

    pending[chatId] = { step: 'email' };
    return bot.editMessageText(
      'Send the email address you use in CoinEd:',
      { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
    );
  }

  if (data === 'unlink') {
    if (student) {
      student.telegramId = null;
      await student.save();
    }
    delete pending[chatId];
    return bot.editMessageText('Your account has been unlinked.', {
      chat_id: chatId,
      message_id: messageId,
      ...loginKeyboard,
    });
  }

  if (data === 'balance') {
    if (!student) {
      return bot.editMessageText('Your account is not linked yet.', {
        chat_id: chatId,
        message_id: messageId,
        ...loginKeyboard,
      });
    }

    const level = getLevel(student.coins);
    return edit(
      `*${student.name}* - Balance\n\n` +
      `Coins: *${student.coins.toLocaleString()}*\n` +
      `Level: ${level.name}\n` +
      `Class: ${student.class || '-'}\n\n` +
      `${level.bar}`
    );
  }

  if (data === 'leaderboard') {
    const top = await User.find({ role: 'student' }).sort({ coins: -1 }).limit(10);
    const medals = ['🥇', '🥈', '🥉'];
    let text = '*Top Students*\n\n';

    top.forEach((entry, index) => {
      text += `${medals[index] || `${index + 1}.`} *${entry.name}* - ${entry.coins.toLocaleString()} coins\n`;
    });

    if (student) {
      const rank = await User.countDocuments({ role: 'student', coins: { $gt: student.coins } });
      text += `\nYour rank: *#${rank + 1}*`;
    }

    return edit(text);
  }

  if (data === 'help') {
    return edit(
      '*CoinEd Bot*\n\n' +
      'Open the app directly\n' +
      'Check your coin balance\n' +
      'View the leaderboard\n' +
      'Unlink your account\n\n' +
      'Use the same email and password you use in the main app.'
    );
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text || text.startsWith('/')) return;

  const state = pending[chatId];

  if (state?.step === 'email') {
    if (!text.includes('@') || !text.includes('.')) {
      return bot.sendMessage(chatId, 'Please enter a valid email address.', { parse_mode: 'Markdown' });
    }

    pending[chatId] = { step: 'password', email: text.toLowerCase() };
    return bot.sendMessage(chatId, `Email: *${text}*\n\nNow send your password:`, {
      parse_mode: 'Markdown',
    });
  }

  if (state?.step === 'password') {
    const { email } = state;
    delete pending[chatId];

    try {
      const student = await User.findOne({ email, role: 'student' });
      if (!student) {
        return bot.sendMessage(
          chatId,
          `No student account was found for *${email}*. Check the login details from your teacher.`,
          loginKeyboard
        );
      }

      const isMatch = await bcrypt.compare(text, student.password);
      if (!isMatch) {
        return bot.sendMessage(chatId, 'Incorrect password. Please try linking your account again.', {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: 'Try Again', callback_data: 'link' }]] },
        });
      }

      if (student.telegramId && student.telegramId !== chatId.toString()) {
        return bot.sendMessage(chatId, 'This account is already linked to another Telegram account.', {
          parse_mode: 'Markdown',
        });
      }

      student.telegramId = chatId.toString();
      await student.save();

      return bot.sendMessage(
        chatId,
        `*${student.name}* linked successfully.\n\nBalance: *${student.coins} coins*\n\nChoose an option below.`,
        mainKeyboard
      );
    } catch (err) {
      console.error(err);
      return bot.sendMessage(chatId, 'Something went wrong while linking your account.');
    }
  }
});

function getLevel(coins) {
  if (coins >= 5000) return { name: 'Diamond', bar: '██████████ MAX' };
  if (coins >= 2000) return { name: 'Gold', bar: `████████░░ ${coins}/5000` };
  if (coins >= 1000) return { name: 'Silver', bar: `██████░░░░ ${coins}/2000` };
  if (coins >= 500) return { name: 'Bronze', bar: `████░░░░░░ ${coins}/1000` };
  return { name: 'Beginner', bar: `██░░░░░░░░ ${coins}/500` };
}

async function notifyStudent(telegramId, message) {
  if (!telegramId) return;
  try {
    await bot.sendMessage(telegramId, message, notifyKeyboard);
  } catch (err) {
    console.log('Notify error:', err.message);
  }
}

module.exports = { bot, notifyStudent };

if (USE_WEBHOOK) {
  const app = express();
  const botWebhookPath = `/bot${BOT_TOKEN}`;
  const webhookUrl = process.env.WEBHOOK_URL;

  app.use(express.json());

  if (webhookUrl) {
    bot.setWebHook(`${webhookUrl}${botWebhookPath}`)
      .then(() => {
        console.log(`Webhook set to: ${webhookUrl}${botWebhookPath}`);
      })
      .catch((err) => console.error('Webhook error:', err));
  }

  app.post(botWebhookPath, (req, res) => {
    bot.processUpdate(req.body);
    res.send('OK');
  });

  app.listen(PORT, () => {
    console.log(`Telegram bot webhook listener running on port ${PORT}`);
  });
} else {
  console.log('Telegram bot started in polling mode');
}
