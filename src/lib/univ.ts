import univData from '../data/universities.json';

export type Metric = { v: number | null; year: number; at: string; avg?: number };
export type School = {
  id: string;
  name: string;
  campus: string;
  kind: string;
  estb: string;
  region: string;
  address: string;
  homepage: string;
  phone: string;
  founded: string;
  metrics: Partial<Record<MetricId, Metric>>;
};
export type MetricId = 'competition' | 'fillRate' | 'employment' | 'dropout' | 'tuition' | 'scholarship';

export const univ = univData as unknown as { year: number; updatedAt: string; schools: School[] };

export const METRIC_INFO: Record<MetricId, { label: string; unit: string; desc: string; fmt: (v: number) => string }> = {
  competition: { label: '신입생 경쟁률', unit: ':1', desc: '정원 내 신입생 모집 경쟁률', fmt: (v) => `${v.toFixed(1)}:1` },
  fillRate: { label: '신입생 충원율', unit: '%', desc: '모집 인원 대비 입학한 신입생 비율', fmt: (v) => `${v.toFixed(1)}%` },
  employment: { label: '취업률', unit: '%', desc: '졸업생 취업률(취업대상자 기준)', fmt: (v) => `${v.toFixed(1)}%` },
  dropout: { label: '중도탈락률', unit: '%', desc: '재적 학생 중 자퇴·제적 등으로 그만둔 비율', fmt: (v) => `${v.toFixed(1)}%` },
  tuition: { label: '연 평균 등록금', unit: '원', desc: '학생 1인당 연간 평균 등록금', fmt: (v) => `${Math.round(v / 10000).toLocaleString('ko-KR')}만 원` },
  scholarship: { label: '1인당 장학금', unit: '원', desc: '학생 1인당 연간 장학금', fmt: (v) => `${Math.round(v / 10000).toLocaleString('ko-KR')}만 원` },
};

export const metricValue = (s: School, id: MetricId) => s.metrics[id]?.v ?? null;
export const fmtMetric = (s: School, id: MetricId) => {
  const v = metricValue(s, id);
  return v == null ? '-' : METRIC_INFO[id].fmt(v);
};

/** 학교 이름 + 캠퍼스 표시 */
export const displayName = (s: School) => (s.campus && s.campus !== '본교' && !s.name.includes('(') ? `${s.name} (${s.campus})` : s.name);
export const kindGroup = (s: School) => (s.kind === '전문대학' ? '전문대학' : '4년제');
export const homepageUrl = (h: string) => (!h ? '' : /^https?:\/\//i.test(h) ? h : `https://${h.toLowerCase()}`);
