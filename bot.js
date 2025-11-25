import 'dotenv/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import fetch from 'node-fetch';

// ========== Config ==========
const TG_API_ID = parseInt(process.env.TG_API_ID);
const TG_API_HASH = process.env.TG_API_HASH;
const TG_SESSION = process.env.TG_SESSION;
const HUMO_CHAT_ID = String(process.env.HUMO_CHAT_ID);
const TARGET_CARD_SUFFIX = process.env.TARGET_CARD_SUFFIX?.replace(/\D/g, '').slice(-4);

// 🔹 Endi ikkita alohida API manzili
const MATCH_API_STARS = process.env.MATCH_API_STARS || 'http://localhost:5000/api/payments/match';
const MATCH_API_PREMIUM = process.env.MATCH_API_PREMIUM || 'http://localhost:5000/api/premium/match';

if (!TG_API_ID || !TG_API_HASH || !TG_SESSION || !HUMO_CHAT_ID || !TARGET_CARD_SUFFIX) {
  console.error('❌ Environment o‘zgaruvchilar yetarli emas. .env faylni tekshiring!');
  process.exit(1);
}

// ========== Payment Parser ==========
function parsePaymentMessage(text) {
  if (!text) return null;

  const cardMatch = text.match(/HUMOCARD\s*\*(\d{4})/i);
  const card_last4 = cardMatch ? cardMatch[1] : null;

  const amountMatch = text.match(/➕\s*([\d.]+),\d{2}\s*UZS/i);
  if (!amountMatch) return null;

  const amount = parseInt(amountMatch[1].replace(/\./g, ''), 10);
  if (isNaN(amount)) return null;

  return { card_last4, amount, full_text: text };
}

// ========== Main Function ==========
async function main() {
  const client = new TelegramClient(
    new StringSession(TG_SESSION),
    TG_API_ID,
    TG_API_HASH,
    { connectionRetries: 5 }
  );

  console.log('⏳ Telegramga ulanmoqda...');
  await client.connect();
  console.log('✅ Telegram bot ulandi!');

  client.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      if (!msg) return;

      const peerId = msg.peerId?.channelId ?? msg.peerId?.chatId ?? msg.peerId?.userId;
      if (String(peerId) !== HUMO_CHAT_ID) return;

      const text = msg.message || '';
      if (!text.includes(TARGET_CARD_SUFFIX)) return;

      const parsed = parsePaymentMessage(text);
      if (!parsed || !parsed.card_last4) return;

      console.log('💳 Yangi to‘lov aniqlangan:', parsed);

      // 🔹 Avval yulduzlar uchun APIga so‘rov yuboramiz
      let res = await fetch(MATCH_API_STARS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      // Agar topilmasa — PREMIUM uchun urinib ko‘ramiz
      if (!res.ok) {
        console.log('⭐ To‘lov stars jadvalida topilmadi, PREMIUM uchun urinilmoqda...');
        res = await fetch(MATCH_API_PREMIUM, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        });
      }

      if (res.ok) {
        const result = await res.json();
        console.log('🎉 To‘lov topildi va tasdiqlandi:', result);
      } else {
        console.warn('⚠️ To‘lov topilmadi!');
      }

    } catch (err) {
      console.error('❌ Xatolik yuz berdi:', err);
    }
  }, new NewMessage({}));

  console.log('📡 HUMO xabarlarini kuzatish boshlandi...');
}

// ========== Run ==========
main().catch((err) => {
  console.error('❌ Bot ishga tushmadi:', err);
});
