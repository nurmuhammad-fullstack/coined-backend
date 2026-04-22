// scheduler.js - Class schedule notification scheduler
require('dotenv').config();
const cron = require('node-cron');
const mongoose = require('mongoose');

const Class = require('../models/Class');
const User = require('../models/User');

// Day mapping for scheduling
const dayMap = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday'
};

// Helper to notify students via bot
async function notifyStudents(bot, className, message) {
  try {
    // Find all students in this class
    const students = await User.find({ 
      role: 'student', 
      class: className,
      telegramId: { $exists: true, $ne: null }
    });
    
    for (const student of students) {
      if (student.telegramId) {
        try {
          await bot.sendMessage(
            student.telegramId,
            message,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '🌐 CoinEd ni ochish', web_app: { url: process.env.WEBAPP_URL } }
                  ]
                ]
              }
            }
          );
          console.log(`✅ Notification sent to ${student.name} (${student.telegramId})`);
        } catch (err) {
          console.log(`❌ Failed to notify ${student.name}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('Error notifying students:', err.message);
  }
}

// Main scheduler function
function startScheduler(bot) {
  console.log('📅 Schedule notification scheduler started!');
  
  // Run every minute to check for notifications
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const currentDay = dayMap[now.getDay()];
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // Format current time as HH:MM
      const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      
      // Find all classes with enabled schedule for current day
      const classes = await Class.find({
        'schedule.enabled': true,
        'schedule.days': currentDay
      });
      
      for (const cls of classes) {
        const scheduleTime = cls.schedule.time; // HH:MM format
        const [schedHour, schedMin] = scheduleTime.split(':').map(Number);
        
        // Calculate notification times
        const classTimeInMinutes = schedHour * 60 + schedMin;
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        
        // 8 hours before (480 minutes)
        const eightHoursBefore = classTimeInMinutes - 480;
        
        // 10 minutes before
        const tenMinutesBefore = classTimeInMinutes - 10;
        
        // Check if we should send 8 hours before notification
        if (cls.schedule.notifyBefore8Hours && currentTimeInMinutes === eightHoursBefore) {
          const message = `⏰ *Eslatma!*\n\n📚 *${cls.name}* sinfi uchun darsingiz *8 soatdan so'ng* boshlanadi!\n\n🕐 Vaqt: *${scheduleTime}*\n\nDarsga tayyorlaning!`;
          console.log(`📨 Sending 8-hour notification for ${cls.name} at ${currentTime}`);
          await notifyStudents(bot, cls.name, message);
        }
        
        // Check if we should send 10 minutes before notification
        if (cls.schedule.notifyBefore10Minutes && currentTimeInMinutes === tenMinutesBefore) {
          const message = `🔔 *Dars boshlanishiga 10 daqiqa qoldi!*\n\n📚 *${cls.name}* - darsingiz boshlanmoqda!\n\n🕐 Boshlanish vaqti: *${scheduleTime}*\n\nKirishni bosing!`;
          console.log(`📨 Sending 10-minute notification for ${cls.name} at ${currentTime}`);
          await notifyStudents(bot, cls.name, message);
        }
      }
    } catch (err) {
      console.error('Scheduler error:', err.message);
    }
  });
}

module.exports = { startScheduler };

