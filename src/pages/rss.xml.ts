import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_NAME, u, type Item } from '../lib/site';
import official from '../data/official.json';

// 공식 발표 + 주간 브리핑 + 가이드. 뉴스 전체는 양이 많아 넣지 않는다.
export async function GET(context: APIContext) {
  const abs = (p: string) => new URL(u(p), context.site).toString();
  const digests = (await getCollection('digests')).map((d) => ({
    title: `[주간 브리핑] ${d.data.title}`,
    link: abs(`/digest/${d.id}/`),
    pubDate: d.data.date,
    description: d.data.summary,
  }));
  const guides = (await getCollection('guides')).map((g) => ({
    title: `[가이드] ${g.data.title}`,
    link: abs(`/guides/${g.id}/`),
    pubDate: g.data.updated,
    description: g.data.description,
  }));
  const notices = (official.items as Item[]).map((it) => ({
    title: `[${it.source}] ${it.title}`,
    link: it.url,
    pubDate: new Date(it.date ?? it.firstSeen),
    description: it.summary || it.title,
  }));
  const items = [...digests, ...guides, ...notices].sort((a, b) => +b.pubDate - +a.pubDate).slice(0, 100);
  return rss({
    title: SITE_NAME,
    description: '교육부·평가원·대교협 입시 공식 발표와 주간 입시 브리핑, 입시 가이드',
    site: new URL(import.meta.env.BASE_URL, context.site),
    items,
    customData: '<language>ko-kr</language>',
  });
}
