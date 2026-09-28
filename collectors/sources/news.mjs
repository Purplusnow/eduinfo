import { readFeed } from '../lib/rss.mjs';
import { isRelevant } from '../lib/classify.mjs';

// 교육 전문 매체 전체기사 RSS. 입시 관련 키워드가 있는 기사만 남긴다.
const MEDIA_FEEDS = [
  { id: 'veritas', name: '베리타스알파', url: 'https://www.veritas-a.com/rss/allArticle.xml' },
  { id: 'edujin', name: '에듀진', url: 'https://www.edujin.co.kr/rss/allArticle.xml' },
  { id: 'unn', name: '한국대학신문', url: 'https://news.unn.net/rss/allArticle.xml' },
  { id: 'edupress', name: '에듀프레스', url: 'https://www.edupress.kr/rss/allArticle.xml' },
  { id: 'eduinnews', name: '에듀인뉴스', url: 'https://www.eduinnews.co.kr/rss/allArticle.xml' },
];

// Google 뉴스(news.google.com)는 robots.txt 로 /rss 를 포함한 자동 수집을 금지하므로 쓰지 않는다.
export default [
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
