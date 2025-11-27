import fetch from "node-fetch";

async function sendTestPost() {
  const url = "https://test.icorp.uz/interview.php";

  const payload = {
    msg: "Salom, bu vazifadagi test POST sorovi, Qahramonov Mirshodbek tomonidan.",
    url: "https://starstg.uz/api/interview/callback"
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    console.log("=== 📩 TEST API javobi (part1) ===");
    console.log(text);

    // JSON bo‘lsa parse qilib beramiz
    try {
      const json = JSON.parse(text);
      console.log("\n📦 JSON format:", json);
    } catch {
      console.log("\n⚠️ JSON emas — raw text qaytdi.");
    }

  } catch (err) {
    console.error("❌ POST so‘rov xatosi:", err);
  }
}

sendTestPost();
