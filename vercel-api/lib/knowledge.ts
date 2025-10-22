// vercel-api/lib/llm.ts
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

// 起動直後にキー未設定を検知（ビルドは通し、実行時にわかりやすく失敗）
if (!apiKey) {
  console.warn("[llm] OPENAI_API_KEY is not set");
}

const client = new OpenAI({ apiKey });

export async function gptAnswer(userQuestion: string): Promise<string> {
  if (!apiKey) {
    // 環境変数未設定の場合は即レス
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
      max_tokens: 700,
      // 念のため明示（不要なら削ってOK）
      response_format: { type: "text" }
    });

    return res.choices[0]?.message?.content?.trim() || "";
  } catch (err: any) {
    // レート制限/ネットワーク/モデル名誤り等を安全に返す
    console.error("[llm] OpenAI call failed:", err?.message || err);
    return `（GPT呼び出しエラー: ${err?.message || "unknown"}）`;
  }
}
