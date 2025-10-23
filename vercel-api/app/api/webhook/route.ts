// vercel-api/app/api/webhook/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { GRANTS_BY_BUTTON, detectGrantFromText, type GrantKey } from "../../../lib/grants";
import { setUserScope, getUserScope, isDenied, denyUser } from "../../../lib/session";
import { isAbusive, ABUSE_REPLY_MESSAGE } from "../../../lib/moderation";
import { searchKnowledge } from "../../../lib/knowledge";
import { gptAnswer, answerWithContext } from "../../../lib/llm";

/** ========= LINE 設定 ========= */
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const CHANNEL_TOKEN  = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const LINE_API_REPLY = "https://api.line.me/v2/bot/message/reply";

/** ========= ユーティリティ ========= */
// LLMのMarkdownっぽい出力をLINE向けプレーン文に寄せる
function toLinePlain(text: string) {
  return (text || "")
    // **bold**（複数行も含む）
    .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
    // 箇条書き（- • * を ・ に）
    .replace(/^\s*[-•*]\s+/gm, "・")
    // インラインコード `code`
    .replace(/`([^`]*)`/g, "$1")
    // # 見出し
    .replace(/^#+\s*/gm, "")
    // 余分な空行を詰める
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function signIsValid(rawBody: string, xLineSignature: string | null) {
  if (!CHANNEL_SECRET || !xLineSignature) return false;
  const hmac = crypto.createHmac("sha256", CHANNEL_SECRET);
  const sig  = hmac.update(rawBody).digest("base64");
  return sig === xLineSignature;
}

async function reply(replyToken: string, messages: any[]) {
  const res = await fetch(LINE_API_REPLY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${CHANNEL_TOKEN}`
    },
    body: JSON.stringify({ replyToken, messages })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("[LINE reply error]", res.status, t);
  }
}

/** デバッグ用: GETで疎通確認できるようにしておく */
export async function GET() {
  return NextResponse.json({ ok: true, path: "/api/webhook", ts: Date.now() });
}

/** ========= Webhook (LINE からのコールは POST) ========= */
export async function POST(req: NextRequest) {
  try {
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

      /** 1) リッチメニューのポストバック（A〜Fボタン） */
      if (ev.type === "postback") {
        const data: string = ev.postback?.data || "";
        const m = data.match(/grant=([A-F])/i);
        if (m) {
          const key = m[1].toUpperCase() as GrantKey;
          const meta = GRANTS_BY_BUTTON[key];
          setUserScope(userId, key);
          await reply(replyToken, [{ type: "text", text: meta.askText }]);
          continue;
        }
      }

      /** 2) テキスト発言 */
      if (ev.type === "message" && ev.message?.type === "text") {
        const text: string = ev.message.text || "";

        // 2-1) 暴言: 超低姿勢メッセ＋以降ブロック
        if (isAbusive(text)) {
          denyUser(userId);
          await reply(replyToken, [{ type: "text", text: ABUSE_REPLY_MESSAGE }]);
          continue;
        }

        // 2-2) スコープ取得。未設定のときだけ文面から推定して保存（上書きはしない）
        let currentKey = getUserScope(userId) as GrantKey | null;
        if (!currentKey) {
          const guess = detectGrantFromText(text);
          if (guess) {
            setUserScope(userId, guess);
            currentKey = guess;
          }
        }

        // 2-3) F（その他） or スコープ無し → GPTのみ
        if (!currentKey || GRANTS_BY_BUTTON[currentKey]?.aiOnly) {
          const answer = await gptAnswer(text);
          await reply(replyToken, [{ type: "text", text: toLinePlain(answer) }]);
          continue;
        }

        // 2-4) 制度取り違えヒント（※上書きはせず提案文だけ）
        let mismatchNote = "";
        const detected = detectGrantFromText(text);
        if (detected && detected !== currentKey) {
          const guessName = GRANTS_BY_BUTTON[detected].display;
          mismatchNote = `\n\n（もしかして「${guessName}」のご質問でしょうか？ リッチメニューから補助金名を選び直してください）`;
        }

        // 2-5) スコープの知識優先で検索 → LLM整形
        const meta = GRANTS_BY_BUTTON[currentKey];
        let docs = await searchKnowledge(text, 6);
        // スコープ優先（対象ファイルを上に）
        docs = docs.sort((a, b) =>
          (a.source === meta.file ? -1 : 0) - (b.source === meta.file ? -1 : 0)
        );

        const header = `【対象：${meta.display}】${meta.url ? `\n参考: ${meta.url}` : ""}`;

        if (docs.length) {
          const ctx = docs.slice(0, 6).map(d => ({
            source: meta.display,
            content: d.content.slice(0, 1200),
            where: d.source
          }));
          const answer = await answerWithContext(text, ctx);
          const body = `${header}\n\n${answer}${mismatchNote}`;
          await reply(replyToken, [{ type: "text", text: toLinePlain(body) }]);
        } else {
          const answer = await gptAnswer(text);
          const body = `${header}\n\n${answer}${mismatchNote}`;
          await reply(replyToken, [{ type: "text", text: toLinePlain(body) }]);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[webhook error]", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
