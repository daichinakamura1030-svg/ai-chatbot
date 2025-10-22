// vercel-api/lib/grants.ts
export type GrantKey = "A"|"B"|"C"|"D"|"E"|"F";

export type GrantMeta = {
  file?: string;      // 裏側で索引する JSON（F はなし）
  display: string;    // 画面に出す制度名（回答ヘッダ等）
  url?: string;       // 公式リンク（任意）
  aiOnly?: boolean;   // JSONがない（= GPT のみ）
  aliases?: string[]; // テキストから制度推定するための別名・キーワード
  askText: string;    // リッチメニュー押下直後に出すテキスト
};

export const GRANTS_BY_BUTTON: Record<GrantKey, GrantMeta> = {
  A: {
    file: "jizokuka-2025.json",
    display: "小規模事業者持続化補助金",
    url: "https://r6.jizokukahojokin.info/",
    askText: "小規模事業者持続化補助金について質問事項を送信してください。",
    aliases: ["小規模事業者持続化", "持続化補助金", "小規模", "持続化"]
  },
  B: {
    file: "it-dounyu-2025.json",
    display: "IT導入補助金",
    url: "https://it-shien.smrj.go.jp/",
    askText: "IT導入補助金について質問事項を送信してください。",
    aliases: ["IT導入", "IT", "デジタル化"]
  },
  C: {
    file: "monozukuri-2025.json",
    display: "ものづくり補助金",
    url: "https://portal.monodukuri-hojo.jp/",
    askText: "ものづくり補助金について質問事項を送信してください。",
    aliases: ["ものづくり", "モノづくり", "製造"]
  },
  D: {
    file: "shinjigyo-2025.json",
    display: "新事業進出補助金",
    url: "https://shinjigyou-shinshutsu.smrj.go.jp/",
    askText: "新事業進出補助金について質問事項を送信してください。",
    aliases: ["新事業進出", "進出", "新事業"]
  },
  E: {
    file: "seichou_kasokuka-2025.json",
    display: "成長加速化補助金（100億）",
    url: "https://growth-100-oku.smrj.go.jp/",
    askText: "成長加速化補助金について質問事項を送信してください。",
    aliases: ["成長加速化", "成長", "100億"]
  },
  F: {
    display: "その他の補助金",
    url: "https://wgconsulting.net/contact/",
    askText: "その他の補助金について質問事項を送信してください。",
    aiOnly: true,
    aliases: ["その他", "他の補助金", "汎用"]
  }
};

// テキストから制度推定（現在スコープと違う制度の話をした時に提案する）
export function detectGrantFromText(text: string): GrantKey | null {
  const t = text.normalize("NFKC").toLowerCase();
  for (const [key, meta] of Object.entries(GRANTS_BY_BUTTON) as [GrantKey, GrantMeta][]) {
    if (!meta.aliases) continue;
    if (meta.aliases.some(a => t.includes(a.toLowerCase()))) return key;
  }
  return null;
}
