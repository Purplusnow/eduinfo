import { readFeed } from '../lib/rss.mjs';
import { isRelevant } from '../lib/classify.mjs';

// Google 뉴스 검색 RSS: 키워드마다 최신 기사 최대 100건.
const GOOGLE_QUERIES = [
  '대입 수시',
  '정시 모집',
  '수능',
  '모의평가',
  '학생부종합전형',
  '논술전형',
  '의대 입시',
  '대입 개편 2028',
  '고입 자사고 특목고',
  '대학 편입',
  '입시 설명회',
  '대학 경쟁률',
];

const googleNews = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:7d`)}&hl=ko&gl=KR&ceid=KR:ko`;

// 교육 전문 매체 전체기사 RSS. 입시 관련 키워드가 있는 기사만 남긴다.
const MEDIA_FEEDS = [
  { id: 'veritas', name: '베리타스알파', url: 'https://www.veritas-a.com/rss/allArticle.xml' },
  { id: 'edujin', name: '에듀진', url: 'https://www.edujin.co.kr/rss/allArticle.xml' },
  { id: 'unn', name: '한국대학신문', url: 'https://news.unn.net/rss/allArticle.xml' },
  { id: 'edupress', name: '에듀프레스', url: 'https://www.edupress.kr/rss/allArticle.xml' },
  { id: 'eduinnews', name: '에듀인뉴스', url: 'https://www.eduinnews.co.kr/rss/allArticle.xml' },
];

export default [
  {
    id: 'google-news',
    name: 'Google 뉴스',
    kind: 'news',
    async run() {
      const results = await Promise.allSettled(GOOGLE_QUERIES.map((q) => readFeed(googleNews(q))));
      const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
      if (!items.length) throw new Error('Google 뉴스 검색 결과가 모두 비었습니다');
      return items
        .map((it) => ({
          ...it,
          title: it.publisher ? it.title.replace(new RegExp(`\\s+-\\s+${escapeRe(it.publisher)}$`), '') : it.title,
          // Google 뉴스 요약은 제목 반복이라 버린다.
          summary: '',
          source: it.publisher ?? 'Google 뉴스',
        }))
        // 제목 자리에 언론사명만 들어온 항목, 입시와 무관한 검색 잡음 제거
        .filter((it) => it.title.length >= 10 && it.title !== it.source && isRelevant(it.title));
    },
  },
  ...MEDIA_FEEDS.map((f) => ({
    id: f.id,
    name: f.name,
    kind: 'news',
    allowEmpty: true, // 입시 키워드로 거르므로 0건인 날이 있을 수 있음
    async run() {
      const items = await readFeed(f.url);
      return items
        .filter((it) => isRelevant(`${it.title} ${it.summary}`))
        .map((it) => ({ ...it, source: f.name }));
    },
  })),
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
