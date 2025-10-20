// vercel-api/api/webhook.mjs
export const config = { api: { bodyParser: false } };
import crypto from "crypto";

// ---- helpers ----
function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on("data", (c) => chunks.push(Buffer.from(c)));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}
function verifyLineSignature(rawBody, signature, channelSecret) {
  const hmac = crypto.createHmac("sha256", channelSecret).update(rawBody).digest("base64");
  return hmac === signature;
}

// ---- OpenAI Chat Completions ----
async function callOpenAI(userText) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "あなたは『AI補助金先生』。日本の補助金・助成金について、最新期日など不確定な点は断定を避け、公式確認を促しつつ、3〜6行で簡潔・誠実に回答すること。",
        },
        { role: "user", content: userText },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("OpenAI error:", res.status, t);
    // フォールバック（失敗時は短い固定文を返す）
    return "現在混み合っています。少し時間をおいてからお試しください。";
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  return text || "回答を生成できませんでした。別の表現でお試しください。";
}

// ---- LINE reply ----
async function lineReply(replyToken, text) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
  const body = await res.text().catch(() => "");
  if (!res.ok) {
    console.error("LINE reply error:", res.status, body);
    throw new Error(`LINE reply ${res.status}`);
  } else {
    console.log("LINE reply ok:", res.status);
  }
}

// ---- main handler ----
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const rawBody = await buffer(req);
    const signature = req.headers["x-line-signature"];
    const secret = process.env.LINE_CHANNEL_SECRET;
    if (!verifyLineSignature(rawBody, signature, secret)) {
      console.error("Bad signature");
      return res.status(403).send("Bad signature");
    }

    const payload = JSON.parse(rawBody.toString("utf-8"));
    const events = payload?.events || [];
    console.log("Received events:", events.length);

    await Promise.all(
      events.map(async (ev) => {
        try {
          if (ev.type === "message" && ev.message?.type === "text") {
            const reply = await callOpenAI(ev.message.text ?? "");
            await lineReply(ev.replyToken, reply);
          } else if (ev.type === "follow") {
            await lineReply(ev.replyToken, "友だち追加ありがとうございます！質問をどうぞ。");
          } else {
            console.log("Skip event:", ev.type);
          }
        } catch (e) {
          console.error("Handler error:", e?.message || e);
          try {
            await lineReply(ev.replyToken, "エラーが発生しました。短いキーワードで再度お試しください。");
          } catch (e2) {
            console.error("Fallback reply failed:", e2?.message || e2);
          }
        }
      })
    );

    return res.status(200).send("OK");
  } catch (e) {
    console.error("Webhook fatal error:", e?.message || e);
    return res.status(500).send("Internal Server Error");
  }
}
