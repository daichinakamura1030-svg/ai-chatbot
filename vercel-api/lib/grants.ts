export type GrantMeta = {
  file?: string;                 // 裏側で使う JSON（Fは無し）
  display: string;               // 画面に出す制度名
  url?: string;                  // 画面に出す公式URL
  aiOnly?: boolean;              // JSONが無いとき true（=GPTのみ）
};

// A〜F の“ボタンID”で受ける運用
export const GRANTS_BY_BUTTON: Record<string, GrantMeta> = {
  A: { file: "jizokuka-2025.json",        display: "小規模事業者持続化補助金",       url: "https://r6.jizokukahojokin.info/" },
  B: { file: "it-dounyu-2025.json",       display: "IT導入補助金",                    url: "https://it-shien.smrj.go.jp/" },
  C: { file: "monozukuri-2025.json",      display: "ものづくり補助金",                url: "https://portal.monodukuri-hojo.jp/" },
  D: { file: "shinjigyo-2025.json",       display: "新事業進出補助金",                url: "https://shinjigyou-shinshutsu.smrj.go.jp/" },
  E: { file: "seichou_kasokuka-2025.json",display: "成長加速化 100 億",               url: "https://growth-100-oku.smrj.go.jp/" },
  F: {                                   display: "お問い合わせ",                    url: "https://wgconsulting.net/contact/", aiOnly: true },
};

// スラッグで来る場合にも対応したいとき用（任意）
export const GRANTS_BY_SLUG: Record<string, GrantMeta> = {
  jizokuka: GRANTS_BY_BUTTON.A,
  it:       GRANTS_BY_BUTTON.B,
  monozukuri: GRANTS_BY_BUTTON.C,
  shinjigyo:  GRANTS_BY_BUTTON.D,
  seichou:    GRANTS_BY_BUTTON.E,
  contact:    GRANTS_BY_BUTTON.F,
};
