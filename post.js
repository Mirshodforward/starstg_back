import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

let part2 = null;

app.post("/api/interview/callback", (req, res) => {
  console.log("2-qism:", req.body);
  part2 = req.body.part2;
  res.json({ received: true });
});


app.listen(5000, async () => {
  console.log("\n\n\nCallback ishga tushdi\n");

  const payload = {
    msg: "Salom, bu vazifadagi test POST sorovi, Qahramonov Mirshodbek tomonidan.",
    url: "https://starstg.uz/api/interview/callback"
  };


  const res = await fetch("https://test.icorp.uz/interview.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const part1 = (await res.json()).part1;
  console.log("1-qism:", part1);

  console.log("\n2-qism\n");


  const timer = setInterval(async () => {
    if (part2) {
      clearInterval(timer);

      const full = part1 + part2;
      console.log("Birlashtirilgan kod:", full);

      const finalRes = await fetch(
        `https://test.icorp.uz/interview.php?code=${full}`
      );

      const msg = await finalRes.text();
      console.log("\nYakuniy xabar:", msg);
    }
  }, 1000);
});
