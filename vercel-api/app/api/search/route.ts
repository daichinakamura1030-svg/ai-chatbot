export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { GRANTS_BY_BUTTON, detectGrantFromText, type GrantKey } from "../../../lib/grants";
import { setUserScope, getUserScope, isDenied, denyUser } from "../../../lib/session";
import { isAbusive } from "../../../lib/moderation";
import { searchKnowledge } from "../../../lib/knowledge"; // Doc[] を返す版でOK
import { gptAnswer, answerWithContext } from "../../../lib/llm";

/** ========= LINE 設定 ========= */
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const CHANNEL_TOKEN  = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const LINE_API_REPLY = "https://api.line.me/v2/bot/message/reply";

/** ========= ユーティリティ ========= */
function signIsValid(rawBody: string, xLineSignature: string | null) {
  if (!CHANNEL_SECRET || !xLineSignature) return false;
  const hmac = crypto.createHmac("sha256", CHANNEL_SECRET);
  const sig  = hmac.update(rawBody).digest("base64");
  return sig === xLineSignature;
}

async function reply(replyToken: string, messages: any[]) {
  await fetch(LINE_API_REPLY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${CHANNEL_TOKEN}`
    },
    body: JSON.stringify({ replyToken, messages })
  });
}

/** ========= Webhook ========= */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-line-signature");
  if (!signIsValid(raw, sig)) {
    return NextResponse.json({ ok: false, reason: "bad signature" }, { status: 403 });
  }

  const body = JSON.parse(raw);
  const events = body.events || [];

  for (const ev of events) {
    const replyToken = ev.replyToken;
    const userId = ev.source?.userId as string | undefined;

    if (!replyToken || !userId) continue;
    if (isDenied(userId)) continue;

    // 1) ポストバック（A〜F）
    if (ev.type === "postback") {
      const data: string = ev.postback?.data || "";
      const m = data.match(/grant=([A-F])/i);
      if (m) {
        const key = m[1].toUpperCase() as GrantKey;
        const meta = GRANTS_BY_BUTTON[key];
        setUserScope(userId, key);
        await reply(replyToken, [
          { type: "text", text: meta.askText } // ← 指定文言で案内
        ]);
        continue;
      }
    }

    // 2) テキストメッセージ
    if (ev.type === "message" && ev.message?.type === "text") {
      const text: string = ev.message.text || "";

      // 2-1) 暴言スパム → denylist →（必要なら1回だけ注意文）
      if (isAbusive(text)) {
        denyUser(userId);
        await reply(replyToken, [
          { type: "text", text: "不適切な表現が含まれていたため、以降の応対を停止します。" }
        ]);
        continue;
      }

      // 2-2) 現在スコープ（A〜F）
      const currentKey = getUserScope(userId) as GrantKey | null;

      // 2-3) F（その他） or スコープ無し → GPTだけで回答
      if (!currentKey || GRANTS_BY_BUTTON[currentKey]?.aiOnly) {
        const answer = await gptAnswer(text);
        await reply(replyToken, [
          { type: "text", text: answer }
        ]);
        continue;
      }

      // 2-4) 制度の取り違えを検出したら提案文を添える
      let mismatchNote = "";
      const detected = detectGrantFromText(text);
      if (detected && detected !== currentKey) {
        const guessName = GRANTS_BY_BUTTON[detected].display;
        mismatchNote = `\n\n（もしかして「${guessName}」のご質問でしょうか？ リッチメニューから補助金名を選び直してください）`;
      }

      // 2-5) スコープ検索 → LLM整形
      const meta = GRANTS_BY_BUTTON[currentKey];
      let docs = await searchKnowledge(text, 6); // Doc[]（全体検索）
      // スコープ優先：file一致を優先する並べ替え（手軽な方法）
      docs = docs.sort((a,b) =>
        (a.source === meta.file ? -1 : 0) - (b.source === meta.file ? -1 : 0)
      );

      if (docs.length) {
        // 上位からコンテキスト抽出（長過ぎないようにクリップ）
        const ctx = docs.slice(0, 6).map(d => ({
          source: meta.display,
          topic: undefined as string | undefined,
          content: d.content.slice(0, 1200),
          where: d.source
        }));
        const answer = await answerWithContext(text, ctx);
        const header = `【対象：${meta.display}】${meta.url ? `\n参考: ${meta.url}` : ""}`;
        await reply(replyToken, [
          { type: "text", text: `${header}\n\n${answer}${mismatchNote}` }
        ]);
      } else {
        // 見つからない → GPTのみで回答
        const answer = await gptAnswer(text);
        const header = `【対象：${meta.display}】${meta.url ? `\n参考: ${meta.url}` : ""}`;
        await reply(replyToken, [
          { type: "text", text: `${header}\n\n${answer}${mismatchNote}` }
        ]);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
