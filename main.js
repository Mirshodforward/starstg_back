import { fork } from "child_process";

function runScript(path) {
  const ps = fork(path);
  ps.on("close", (code) => {
    console.log(`❌ ${path} to'xtadi (exit code: ${code})`);
  });
  ps.on("error", (err) => {
    console.error(`❌ ${path} xato:`, err);
  });
  return ps;
}

// =============================
// 1) Express backend (server.js)
// =============================
console.log("🚀 Backend server starting...");
runScript("./server.js");

// ======================================
// 2) TelegramClient HUMO listener (humo.js)
// ======================================
console.log("📡 HUMO parser starting...");
runScript("./bot.js");


// =============================
// 3) Telegraf bot (bot.js)
// =============================
console.log("🤖 Telegram bot starting...");
runScript("./token.js");

console.log("🔥 Hammasi parallel ishlayapti!");
