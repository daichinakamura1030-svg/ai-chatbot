// vercel-api/lib/moderation.ts
// 明確な暴言のみを検知し、誤検知を極力避ける
// 打ち間違い・文字の羅列・スラングは対象外

// 暴言ワード：明確な敵意・攻撃性を伴う日本語中心
const STRONG_ABUSE = [
  "死ね",
  "殺す",
  "殺してやる",
  "ぶっ殺",
  "殺害",
  "消えろ",
  "殺すぞ",
  "滅びろ"
];

// 検知関数
export function isAbusive(text: string): boolean {
  const t = text.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  return STRONG_ABUSE.some(w => t.includes(w));
}

// 検知時の返信メッセージ（謝罪＆応答停止通知）
export const ABUSE_REPLY_MESSAGE =
  "お客様のメッセージにスパムまたは不適切な表現（暴言など）が検知されたため、" +
  "AIによる応答を一時的に停止させていただきます。\n" +
  "ご迷惑をおかけし大変申し訳ございませんが、ご理解いただけますようお願い申し上げます。";
