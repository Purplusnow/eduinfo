import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_NAME, u, type Item } from '../lib/site';
import official from '../data/official.json';

// 교육부·평가원·어디가 공식 발표 구독용 피드(링크는 각 기관 원문)
export function GET(context: APIContext) {
  const abs = (p: string) => new URL(u(p), context.site).toString();
  return rss({
    title: `${SITE_NAME} · 공식 발표`,
    description: '교육부, 한국교육과정평가원, 대교협 대입정보포털의 입시 관련 공지와 보도자료',
    site: new URL(import.meta.env.BASE_URL, context.site),
    items: (official.items as Item[]).slice(0, 100).map((it) => ({
      title: `[${it.source}] ${it.title}`,
      link: it.url,
      pubDate: new Date(it.date ?? it.firstSeen),
      description: it.summary || it.title,
    })),
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: `<language>ko-kr</language><atom:link href="${abs('/official.xml')}" rel="self" type="application/rss+xml"/>`,
  });
}
