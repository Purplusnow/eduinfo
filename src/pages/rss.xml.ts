import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_NAME, u } from '../lib/site';

// 사이트 자체 글(주간 브리핑·가이드)만 담는다. 네이버 서치어드바이저는 항목 링크가 제출한 사이트 안에 있어야 받아준다.
// 외부 기관 공지는 /official.xml 로 따로 제공한다.
export async function GET(context: APIContext) {
  const abs = (p: string) => new URL(u(p), context.site).toString();
  const digests = (await getCollection('digests')).map((d) => ({
    title: d.data.title,
    link: abs(`/digest/${d.id}/`),
    pubDate: d.data.date,
    description: d.data.summary,
  }));
  const guides = (await getCollection('guides')).map((g) => ({
    title: g.data.title,
    link: abs(`/guides/${g.id}/`),
    pubDate: g.data.updated,
    description: g.data.description,
  }));
  return rss({
    title: SITE_NAME,
    description: '입시 가이드와 주간 입시 브리핑',
    site: new URL(import.meta.env.BASE_URL, context.site),
    items: [...digests, ...guides].sort((a, b) => +b.pubDate - +a.pubDate),
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: `<language>ko-kr</language><atom:link href="${abs('/rss.xml')}" rel="self" type="application/rss+xml"/>`,
  });
}
