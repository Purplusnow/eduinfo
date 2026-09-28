import { XMLParser } from 'fast-xml-parser';
import { fetchText } from './http.mjs';
import { stripHtml, toIso } from './util.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });

const text = (v) => (v == null ? '' : typeof v === 'object' ? (v['#text'] ?? '') : String(v));

// RSS 2.0 / Atom 공통 파서. [{ title, url, date, summary, publisher }]
export async function readFeed(url) {
  const xml = await fetchText(url);
  const doc = parser.parse(xml);
  if (doc.rss) {
    const items = [].concat(doc.rss.channel?.item ?? []);
    return items.map((it) => ({
      title: stripHtml(text(it.title)),
      url: text(it.link).trim(),
      date: toIso(text(it.pubDate) || text(it['dc:date'])),
      summary: stripHtml(text(it.description)),
      publisher: stripHtml(text(it.source)) || null,
    }));
  }
  if (doc.feed) {
    const entries = [].concat(doc.feed.entry ?? []);
    return entries.map((e) => {
      const link = [].concat(e.link ?? []).find((l) => !l['@_rel'] || l['@_rel'] === 'alternate');
      return {
        title: stripHtml(text(e.title)),
        url: link?.['@_href'] ?? '',
        date: toIso(text(e.updated) || text(e.published)),
        summary: stripHtml(text(e.summary) || text(e.content)),
        publisher: null,
      };
    });
  }
  throw new Error(`알 수 없는 피드 형식: ${url}`);
}
