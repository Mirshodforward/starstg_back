import express from "express";
import pkg from "pg";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import crypto from "crypto";
dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());
const PREMIUM_3 = parseInt(process.env.VITE_PREMIUM_3);
const PREMIUM_6 = parseInt(process.env.VITE_PREMIUM_6);
const PREMIUM_12 = parseInt(process.env.VITE_PREMIUM_12);

// ======================
// Postgresga ulanish
// ======================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ======================
// Jadval yaratish
// ======================
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      username TEXT,
      recipient TEXT,             -- 🆕 RobynHood uchun kerak bo‘lgan ustun
      stars INTEGER,
      amount INTEGER NOT NULL,
      card_last4 VARCHAR(4),
      status VARCHAR(32) DEFAULT 'pending',
      transaction_id TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Tashkent')
    );
  `);
  console.log("✅ Table 'transactions' ready (with recipient)");
})();


(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions_premium (
  id SERIAL PRIMARY KEY,
  username TEXT,
  recipient TEXT,               -- 🆕 RobynHood purchase uchun
  muddat_oy INTEGER,
  amount INTEGER NOT NULL,
  card_last4 VARCHAR(4),
  status VARCHAR(32) DEFAULT 'pending',
  transaction_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Tashkent')
);
  `);
  console.log("✅ Table 'transactions_premium' ready");
})();

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS secret_informations (
  card_number TEXT,
  card_name TEXT,               
  fragment_api TEXT,
  telegram_session TEXT,
  tg_api_id TEXT,
  tg_api_hash TEXT,
  bot_token TEXT
  
);
  `);
  console.log("✅ Table 'secret_informations' ready");
})();

// ======================
// 3️⃣ Backend holati
// ======================
app.get("/api/status", (req, res) => {
  res.json({ message: "Sayt aktiv holatda ✅" });
});


// ======================
// 6️⃣ Admin panel - barcha transactionlarni olish
// ======================


app.get("/api/transactions/all", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM transactions ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======================
// 2️⃣ Status bo‘yicha filter
// ======================
app.get("/api/transactions/status/:status", async (req, res) => {
  const { status } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM transactions WHERE status=$1 ORDER BY id DESC",
      [status]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======================
// 3️⃣ Transaction status update
// ======================
app.patch("/api/transactions/update/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await pool.query(
      "UPDATE transactions SET status=$1 WHERE id=$2 RETURNING *",
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Transaction not found" });
    res.json({ success: true, transaction: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// =================================================
// 1️⃣ Telegram userni qidirish —— RobynHood API versiyasi
// =================================================
app.post("/api/search", async (req, res) => {
  try {
    console.log("=== 🔍 /api/search (RobynHood) boshlandi ===");

    let { username } = req.body;
    console.log("📥 Keldi username:", username);

    if (!username) {
      return res.status(400).json({ error: "username kerak" });
    }

    const cleanUsername = username.startsWith("@")
      ? username.slice(1)
      : username;

    console.log("🧹 Tozalangan username:", cleanUsername);

    // 🟦 RobynHood API ga so‘rov yuboramiz
    console.log("🌐 RobynHood API'ga so‘rov yuborilmoqda...");

    const response = await fetch("https://robynhood.parssms.info/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.ROB_API_KEY, // bu yerga API key qo'yiladi
        "accept": "application/json",
      },
      body: JSON.stringify({
        product_type: "stars",
        query: cleanUsername,
        quantity: "50",
      }),
    });

    console.log("📡 Javob status kodi:", response.status);

    const text = await response.text();
    console.log("📦 API xom javob:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("❌ JSON parse xato:", err);
      return res.status(500).json({
        error: "API noto'g'ri format qaytardi",
        raw: text,
      });
    }

    console.log("🔍 JSON parse bo‘ldi:", data);

    if (!data.ok || !data.found) {
      return res.status(404).json({
        error: "Foydalanuvchi topilmadi",
        details: data,
      });
    }

    const found = data.found;
    const fullName = found.name || cleanUsername;
    const recipient = found.recipient;
    const photoHTML = found.photo || "";

    // HTML <img ...> dan src URL ajratamiz
    const match = photoHTML.match(/src="([^"]+)"/);
    const imageUrl = match ? match[1] : null;

    console.log("👤 Foydalanuvchi:", fullName);
    console.log("🖼️ Rasm URL:", imageUrl);
    console.log("🆔 Recipient ID:", recipient);

    return res.json({
      username: cleanUsername,
      fullName: fullName,
      imageUrl: imageUrl,
      recipient: recipient, // ⚠ MUHIM — purchase uchun shu kerak
    });

  } catch (err) {
    console.error("💥 Server xato:", err);
    return res.status(500).json({
      error: "Serverda xatolik",
      details: err.message,
    });
  }
});


// ======================
// 2️⃣ Order yaratish — RobynHood API uchun moslangan
// ======================
app.post("/api/order", async (req, res) => {
  try {
    const { username, recipient, stars, amount } = req.body;

    // ⚠️ Endi recipient majburiy!
    if (!username || !recipient || !stars || !amount) {
      return res.status(400).json({
        error: "username, recipient, stars, amount kerak"
      });
    }

    const cleanUsername = username.startsWith("@")
      ? username.slice(1)
      : username;

    // 🔢 Tasodifiy offset (unique amount uchun)
    let offset = Math.floor(Math.random() * 101) - 50;
    let uniqueAmount = amount + offset;

    // 🔄 Takrorlanmasligini tekshirish
    let exists = await pool.query(
      "SELECT 1 FROM transactions WHERE amount = $1 AND status = 'pending'",
      [uniqueAmount]
    );

    while (exists.rows.length > 0) {
      offset = Math.floor(Math.random() * 101) - 50;
      uniqueAmount = amount + offset;

      exists = await pool.query(
        "SELECT 1 FROM transactions WHERE amount = $1 AND status = 'pending'",
        [uniqueAmount]
      );
    }

    // 🟦 Yangi yozuv (recipient bilan)
    const result = await pool.query(
      `INSERT INTO transactions (username, recipient, stars, amount, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING *`,
      [cleanUsername, recipient, stars, uniqueAmount]
    );

    const order = result.rows[0];

    console.log(
      `🧾 Order yaratildi: ${order.username} | ${order.recipient} | ${order.amount} so'm | ${order.stars}⭐`
    );

    // 1 soatdan keyin expired
    setTimeout(async () => {
      try {
        const check = await pool.query(
          "SELECT status FROM transactions WHERE id = $1",
          [order.id]
        );

        if (check.rows[0]?.status === "pending") {
          await pool.query(
            "UPDATE transactions SET status='expired' WHERE id=$1",
            [order.id]
          );
          console.log(`⏰ Order #${order.id} expired`);
        }
      } catch (e) {
        console.error("❌ Expiry tekshirishda xato:", e);
      }
    }, 60 * 60 * 1000);

    res.json(order);

  } catch (err) {
    console.error("❌ /api/order error:", err);
    res.status(500).json({ error: "Server error" });
  }
});



