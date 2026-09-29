// 수집 요약(SUMMARY_FILE)으로 텔레그램 "업데이트 완료" 메시지를 만든다. 새 글이 없으면 아무것도 출력하지 않는다.
import { readFile } from 'node:fs/promises';

const SITE = process.env.SITE_ORIGIN || 'https://edu.koreanblog.xyz';
let sum = {};
try {
  sum = JSON.parse(await readFile(process.env.SUMMARY_FILE, 'utf8'));
} catch {}

const news = sum.news ?? [];
const official = (sum.official ?? []).filter((it) => !it.sourceId?.startsWith('hs-'));
const hs = (sum.official ?? []).filter((it) => it.sourceId?.startsWith('hs-'));
const univFetched = sum.univ?.fetched ?? 0;
if (!news.length && !official.length && !hs.length && !univFetched) process.exit(0);

const now = new Date(Date.now() + 9 * 3600_000).toISOString().slice(5, 16).replace('-', '/').replace('T', ' ');
const lines = [`[입시정보] ${now} 업데이트 완료`, ''];
const counts = [news.length && `뉴스 ${news.length}`, official.length && `공식 발표 ${official.length}`, hs.length && `고입 공지 ${hs.length}`].filter(Boolean);
if (counts.length) lines.push(`■ 새 글: ${counts.join(' · ')}`);
if (sum.univ && univFetched) lines.push(`■ 대학 지표: ${univFetched}건 갱신 (완료 ${sum.univ.complete}/${sum.univ.total}곳)`);
const cut = (s) => (s.length > 60 ? s.slice(0, 59) + '…' : s);
if (official.length) {
  lines.push('', '공식 발표');
  official.slice(0, 5).forEach((it) => lines.push(`• ${cut(it.title)}`));
}
if (hs.length) {
  lines.push('', '고입 공지');
  hs.slice(0, 3).forEach((it) => lines.push(`• [${it.source.split(' ')[0]}] ${cut(it.title)}`));
}
if (news.length) {
  lines.push('', '뉴스');
  news.slice(0, 3).forEach((it) => lines.push(`• ${cut(it.title)}`));
}
lines.push('', SITE);
process.stdout.write(lines.join('\n') + '\n');
