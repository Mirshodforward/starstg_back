import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import fetch from "node-fetch";

// ================== CONFIG ==================
const TG_API_ID = Number(process.env.TG_API_ID);
const TG_API_HASH = process.env.TG_API_HASH;
const TG_SESSION = process.env.TG_SESSION;

const HUMO_CHAT_ID = String(process.env.HUMO_CHAT_ID); // Bot user ID
const TARGET_CARD_SUFFIX = process.env.TARGET_CARD_SUFFIX?.replace(/\D/g, "").slice(-4);

const MATCH_API_STARS = process.env.MATCH_API_STARS;
const MATCH_API_PREMIUM = process.env.MATCH_API_PREMIUM;

// Validation
if (!TG_API_ID || !TG_API_HASH || !TG_SESSION || !HUMO_CHAT_ID || !TARGET_CARD_SUFFIX) {
  console.error("❌ .env dagi o'zgaruvchilar yetarli emas!");
  process.exit(1);
}

// ================== PARSER ==================
function parsePayment(text) {
  if (!text) return null;

  const cardMatch = text.match(/HUMOCARD\s*\*?(\d{4})/i);
  const card_last4 = cardMatch ? cardMatch[1] : null;

  const amountMatch = text.match(/➕\s*([\d.,]+)\s*UZS/i);
  if (!amountMatch) return null;

  const amountRaw = amountMatch[1]
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = parseFloat(amountRaw);

  if (!card_last4 || !amount) return null;

  return { card_last4, amount, raw_text: text };
}
// Simple fetch with timeout
async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ================== AutoReconnect (exponential backoff) ==================
async function autoReconnect(client) {
  let backoff = 2000; // 2s
  const maxBackoff = 60000; // 60s

  while (true) {
    try {
      if (!client.connected) {
        console.warn("⚠️ Aloqa uzildi! Qayta ulanmoqda...");
        await client.connect();
        console.log("✅ Qayta ulandi!");
        backoff = 2000; // reset backoff on success
      }
    } catch (err) {
      console.error("❌ Qayta ulanish xatosi:", err?.message || err);
      // increase backoff
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(backoff * 2, maxBackoff);
    }
    // check every 3s if connected, otherwise loop will try connect sooner due to backoff
    await new Promise((res) => setTimeout(res, 3000));
  }
}

// ================== MAIN ==================
async function main() {
  const client = new TelegramClient(
    new StringSession(TG_SESSION),
    TG_API_ID,
    TG_API_HASH,
    { connectionRetries: 50 } // 10 is fine when we have our own reconnect logic
  );

  console.log("⏳ Telegramga ulanmoqda...");

  try {
    await client.start();
  } catch (err) {
    console.error("❌ client.start() xatosi:", err);
    process.exit(1);
  }

  console.log("✅ Telegram client ulandi!");
  console.log("📡 Faqat HUMO botini kuzatamiz...");

  // Start autoReconnect in background (don't await)
  autoReconnect(client).catch((e) => console.error("autoReconnect failed:", e));

  // ================== PAYMENT HANDLER (YAGONA HANDLER) ==================
  client.addEventHandler(
    async (event) => {
      try {
        const msg = event.message;
        if (!msg) return;

        // 1) Peer ID → faqat HUMO bot xabarlari
        const peerId =
          msg.peerId?.channelId ??
          msg.peerId?.chatId ??
          msg.peerId?.userId;

        if (String(peerId) !== HUMO_CHAT_ID) return;

        // 2) Debug — faqat HUMO bot uchun
        console.log("📩 [HUMO] Xabar keldi:", {
          peerId,
          text: msg.message,
        });

        // 3) Text olib
        const text = msg.message || "";
        if (!text.includes("HUMOCARD")) return;

        // 4) Kartani filtrlaymiz
        if (!text.includes(TARGET_CARD_SUFFIX)) return;

        // 5) Parsing
        const parsed = parsePayment(text);
        if (!parsed) return;

        console.log("💳 To'lov aniqlandi:", parsed);

        // 6) Stars API
        let res = await fetch(MATCH_API_STARS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });

        if (!res.ok) {
          console.log("⭐ Starsda topilmadi → PREMIUM urinyapti...");
          res = await fetch(MATCH_API_PREMIUM, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed),
          });
        }

        if (res.ok) {
          const result = await res.json();
          console.log("🎉 Muvaffaqiyatli topildi:", result);
        } else {
          console.log("⚠️ Hech qaysi bazada topilmadi");
        }
      } catch (err) {
        console.error("❌ Handler xatosi:", err);
      }
    },
    new NewMessage({})
  );
  // Graceful shutdown handlers
  const shutdown = async (sig) => {
    console.log(`\n🛑 Qabul qilindi ${sig}. Clientni yopilmoqda...`);
    try {
      await client.disconnect();
      console.log("✅ Client uzildi. Jarayon tugaydi.");
    } catch (e) {
      console.error("❌ Clientni uzishda xato:", e);
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // KEEP PROCESS ALIVE (GramJS has no runUntilDisconnected)
  await new Promise(() => {});
}

// ================== RUN ==================
main().catch((err) => console.error("❌ Bot ishga tushmadi:", err));
