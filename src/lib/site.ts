import { CATEGORIES } from '../../collectors/lib/classify.mjs';

export const SITE_NAME = '입시정보 한눈에';
export const SITE_DESC = '대입·고입 공식 발표, 뉴스, 일정, 전형 가이드를 자동으로 모아 매일 갱신하는 입시 정보 사이트';

// 검색엔진 소유 확인 코드(서치콘솔·서치어드바이저에서 "HTML 태그" 방식으로 받은 content 값). 비어 있으면 태그를 넣지 않는다.
// Google 애드센스 게시자 ID(koreanblog.xyz 계정). 비우면 광고 스크립트를 넣지 않는다.
export const ADSENSE_CLIENT = 'ca-pub-4640178123605595';
// 수동 광고 단위(반응형 디스플레이). 지금은 horse 사이트와 같은 단위를 쓴다.
// 입시 사이트 전용 단위를 만들면 여기 번호만 바꾸면 된다.
export const ADSENSE_SLOTS = { top: '8186876073', mid: '5173699929', bottom: '1855723286' } as const;
export const REPO_URL = 'https://github.com/Purplusnow/eduinfo';

export const VERIFY = {
  google: '',
  naver: '0d28832c730d2c51222ef18851059bce06b3e2f2',
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
