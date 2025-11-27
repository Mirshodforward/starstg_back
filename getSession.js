// =============================
//  Telegram Session Generator
//  GramJS orqali SESSION olish
// =============================

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "readline-sync";

const apiId = 20433233;   // 🔥 SENING API_ID
const apiHash = "53fb45760cfa12a3f462b7c542b693e7"; // 🔥 SENING API_HASH

// Bo'sh session bilan boshlaymiz (yangi session hosil qiladi)
const stringSession = new StringSession("");

(async () => {
  console.log("=== TELEGRAM SESSION YARATISH BOSHLANDI ===");

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () =>
      input.question("📱 Telefon raqamingni +998... formatida kiriting: "),
    password: async () =>
      input.question("🔐 Ikki faktor parol (agar bo'lsa): "),
    phoneCode: async () =>
      input.question("✉️ Telegramdan kelgan kodni kiriting: "),
    onError: (err) => console.log("❌ Xatolik:", err),
  });

  console.log("\n🎉 Login muvaffaqiyatli!");
  console.log("\n🔑 SESSION STRING tayyor!");

  const session = client.session.save();

  console.log("\n==== SESSION BELOW ====\n");
  console.log(session);
  console.log("\n=======================");

})();
