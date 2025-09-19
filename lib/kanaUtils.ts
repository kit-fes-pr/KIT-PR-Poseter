/**
 * カナ変換ユーティリティ
 * 店舗名・住所の検索用カナ文字列を生成する
 */

/**
 * 日本語文字列をカタカナに変換する
 * - 半角文字を全角に正規化
 * - ひらがなをカタカナに変換
 * - 検索・ソート用途で使用
 * 
 * @param text 変換対象の文字列
 * @returns カタカナに変換された文字列
 */
export function generateKana(text: string): string {
  const normalized = (text || '').normalize('NFKC');
  let out = '';
  for (const ch of normalized) {
    const code = ch.charCodeAt(0);
    // ひらがな -> カタカナ
    if (code >= 0x3041 && code <= 0x3096) {
      out += String.fromCharCode(code + 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}