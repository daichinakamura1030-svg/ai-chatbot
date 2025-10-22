// vercel-api/lib/llm.ts
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

// 起動直後にキー未設定を検知（ビルドは通る／実行時に注意喚起）
if (!apiKey) {
  console.warn("[llm] OPENAI_API_KEY is not set");
}

const client = new OpenAI({ apiKey });

export async function gptAnswer(userQuestion: string): Promise<string> {
  if (!apiKey) {
    return "（システム設定：OPENAI_API_KEY が未設定のためGPT回答は無効です）";
  }
  const system =
    "あなたは日本の中小企業向け補助金に詳しいアシスタントです。根拠が不確かな場合はその旨を正直に伝え、推測は控えめに。箇条書きで簡潔に回答してください。";
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userQuestion }
      ],
      temperature: 0.2,
      max_tokens: 700
    });
    return res.choices[0]?.message?.content?.trim() || "";
  } catch (err: any) {
    console.error("[llm] OpenAI call failed:", err?.message || err);
    return `（GPT呼び出しエラー: ${err?.message || "unknown"}）`;
  }
}

/** JSONから拾った断片を元に、安全に日本語で要約・整形して返す */
export async function answerWithContext(
  question: string,
  ctx: Array<{ source: string; topic?: string; content: string; where?: string }>
): Promise<string> {
  if (!apiKey) {
    return "（システム設定：OPENAI_API_KEY が未設定のためGPT回答は無効です）";
  }

  const system =
    "あなたは日本の中小企業向け補助金に詳しいアシスタントです。以下の【知識】を一次根拠にし、矛盾があれば『不明』や『要確認』と明示し、" +
    "日本語で簡潔に（箇条書き中心で）回答してください。ユーザーの誤解があれば正します。";

  const knowledge = ctx
    .map(
      (k, i) =>
        `#${i + 1}\n[source:${k.source}]${k.topic ? ` [topic:${k.topic}]` : ""}${k.where ? ` [file:${k.where}]` : ""}\n${k.content}`
    )
    .join("\n\n");

  const userPrompt =
    `【質問】\n${question}\n\n` +
    `【知識】\n${knowledge}\n\n` +
    "【出力要件】\n" +
    "- まず結論\n" +
    "- 次に根拠（どのsourceの要約か軽く触れる）\n" +
    "- 不確実な点は『要確認』と明示\n" +
    "- 箇条書き中心で簡潔に";

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 900
    });
    return res.choices[0]?.message?.content?.trim() || "";
  } catch (err: any) {
    console.error("[llm] OpenAI ctx-call failed:", err?.message || err);
    return `（GPT整形エラー: ${err?.message || "unknown"}）`;
  }
}

// 念のため default でもまとめて輸出（どちらで import しても動くように）
export default { gptAnswer, answerWithContext };
