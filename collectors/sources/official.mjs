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

// 평가원 수능 사이트(suneung.re.kr)와 대교협 어디가(adiga.kr)는 robots.txt 로 모든 자동 수집을 금지하므로 수집하지 않는다.
// 평가원 보도자료는 교육부 보도자료 게시판에도 원문이 올라오므로 moe 로 받는다.
export default [
  { id: 'moe', name: '교육부 보도자료', kind: 'official', run: moeBoard, allowEmpty: true },
];
