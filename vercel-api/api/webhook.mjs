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

// ---- temporarily bypass OpenAI for debugging ----
async function callOpenAI(userText) {
  // エコー返信（切り分け用）。動作確認できたらOpenAI呼び出しに戻す
  return `テストOK：${userText}`;
}

// ---- LINE reply ----
async function lineReply(replyToken, text) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("LINE reply error:", res.status, body);
    throw new Error(`LINE reply ${res.status}`);
  }
}

// ---- main handler ----
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const rawBody = await buffer(req);
    const signature = req.headers["x-line-signature"];
    const secret = process.env.LINE_CHANNEL_SECRET;
    if (!verifyLineSignature(rawBody, signature, secret)) {
      return res.status(403).send("Bad signature");
    }

    const payload = JSON.parse(rawBody.toString("utf-8"));
    const events = payload?.events || [];
    console.log("Received events:", events.length);

    await Promise.all(
      events.map(async (ev) => {
        console.log("Event:", JSON.stringify({ type: ev.type, msgType: ev.message?.type }, null, 0));
        try {
          if (ev.type === "message" && ev.message?.type === "text") {
            const reply = await callOpenAI(ev.message.text ?? "");
            await lineReply(ev.replyToken, reply);
          } else if (ev.type === "follow") {
            await lineReply(ev.replyToken, "友だち追加ありがとうございます！質問をどうぞ。");
          } else {
            // 未対応イベントは黙って200
            console.log("Skip event:", ev.type);
          }
        } catch (e) {
          console.error("Handler error:", e?.message || e);
          try {
            await lineReply(ev.replyToken, "（一時メッセージ）返信でエラーが発生しました。");
          } catch (e2) {
            console.error("Fallback reply failed:", e2?.message || e2);
          }
        }
      })
    );

    return res.status(200).send("OK");
  } catch (e) {
    console.error("Webhook error:", e?.message || e);
    return res.status(500).send("Internal Server Error");
  }
}
