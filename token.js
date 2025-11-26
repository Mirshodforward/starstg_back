import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN);

// ADMIN IDS → array
const ADMIN_IDS = process.env.ADMIN_IDS.split(',').map(id => Number(id));

// Mini app URL
const APP_URL = process.env.WEBAPP_URL;


// ===============================
// CHIROYLI START XABARI
// ===============================
function getStartText(name) {
  return `
🌟 *StarsPaymee botiga xush kelibsiz, ${name}!*

Bu yerda siz quyidagi xizmatlardan foydalanishingiz mumkin:

⭐ *Telegram Stars* — botlar, mini-apps, reklama, tolovlar uchun  
💎 *Premium* — limitlar ochiladi, yuklab olish, tezlik va boshqa qulayliklar

🪙 *To‘lovlar tiyinigacha aniq*!  
💳 To‘lovlar 100% xavfsiz va avtomatik tarzda tasdiqlanadi.
`;
}


// ===============================
// ADMIN START XABARI
// ===============================
function getAdminText(name) {
  return `
👑 *Admin panelga xush kelibsiz, ${name}!*

Quyida boshqaruv paneliga o‘tishingiz mumkin:
`;
}


// ===============================
// Xavfsiz reply funksiyasi
// ===============================
async function safeReply(ctx, text, keyboard) {
  try {
    await ctx.replyWithMarkdown(text, keyboard);
  } catch (err) {
    // 403 — user botni block qilgan
    if (err?.response?.error_code === 403) {
      console.log(`❌ User ${ctx.from?.id} botni block qilgan ➝ skip`);
      return;
    }

    console.error("❌ Reply error:", err);
  }
}


// ===============================
// /start komandasi
// ===============================
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const fullName = ctx.from.first_name;

  // ADMIN user
  if (ADMIN_IDS.includes(userId)) {
    return await safeReply(
      ctx,
      getAdminText(fullName),
      Markup.inlineKeyboard([
        [
          Markup.button.webApp("⭐ Stars Admin", `${APP_URL}/starsadmin`),
          Markup.button.webApp("💎 Premium Admin", `${APP_URL}/premiumadmin`)
        ]
      ])
    );
  }

  // Oddiy user
  await safeReply(
    ctx,
    getStartText(fullName),
    Markup.inlineKeyboard([
      [
        Markup.button.webApp("⭐ web app", `${APP_URL}/premium`)
      ]
    ])
  );
});


// ===============================
// Botni ishga tushirish
// ===============================
bot.launch()
  .then(() => console.log("🚀 Bot ishlayapti..."))
  .catch(err => console.error("Bot launch error:", err));
