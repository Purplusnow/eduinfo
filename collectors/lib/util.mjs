import { createHash } from 'node:crypto';

export const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

export function stripHtml(s = '') {
  return String(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(s, n = 160) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// 같은 기사가 여러 피드에 실릴 때 걸러내기 위한 제목 정규화.
export function normTitle(title) {
  return title
    .replace(/\s+-\s+[^-]+$/, '') // Google 뉴스의 " - 언론사" 꼬리
    .replace(/\[[^\]]*\]|【[^】]*】/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase();
}

// 'YYYY-MM-DD' 또는 파싱 가능한 날짜 → ISO 문자열(KST 기준 날짜만 있으면 정오로 둔다)
export function toIso(d) {
  if (!d) return null;
  if (/^\d{4}[-.]\d{2}[-.]\d{2}$/.test(d)) return new Date(`${d.replace(/\./g, '-')}T12:00:00+09:00`).toISOString();
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}
