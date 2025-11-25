import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN);

// ADMIN IDS → array
const ADMIN_IDS = process.env.ADMIN_IDS.split(',').map(id => Number(id));

// Mini app URL
const APP_URL = process.env.WEBAPP_URL;

// ===============================
// /start komandasi
// ===============================
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const fullName = ctx.from.first_name;

  // Agar Admin bo‘lsa
  if (ADMIN_IDS.includes(userId)) {
    await ctx.reply(
      `👑 Admin aka, xush kelibsiz!\n\n${fullName}, siz admin panelga kirdingiz.`,
      Markup.inlineKeyboard([
        [
          Markup.button.webApp("⭐ Stars panel", APP_URL + "/starsadmin"),
          Markup.button.webApp("💎 Premium panel", APP_URL + "/premiumadmin")
        ]
      ])
    );
    return;
  }

  // Oddiy user uchun xabar
  await ctx.reply(
    `🌟 PremiumFaster botiga xush kelibsiz, ${fullName}!\n\nIltimos, quyidagi xizmatlardan birini tanlang:`,

    Markup.inlineKeyboard([
      [
        Markup.button.webApp("⭐ Stars olish", APP_URL + "/stars"),
        Markup.button.webApp("💎 Premium olish", APP_URL + "/premium")
      ]
    ])
  );
});

// ===============================
// Botni ishga tushirish
// ===============================
bot.launch();
console.log("🚀 Bot ishlayapti...");
