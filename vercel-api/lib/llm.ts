import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function answerWithContext(
  userQuestion: string,
  ctx: Array<{ topic?: string; content: string; where?: string; source?: string }>
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "（システム設定：OPENAI_API_KEY が未設定のためGPT回答は無効です）";
  }

  const system =
    "あなたは日本の中小企業向け補助金に詳しいアシスタントです。提供された【根拠】のみを根拠として、日本語で簡潔に回答します。根拠にない推測は避け、足りない場合は「根拠が不十分」と明記してください。";

  const contextText = ctx.map((c,i) =>
    `# 根拠${i+1}${c.topic ? `（${c.topic}）` : ""}\n${c.content}`
  ).join("\n\n");

  const prompt =
`【ユーザー質問】
${userQuestion}

【根拠（抜粋／複数）】
${contextText}

【出力要件】
- 箇条書き中心で端的に
- 制度名・補助率・上限・対象者・対象経費・スケジュールなど該当する要素があれば整理
- 根拠が不足する点は「根拠不足」と明記`;

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 700
  });
  return res.choices[0]?.message?.content?.trim() || "";
}
