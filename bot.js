import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import fetch from "node-fetch";

// ================== CONFIG ==================
const TG_API_ID = Number(process.env.TG_API_ID);
const TG_API_HASH = process.env.TG_API_HASH;
const TG_SESSION = process.env.TG_SESSION;

const HUMO_CHAT_ID = String(process.env.HUMO_CHAT_ID); // 856254490
const TARGET_CARD_SUFFIX = process.env.TARGET_CARD_SUFFIX?.replace(/\D/g, "").slice(-4);

const MATCH_API_STARS = process.env.MATCH_API_STARS;
const MATCH_API_PREMIUM = process.env.MATCH_API_PREMIUM;

// ================== VALIDATION ==================
if (!TG_API_ID || !TG_API_HASH || !TG_SESSION || !HUMO_CHAT_ID || !TARGET_CARD_SUFFIX) {
  console.error("❌ .env dagi o'zgaruvchilar yetarli emas!");
  process.exit(1);
}

// ================== PAYMENT PARSER ==================
function parsePayment(text) {
  if (!text) return null;

  const cardMatch = text.match(/HUMOCARD\s*\*?(\d{4})/i);
  const amountMatch = text.match(/➕\s*([\d.,]+)\s*UZS/i);

  if (!cardMatch || !amountMatch) return null;

  const card_last4 = cardMatch[1];

  const amount = parseFloat(
    amountMatch[1].replace(/\./g, "").replace(",", ".")
  );

  if (!amount || isNaN(amount)) return null;

  return { card_last4, amount, raw_text: text };
}

// ================== MAIN FUNCTION ==================
async function createClient() {
  const client = new TelegramClient(
    new StringSession(TG_SESSION),
    TG_API_ID,
    TG_API_HASH,
    { connectionRetries: Infinity }
  );

  async function startSafe() {
    while (true) {
      try {
        console.log("⏳ Telegramga ulanmoqda...");
        await client.start();
        console.log("✅ Telegram client ulandi!");
        console.log("📡 HUMO botini kuzatish boshlandi...");
        break;
      } catch (e) {
        console.error("❌ Ulanishda xato, qayta urinyapti:", e.message);
        await new Promise(res => setTimeout(res, 5000));
      }
    }
  }

  await startSafe();

  // ================== HANDLER ==================
  client.addEventHandler(
    async (event) => {
      try {
        const msg = event.message;
        if (!msg || !msg.message) return;

        // HUMO botni aniqlash (100% to‘g‘ri)
        const senderId =
          msg.senderId?.userId ||
          msg.peerId?.userId ||
          msg.peerId?.channelId ||
          msg.peerId?.chatId;

        if (String(senderId) !== HUMO_CHAT_ID) return;

        const text = msg.message;
        console.log("📩 [HUMO] Xabar keldi:", text);

        if (!text.includes("HUMOCARD")) return;
        if (!text.includes(TARGET_CARD_SUFFIX)) return;

        const parsed = parsePayment(text);
        if (!parsed) return;

        console.log("💳 To'lov aniqlangan:", parsed);

        // ================== API REQUEST — STARS ==================
        let res = await fetch(MATCH_API_STARS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });

        // Stars topilmasa → PREMIUM
        if (!res.ok) {
          console.log("⭐ Stars topilmadi → Premium tekshirilmoqda...");
          res = await fetch(MATCH_API_PREMIUM, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed),
          });
        }

        if (res.ok) {
          const result = await res.json();
          console.log("🎉 Serverda topildi va tasdiqlandi:", result);
        } else {
          console.log("⚠️ Hech qaysi bazada topilmadi.");
        }

      } catch (err) {
        console.error("❌ Handler xatosi:", err);
      }
    },
    new NewMessage({})
  );

  return client;
}

// ================== RUN ==================
createClient().catch(err => console.error("❌ Bot ishga tushmadi:", err));
