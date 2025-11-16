/**
 * コメントから映画タイトルを抽出するヒューリスティック関数
 */
export function extractMovieTitle(comment: string | null | undefined): string | null {
  if (!comment) return null;
  const text = comment.trim();

  // 1: 「...」 or 『...』
  const japaneseQuotes = [/「([^」]+)」/, /『([^』]+)』/];
  for (const r of japaneseQuotes) {
    const m = text.match(r);
    if (m && m[1]) return m[1].trim();
  }

  // 2: "..." or “...”
  const quotes = [/["“”]{1}([^"“”]+)["“”]{1}/];
  for (const r of quotes) {
    const m = text.match(r);
    if (m && m[1]) return m[1].trim();
  }

  // 3: （...）全角丸括弧
  const paren = /（([^）]+)）/;
  const mParen = text.match(paren);
  if (mParen && mParen[1]) return mParen[1].trim();

  // 4: 英語っぽい文字列を拾う（簡易）
  const english = text.match(/([A-Za-z0-9:’'’&\-\s]{3,})/);
  if (english && english[1]) {
    const candidate = english[1].trim();
    if (candidate.length >= 3 && candidate.split(/\s+/).length <= 6) {
      return candidate;
    }
  }

  return null;
}
