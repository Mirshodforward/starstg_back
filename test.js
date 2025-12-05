// test_purchase.js
import fetch from "node-fetch";
import "dotenv/config";

// ---- TEST UCHUN QIYMATLAR ----
//const RECIPIENT = "1Tlem2_Li29Rg8K-Wxw_dsHOjBjv0R0Oa2aBiigXY3Cm05IKIKGAFxf7WYDviuF_";
const RECIPIENT = "iVxIyuPlAEeWyrIvjUbBuuUX_zEKRpHJBKpACyZNwB4";  // Provider search'dan chiqgan ID qo'yiladi
const STARS_AMOUNT = "50";              // Nechta yuborilayapti
const IDEMPOTENCY_KEY = crypto.randomUUID();

const API_URL = "https://robynhood.parssms.info/api/test/purchase";
const API_KEY = process.env.ROB_API_KEY;

async function testPurchase() {
  try {
    const body = {
      product_type: "stars",
      recipient: RECIPIENT,
      quantity: STARS_AMOUNT,
      idempotency_key: IDEMPOTENCY_KEY,
    };

    console.log("\n🟦 Yuborilayotgan JSON:");
    console.log(JSON.stringify(body, null, 2));

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    console.log("\n🟧 Provider qaytargan natija:");
    console.log(text);

    try {
      const json = JSON.parse(text);
      console.log("\n🟩 JSON formatida:", json);
    } catch(err) {
      console.log("\n❌ JSON format emas!");
    }

  } catch (err) {
    console.error("\n❌ Testda xato:", err);
  }
}

testPurchase();
