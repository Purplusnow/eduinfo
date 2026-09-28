import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.mjs';
import { isRelevant } from '../lib/classify.mjs';
import { toIso } from '../lib/util.mjs';

// goView('294', '107307', '0', ...) → ['294', '107307', '0']
const goViewArgs = (onclick = '') => [...onclick.matchAll(/'([^']*)'/g)].map((m) => m[1]);

// 교육부 보도자료는 입시 외 주제가 많아 3쪽까지 훑고 입시 관련만 남긴다.
async function moeBoard() {
  const items = [];
  for (let page = 1; page <= 3; page++) {
    const url = `https://www.moe.go.kr/boardCnts/listRenew.do?boardID=294&m=020402&s=moe&page=${page}`;
    items.push(...parseMoe(cheerio.load(await fetchText(url))));
  }
  return items;
}

function parseMoe($) {
  const items = [];
  $('td.title a').each((_, a) => {
    const [boardID, seq, lev] = goViewArgs($(a).attr('onclick'));
    const tds = $(a).closest('tr').find('td');
    const title = ($(a).attr('title') || $(a).text()).trim();
    if (!seq || !isRelevant(title)) return;
    items.push({
      title,
      url: `https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=${boardID}&boardSeq=${seq}&lev=${lev}&m=020402&s=moe&opType=N`,
      date: toIso(tds.eq(3).text().trim()),
      summary: '',
      source: '교육부 보도자료',
    });
  });
  return items;
}

// 한국교육과정평가원 수능 사이트 게시판(공지사항 1500229, 보도자료 1500230)
async function suneungBoard(boardID, m, label) {
  const url = `https://www.suneung.re.kr/boardCnts/list.do?boardID=${boardID}&m=${m}&s=suneung`;
  const $ = cheerio.load(await fetchText(url));
  const items = [];
  $('table:not(.mb) td.link a').each((_, a) => {
    const [, seq, lev] = goViewArgs($(a).attr('onclick'));
    if (!seq) return;
    const row = $(a).closest('tr');
    const date = row.find('td').filter((_, td) => /^\d{4}-\d{2}-\d{2}$/.test($(td).text().trim())).first().text().trim();
    items.push({
      title: ($(a).attr('title') || $(a).text()).trim(),
      url: `https://www.suneung.re.kr/boardCnts/view.do?boardID=${boardID}&boardSeq=${seq}&lev=${lev}&m=${m}&s=suneung`,
      date: toIso(date),
      summary: '',
      source: `평가원 ${label}`,
    });
  });
  return items;
}

// 대교협 대입정보포털 어디가: 메인의 대입뉴스 목록(날짜 없음 → 처음 본 시각을 사용)
async function adigaNews() {
  const html = await fetchText('https://www.adiga.kr/man/inf/mainNewsLstAjax.do', { init: { method: 'POST' } });
  const $ = cheerio.load(html);
  const items = [];
  $('#newsList li a').each((_, a) => {
    const id = ($(a).attr('onclick') || '').match(/(\d{3,})/)?.[1];
    const title = $(a).find('.newsTit').text().trim();
    if (!id || !title) return;
    items.push({
      id: `adiga-${id}`,
      title,
      url: 'https://www.adiga.kr/uct/nmg/enw/newsView.do?menuId=PCUCTNMG2000',
      date: null,
      summary: $(a).find('.newsTy').text().trim(),
      source: '대입정보포털 어디가',
    });
  });
  return items;
}

export default [
  { id: 'moe', name: '교육부 보도자료', kind: 'official', run: moeBoard },
  { id: 'kice-notice', name: '평가원 수능 공지사항', kind: 'official', run: () => suneungBoard('1500229', '0301', '공지') },
  { id: 'kice-press', name: '평가원 수능 보도자료', kind: 'official', run: () => suneungBoard('1500230', '0302', '보도자료') },
  { id: 'adiga', name: '대입정보포털 어디가', kind: 'official', run: adigaNews },
];
