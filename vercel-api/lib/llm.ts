// vercel-api/lib/llm.ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function gptAnswer(userQuestion: string) {
  const system = `あなたは日本の中小企業向け補助金に詳しいアシスタントです。
根拠が不確かな場合はその旨を正直に伝え、推測は控えめに。
箇条書きで簡潔に回答してください。`;

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
}