// ======================
// 4️⃣ Order holatini olish (to'g'ri, xavfsiz versiya)
// ======================
app.get("/api/transactions/:id", async (req, res) => {
  let { id } = req.params;

  // 🛑 ID yo‘q yoki raqam emas
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: "ID noto‘g‘ri yoki kiritilmagan" });
  }

  id = Number(id); // integerga aylantiramiz

  try {
    const result = await pool.query(
      "SELECT * FROM transactions WHERE id = $1",
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("❌ /api/transactions/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ======================
// 5️⃣ Telegram bot to‘lovni tasdiqlaydi — RobynHood versiyasi
// ======================
app.post("/api/payments/match", async (req, res) => {
  try {
    const { card_last4, amount } = req.body;
    if (!card_last4 || !amount)
      return res.status(400).json({ error: "card_last4 va amount kerak" });

    // Pending bo‘lgan orderni topamiz
    const result = await pool.query(
      "SELECT * FROM transactions WHERE amount = $1 AND status = 'pending' ORDER BY id DESC LIMIT 1",
      [amount]
    );

    if (!result.rows.length)
      return res.status(404).json({ message: "Pending payment not found" });

    const order = result.rows[0];

    // To‘lovni tasdiqlaymiz
    const updated = await pool.query(
      `UPDATE transactions
       SET status = 'completed',
           card_last4 = $1
       WHERE id = $2
       RETURNING *`,
      [card_last4, order.id]
    );

    console.log(`🎉 To‘lov tasdiqlandi: ${order.username} | ${order.amount} so‘m | ${order.stars}⭐`);

    // ⭐ RobynHood orqali yulduz yuboramiz
    sendStarsToUser(order.id, order.recipient, order.stars)
      .then(tx => {
        console.log(`🌟 ${order.username} ga ${order.stars}⭐ yuborildi! TxID: ${tx}`);
      })
      .catch(err => {
        console.error("❌ Yulduz yuborishda xato:", err.message);
      });

    res.json(updated.rows[0]);

  } catch (err) {
    console.error("❌ /api/payments/match error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======================
// 🔹 Yulduzlarni foydalanuvchiga yuborish - RobynHood API orqali --------------------------------REAL?TEST
// ======================

async function sendStarsToUser(orderId, recipientId, stars) {
  try {
    console.log("🔹 sendStarsToUser:", { orderId, recipientId, stars });

    const idempotencyKey = crypto.randomUUID();

    const purchaseBody = {
      product_type: "stars",
      recipient: recipientId,        
      quantity: String(stars),
      idempotency_key: idempotencyKey,
    };

    const purchaseRes = await fetch("https://robynhood.parssms.info/api/purchase", {  // real
    //const purchaseRes = await fetch("https://robynhood.parssms.info/api/test/purchase", { // test

      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
        "X-API-Key": process.env.ROB_API_KEY,
      },
      body: JSON.stringify(purchaseBody),
    });

    const text = await purchaseRes.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error("Purchase API noto'g'ri format qaytardi: " + text);
    }

    console.log("📦 Purchase javob:", data);

    if (!data.transaction_id) {
      await pool.query(
        "UPDATE transactions SET status = $1 WHERE id = $2",
        ["failed", orderId]
      );
      throw new Error("Purchase error: " + JSON.stringify(data));
    }

    const txId = data.transaction_id;

    await pool.query(
      `UPDATE transactions
       SET status='stars_sent',
           transaction_id=$1
       WHERE id=$2`,
      [txId, orderId]
    );

    console.log(`✅ Stars yuborildi: ${orderId} -> ${txId}`);
    return txId;

  } catch (err) {
    console.error("❌ sendStarsToUser error:", err);
    await pool.query("UPDATE transactions SET status='error' WHERE id=$1", [orderId]);
    throw err;
  }
}

//-----------------------
// 🔍 PREMIUM SEARCH (FULL LOG VERSION)
//-----------------------
app.post("/api/premium/search", async (req, res) => {
  try {
    let { username } = req.body;

    console.log("\n================ PREMIUM SEARCH ================");
    console.log("📥 Keldi username:", username);

    if (!username) {
      console.log("⛔ username yo‘q");
      return res.status(400).json({ error: "username kerak" });
    }

    const clean = username.startsWith("@")
      ? username.slice(1)
      : username;

    console.log("🧹 Tozalangan username:", clean);

    // RobynHood API
    console.log("🌐 Providerga so‘rov yuborilmoqda...");

    const response = await fetch("https://robynhood.parssms.info/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.ROB_API_KEY,
        accept: "application/json",
      },
      body: JSON.stringify({
        product_type: "premium",
        query: clean,
        months: "3",
      }),
    });

    console.log("📡 Provider status:", response.status);

    const raw = await response.text();
    console.log("📦 Provider RAW response:", raw);

    // Provider offline -> "false"
    if (raw.trim() === "false") {
      console.log("❌ Provider OFFLINE yoki IP blok");
      return res.status(503).json({
        error: "Provider offline yoki IP bloklangan"
      });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.log("❌ JSON parse xato:", err);
      return res.status(502).json({
        error: "Provider noto‘g‘ri format qaytardi",
        raw
      });
    }

    console.log("🔍 Provider JSON:", data);

    if (!data.ok || !data.found) {
      console.log("❌ found=false → Premium yo‘q yoki user topilmadi");
      return res.status(404).json({
        error: "❌ Premium mavjud emas yoki user yo‘q"
      });
    }

    const found = data.found;

    console.log("👤 found object:", found);

    // 🆔 Provider ID fieldlarini tekshiramiz
    const recipientId =
      found.id ||
      found.user_id ||
      found.uid ||
      found.recipient ||
      found.telegram_id ||
      null;

    console.log("🆔 Aniqlangan recipient ID:", recipientId);

    if (!recipientId) {
      console.log("❌ Provider ID qaytarmadi!");
      return res.status(404).json({
        error: "Provider ID qaytarmadi — premium sotib bo‘lmaydi"
      });
    }

    // 🖼 Rasm URL ajratish
    let imageUrl = null;
    if (found.photo) {
      const m = found.photo.match(/src="([^"]+)"/);
      imageUrl = m ? m[1] : null;
    }

    console.log("🖼 Image URL:", imageUrl);

    // Frontendga qaytariladigan JSON
    const responseJson = {
      username: clean,
      fullName: found.name || clean,
      imageUrl,
      recipient: recipientId
    };

    console.log("➡ Frontendga qaytmoqda:", responseJson);

    return res.json(responseJson);

  } catch (err) {
    console.error("💥 PREMIUM SEARCH SERVER ERROR:", err);
    return res.status(500).json({ error: "Server xato" });
  }
});

//-----------------------
// 🧾 PREMIUM ORDER YARATISH
//-----------------------
app.post("/api/premium", async (req, res) => {
  try {
    console.log("\n=============== 🧾 PREMIUM ORDER YARATILMOQDA ===============");

    const { username, recipient, months } = req.body;

    console.log("📥 Keldi:", req.body);

    if (!username || !recipient || !months) {
      console.log("❌ Parametrlar yetarli emas");
      return res.status(400).json({ error: "username, recipient, months kerak" });
    }

    const clean = username.startsWith("@") ? username.slice(1) : username;
    console.log("🧹 Tozalangan username:", clean);

    const priceMap = { 3: PREMIUM_3, 6: PREMIUM_6, 12: PREMIUM_12 };
    const baseAmount = priceMap[months];

    if (!baseAmount) {
      console.log("❌ months noto‘g‘ri:", months);
      return res.status(400).json({ error: "Noto‘g‘ri months" });
    }

    console.log("💰 Asosiy narx:", baseAmount);

    // Unique amount yaratish
    console.log("🔄 Takrorlanmas unique amount yaratilyapti...");
    let unique = baseAmount;

    for (let i = 0; i < 20; i++) {
      const offset = Math.floor(Math.random() * 401) - 200;
      unique = baseAmount + offset;

      console.log(`🔎 Offset: ${offset}, Candidate: ${unique}`);

      const check = await pool.query(
        "SELECT 1 FROM transactions_premium WHERE amount=$1 AND status='pending'",
        [unique]
      );

      if (!check.rows.length) {
        console.log("✅ Unique amount topildi:", unique);
        break;
      }
    }

    console.log("📝 Bazaga yozilmoqda...");

    const result = await pool.query(
      `INSERT INTO transactions_premium (username, recipient, muddat_oy, amount, status, created_at)
       VALUES ($1,$2,$3,$4,'pending', NOW())
       RETURNING *`,
      [clean, recipient, months, unique]
    );

    console.log("🎉 ORDER CREATE →", result.rows[0]);

    return res.json({ success: true, order: result.rows[0] });

  } catch (err) {
    console.error("❌ PREMIUM ORDER ERROR:", err);
    return res.status(500).json({ error: "Server xato", details: err.message });
  }
});
//-----------------------
// 💳 PREMIUM PAYMENT MATCH
//-----------------------
app.post("/api/premium/match", async (req, res) => {
  try {
    console.log("\n=============== 💳 PREMIUM PAYMENT MATCH ===============");
    console.log("📥 Keldi:", req.body);

    const { amount, card_last4 } = req.body;

    if (!amount) {
      console.log("❌ Amount yo‘q");
      return res.status(400).json({ error: "amount kerak" });
    }

    console.log("🔎 Pending order qidirilmoqda:", amount);

    const q = await pool.query(
      "SELECT * FROM transactions_premium WHERE amount=$1 AND status='pending' ORDER BY id DESC LIMIT 1",
      [amount]
    );

    if (!q.rows.length) {
      console.log("❌ Pending premium TOPILMADI");
      return res.status(404).json({ error: "Pending premium topilmadi" });
    }

    const order = q.rows[0];
    console.log("🎯 Topildi:", order);

    console.log("💾 Status 'completed' qilinmoqda...");

    await pool.query(
      "UPDATE transactions_premium SET status='completed', card_last4=$1 WHERE id=$2",
      [card_last4 || null, order.id]
    );

    console.log("➡ Premium yuborish funksiyasi chaqirildi");

    const sendResult = await sendPremiumToUser(order.id, order.recipient, order.muddat_oy);

    console.log("📦 sendPremiumToUser javobi:", sendResult);

    return res.json({
      success: true,
      ...sendResult,
      order_id: order.id
    });

  } catch (err) {
    console.error("❌ PREMIUM MATCH ERROR:", err);
    return res.status(500).json({ error: "Server xato", details: err.message });
  }
});


// ===============================
// 🔹 PREMIUMNI FOYDALANUVCHIGA YUBORISH-----------------------------------------------REAL? TEST
// ===============================  
async function sendPremiumToUser(orderId, recipientId, months) {
  try {
    console.log("\n=============== 🚀 PREMIUM YUBORILMOQDA ===============");
    console.log("📥 Parametrlar:", { orderId, recipientId, months });

    const check = await pool.query(
      "SELECT status FROM transactions_premium WHERE id=$1",
      [orderId]
    );

    console.log("🔎 Hozirgi status:", check.rows[0]);

    if (!check.rows.length)
      return { status: "error", reason: "order_not_found" };

    if (check.rows[0].status === "premium_sent")
      return { status: "premium_sent", reason: "already_sent" };

    const idempotencyKey = crypto.randomUUID();
    console.log("🧬 Idempotency Key:", idempotencyKey);

    const body = {
      product_type: "premium",
      recipient: recipientId,
      months: String(months),
      idempotency_key: idempotencyKey
    };

    console.log("🌐 Providerga so‘rov yuborilmoqda:", body);

    const resp = await fetch("https://robynhood.parssms.info/api/purchase", {   // real
    //const resp = await fetch("https://robynhood.parssms.info/api/test/purchase", {    //test
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.ROB_API_KEY,
        accept: "application/json",
      },
      body: JSON.stringify(body)
    });

    const text = await resp.text();
    console.log("📦 Provider RAW:", text);

    let data;
    try { data = JSON.parse(text); }
    catch {
      console.log("❌ JSON parse xato!");
      await pool.query(
        "UPDATE transactions_premium SET status='failed' WHERE id=$1",
        [orderId]
      );
      return { status: "failed", reason: "invalid_api_response" };
    }

    console.log("📡 Provider JSON:", data);

    if (data.transaction_id) {
      console.log("✅ Premium success, bazaga yozilmoqda...");
      await pool.query(
        "UPDATE transactions_premium SET status='premium_sent', transaction_id=$1 WHERE id=$2",
        [data.transaction_id, orderId]
      );

      return { status: "premium_sent", transaction_id: data.transaction_id };
    }

    console.log("❌ Provider error:", data.error);

    await pool.query(
      "UPDATE transactions_premium SET status='failed' WHERE id=$1",
      [orderId]
    );

    return { status: "failed", reason: data.error || "unknown" };

  } catch (err) {
    console.log("💥 PREMIUM SEND ERROR:", err);

    await pool.query(
      "UPDATE transactions_premium SET status='error' WHERE id=$1",
      [orderId]
    );

    return { status: "error", reason: err.message };
  }
}


//-----------------------
// 🔍 PREMIUM TRANSACTION HOLATI
//-----------------------
app.get("/api/premium/transactions/:id", async (req, res) => {
  try {
    console.log("\n=============== 🔍 PREMIUM STATUS CHECK ===============");

    const id = Number(req.params.id);
    console.log("📥 ID:", id);

    const result = await pool.query(
      "SELECT * FROM transactions_premium WHERE id=$1",
      [id]
    );

    if (!result.rows.length) {
      console.log("❌ Order topilmadi");
      return res.status(404).json({ error: "Order topilmadi" });
    }

    console.log("📦 Javob:", result.rows[0]);

    return res.json(result.rows[0]);

  } catch (err) {
    console.log("❌ STATUS ERROR:", err);
    return res.status(500).json({ error: "Server xato" });
  }
});

// ===============================
// 🔹 ADMIN — PREMIUM LIST   admin panel-------------------------------------------------------------------
// ===============================
app.get("/api/admin/premium/list", async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = "SELECT * FROM transactions_premium WHERE 1=1";
    const params = [];

    // filter: status
    if (status && status !== "all") {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    // filter: search (username, recipient)
    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      query += ` AND (username ILIKE $${params.length - 1} OR recipient ILIKE $${params.length})`;
    }

    query += " ORDER BY id DESC";

    const result = await pool.query(query, params);

    res.json({ success: true, orders: result.rows });

  } catch (err) {
    console.error("❌ /api/admin/premium/list ERROR:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// ===============================
// 🔹 ADMIN — PREMIUM GET ONE
// ===============================
app.get("/api/admin/premium/get/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID noto‘g‘ri" });

    const result = await pool.query(
      "SELECT * FROM transactions_premium WHERE id=$1",
      [id]
    );

    if (!result.rows.length)
      return res.status(404).json({ error: "Order topilmadi" });

    res.json({ success: true, order: result.rows[0] });

  } catch (err) {
    console.error("❌ /api/admin/premium/get ERROR:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// ===============================
// 🔹 ADMIN — PREMIUM UPDATE (status, note)
// ===============================
app.patch("/api/admin/premium/update/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, note } = req.body;

    if (!id || !status)
      return res.status(400).json({ error: "ID va status kerak" });

    const result = await pool.query(
      `UPDATE transactions_premium
       SET status=$1,
           admin_note=$2
       WHERE id=$3
       RETURNING *`,
      [status, note || null, id]
    );

    if (!result.rows.length)
      return res.status(404).json({ error: "Order topilmadi" });

    res.json({ success: true, updated: result.rows[0] });

  } catch (err) {
    console.error("❌ /api/admin/premium/update ERROR:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// ===============================
// 🔹 ADMIN — RESEND PREMIUM
// ===============================
app.post("/api/admin/premium/resend/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID noto‘g‘ri" });

    const orderResult = await pool.query(
      "SELECT * FROM transactions_premium WHERE id=$1",
      [id]
    );

    if (!orderResult.rows.length)
      return res.status(404).json({ error: "Order topilmadi" });

    const order = orderResult.rows[0];

    // Premium yuborish funksiyasini chaqiramiz
    const sendResult = await sendPremiumToUser(order.id, order.username, order.muddat_oy);

    res.json({ success: true, ...sendResult });

  } catch (err) {
    console.error("❌ /api/admin/premium/resend ERROR:", err);
    return res.status(500).json({ error: "Server xatosi" });
  }
});


// ===============================
// 🔐 SECRET INFORMATIONS — GET-------------------------------------------------------------------
// ===============================
app.get("/api/admin/secret", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM secret_informations");

    if (result.rows.length === 0) {
      const insert = await pool.query(`
        INSERT INTO secret_informations 
        (card_number, card_name, fragment_api, telegram_session, tg_api_id, tg_api_hash, bot_token)
        VALUES ('', '', '', '', '', '', '')
        RETURNING *;
      `);

      return res.json({ success: true, data: insert.rows[0] });
    }

    res.json({ success: true, data: result.rows[0] });

  } catch (err) {
    console.error("❌ /api/admin/secret ERROR:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// ===============================
// 🔐 SECRET INFORMATIONS — UPDATE
// ===============================
app.patch("/api/admin/secret/update", async (req, res) => {
  try {
    const {
      card_number,
      card_name,
      fragment_api,
      telegram_session,
      tg_api_id,
      tg_api_hash,
      bot_token
    } = req.body;

    const result = await pool.query(
      `
      UPDATE secret_informations
      SET 
        card_number = $1,
        card_name = $2,
        fragment_api = $3,
        telegram_session = $4,
        tg_api_id = $5,
        tg_api_hash = $6,
        bot_token = $7
      RETURNING *;
      `,
      [
        card_number,
        card_name,
        fragment_api,
        telegram_session,
        tg_api_id,
        tg_api_hash,
        bot_token
      ]
    );

    res.json({ success: true, updated: result.rows[0] });

  } catch (err) {
    console.error("❌ /api/admin/secret/update ERROR:", err);
    res.status(500).json({ error: "Server xatosi" });
  }
});






// ======================
// 7️⃣ Serverni ishga tushirish
// ======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));



