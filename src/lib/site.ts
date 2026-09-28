import { CATEGORIES } from '../../collectors/lib/classify.mjs';

export const SITE_NAME = '입시정보 한눈에';
export const SITE_DESC = '대입·고입 공식 발표, 뉴스, 일정, 전형 가이드를 자동으로 모아 매일 갱신하는 입시 정보 사이트';

// 검색엔진 소유 확인 코드(서치콘솔·서치어드바이저에서 "HTML 태그" 방식으로 받은 content 값). 비어 있으면 태그를 넣지 않는다.
export const VERIFY = {
  google: '',
  naver: '',
};

export { CATEGORIES };
export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
/** base 경로를 붙인 내부 링크 */
export const u = (p = '/') => `${base}${p.startsWith('/') ? p : `/${p}`}`;

export type Item = {
  id: string;
  title: string;
  url: string;
  date: string | null;
  firstSeen: string;
  source: string;
  sourceId: string;
  summary: string;
  categories: string[];
  year?: number;
  subject?: string;
};

const KST = 'Asia/Seoul';

export function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return '';
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit', hour12: false });
  return new Intl.DateTimeFormat('ko-KR', opts).format(d).replace(/\.\s?/g, '.').replace(/\.$/, '');
}

export const itemDate = (it: Item) => it.date ?? it.firstSeen;

/** 오늘(KST) 기준 D-day. 양수면 남은 일수 */
export function dday(dateStr: string, today = new Date()) {
  const toKstDay = (d: Date) => Math.floor((d.getTime() + 9 * 3600_000) / 86400_000);
  return toKstDay(new Date(`${dateStr}T00:00:00+09:00`)) - toKstDay(today);
}
