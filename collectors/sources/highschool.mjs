import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.mjs';
import { toIso } from '../lib/util.mjs';

// 전국 시·도교육청 고입(고등학교 입학) 공지 수집기.
// 교육청이 운영하는 고입 전용 게시판을 우선 쓰고, 없거나 막힌 곳은 공지·보도자료 게시판에서 제목 키워드로 거른다.
//
// 제외한 교육청(2026-09 확인):
// - 대전: www.dje.go.kr robots.txt가 main.do 외 전체 Disallow
// - 충남: www.cne.go.kr robots.txt가 전체 Disallow(고입정보 /hischool 포함), 진학센터(jinhak.cne.go.kr)는 JS 렌더링·대입 위주
// - 제주: www.jje.go.kr robots.txt가 일반 봇에 전체 Disallow
// - 울산: use.go.kr 인증서 체인에 중간 인증서가 빠져 Node fetch가 UNABLE_TO_VERIFY_LEAF_SIGNATURE로 실패

// 제목에 이 중 하나가 있어야 고입 글로 본다.
const HS_RE = new RegExp(
  [
    '고입', '고등학교\\s*입학', '고교\\s*입학', '고등학교\\s*입\\(진\\)학', '입학\\s*전형', '신입생\\s*(모집|입학|전형|배정)',
    '고등학교\\s*신입생', '특목고', '자사고', '자율형\\s*사립고', '자율형\\s*공립고', '자율고', '과학고', '외국어고', '외고',
    '국제고', '영재학교', '영재고', '마이스터고', '특성화고', '일반고', '후기고', '전기고', '고교\\s*배정',
    '고등학교\\s*배정', '평준화', '고교학점제', '특례\\s*신?입학',
  ].join('|'),
);
// 고입 전용 게시판은 대부분 고입 글이라 조금 넓게 받는다(전·편입학, 내신, 배정 안내 등).
const LOOSE_RE = /고등학교|고교|직업계고|입학|배정|전입|내신|원서|합격/;
// 학교 이름에 키워드가 들어간 채용·입찰 공고 등은 뺀다.
const NOISE_RE = /채용|입찰|계약제|기간제|강사|급식|공사|용역|수의계약|임용|공시송달|위탁|납품|물품/;

// '중학교 신입생 배정'처럼 고교 말이 없는 초·중 입학 글
const LOWER_RE = /중학교|초등학교|유치원/;
const HIGH_RE = /고등|고교|고입|[가-힣]고(?![가-힣])/;
const notNoise = (t) => !NOISE_RE.test(t) && !(LOWER_RE.test(t) && !HIGH_RE.test(t.replace(LOWER_RE, '')));

const isHs = (t) => HS_RE.test(t) && notNoise(t);
// 고입 전용 게시판에는 '중학교 졸업학력 검정고시 … 석차백분율'처럼 중학교 말만 있는 고입 글도 있어 초·중 필터는 적용하지 않는다.
const isHsLoose = (t) => (HS_RE.test(t) || LOOSE_RE.test(t)) && !NOISE_RE.test(t);

const clean = (s = '') => s.replace(/\s+/g, ' ').trim();

// 텍스트 안의 첫 날짜(YYYY.MM.DD / YYYY-MM-DD / YY.MM.DD) → ISO
function findDate(text = '') {
  let m = text.match(/(20\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
  if (!m) {
    const s = text.match(/(?<!\d)(\d{2})\.(\d{2})\.(\d{2})(?!\d)/);
    if (s) m = [s[0], `20${s[1]}`, s[2], s[3]];
  }
  if (!m) return null;
  return toIso(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);
}

// 목록 행에서 등록일 찾기: 제목 칸에 '(2026. 9. 29.)' 같은 날짜가 섞여 있을 수 있어 제목 밖에서 먼저 찾는다.
function rowDate($, row, a, title = '') {
  const cells = row.find('td').filter((_, td) => !$(td).find(a).length);
  for (const td of cells.toArray()) {
    const d = findDate(clean($(td).text()));
    if (d) return d;
  }
  return findDate(clean(row.text()).replace(title, ''));
}

// 같은 글이 공지 고정 행과 일반 행에 두 번 나오는 게시판이 있어 URL로 중복 제거
function dedupe(items) {
  const seen = new Set();
  return items.filter((it) => (seen.has(it.url) ? false : seen.add(it.url)));
}

// ── 공통 CMS 1: '/{site}/na/ntt/selectNttList.do' (충북·대구·인천·세종·경기·부산 고입포털·전남 등)
// 목록 항목은 data-id(또는 data-param, href의 nttSn)로 글번호를 주고, 상세는 selectNttInfo.do?nttSn=… 로 GET 열람 가능.
async function nttBoard({ origin, site, mi, bbsId, listCo = 50, filter = isHs, source }) {
  const url = `${origin}/${site}/na/ntt/selectNttList.do?mi=${mi}&bbsId=${bbsId}&listCo=${listCo}`;
  const $ = cheerio.load(await fetchText(url));
  const items = [];
  $('tbody a, a.nttInfoBtn, a.selectNttInfo').each((_, a) => {
    const $a = $(a);
    const sn = $a.attr('data-id') || $a.attr('data-param') || ($a.attr('href') || '').match(/nttSn=(\d+)/)?.[1];
    if (!sn || !/^\d+$/.test(sn)) return;
    const $t = $a.clone();
    $t.find('input, img, .new, .ico_new, i, em').remove();
    const title = clean($a.find('.lst_tit').text() || $a.attr('title') || $t.text()).replace(/\s*새\s*글$/, '');
    if (!title || !filter(title)) return;
    const row = $a.closest('tr, li');
    items.push({
      title,
      url: `${origin}/${site}/na/ntt/selectNttInfo.do?mi=${mi}&bbsId=${bbsId}&nttSn=${sn}`,
      date: rowDate($, row, $a, title),
      summary: '',
      source,
    });
  });
  return dedupe(items);
}

// ── 공통 CMS 2: '/user/bbs/BD_selectBbsList.do?q_bbsSn=…' (서울 등)
// q_rowPerPage·q_currPage를 GET으로 붙이면 빈 목록이 와서 첫 쪽(10건)만 읽는다.
async function openworksBoard({ origin, bbsSn, filter = isHs, source }) {
  const url = `${origin}/user/bbs/BD_selectBbsList.do?q_bbsSn=${bbsSn}`;
  const $ = cheerio.load(await fetchText(url));
  const items = [];
  $('tbody tr').each((_, tr) => {
    const a = $(tr).find('td.bbs_title a, a[onclick*="opView"]').first();
    const docNo = (a.attr('onclick') || a.attr('href') || '').match(/(\d{17})/)?.[1];
    const title = clean(a.text());
    if (!docNo || !title || !filter(title)) return;
    items.push({
      title,
      url: `${origin}/user/bbs/BD_selectBbs.do?q_bbsSn=${bbsSn}&q_bbsDocNo=${docNo}`,
      date: rowDate($, $(tr), a, title),
      summary: '',
      source,
    });
  });
  return dedupe(items);
}

// ── 강원: 고입자료실(goView('글번호') → /main/bbs/view.do?key=…&bbsSn=…)
async function gangwon() {
  const key = 'bTIzMDcyMTA2MDM1MTM=';
  const $ = cheerio.load(await fetchText(`https://www.gwe.go.kr/main/bbs/list.do?key=${encodeURIComponent(key)}`));
  const items = [];
  $('tbody tr').each((_, tr) => {
    const a = $(tr).find('a[onclick*="goView"]').first();
    const sn = (a.attr('onclick') || '').match(/goView\('(\d+)'/)?.[1];
    const title = clean(a.text());
    if (!sn || !title || !isHsLoose(title)) return;
    items.push({
      title,
      url: `https://www.gwe.go.kr/main/bbs/view.do?key=${encodeURIComponent(key)}&bbsSn=${sn}`,
      date: rowDate($, $(tr), a, title),
      summary: '',
      source: '강원특별자치도교육청 고입자료실',
    });
  });
  return items;
}

// ── 광주: 광주진로진학지원센터 고입정보 공지사항(?sid=8)
async function gwangju() {
  const items = [];
  for (let page = 1; page <= 2; page++) {
    const html = await fetchText(`https://jinhak.gen.go.kr/?sid=8&wbb=md%3Alist%3B&page=${page}`, { timeout: 30000 });
    const $ = cheerio.load(html);
    $('a[href*="wbb=md:view"]').each((_, a) => {
      const uid = ($(a).attr('href') || '').match(/uid:(\d+)/)?.[1];
      const title = clean($(a).find('.tit').text());
      if (!uid || !title || !isHsLoose(title)) return;
      items.push({
        title,
        url: `https://jinhak.gen.go.kr/?sid=8&wbb=md:view;uid:${uid};`,
        date: findDate($(a).find('.date').text()),
        summary: '',
        source: '광주광역시교육청 진로진학지원센터',
      });
    });
  }
  return dedupe(items);
}

// ── 경기: 고등학교 입학전학 포털(satp.goe.go.kr) 첫 화면 공지 + 경기도교육청 보도자료 키워드 필터
// 포털 공지는 세션+POST로만 열려 상세 주소를 만들 수 없으므로 공지 목록 주소에 글번호를 붙인다.
async function gyeonggi() {
  const items = [];
  try {
    const $ = cheerio.load(await fetchText('https://satp.goe.go.kr/intro.do'));
    $('[onclick^="gj_view("]').each((_, el) => {
      const sn = ($(el).attr('onclick') || '').match(/gj_view\('(\d+)'\)/)?.[1];
      const title = clean($(el).find('.headtwo').text());
      if (!sn || !title) return;
      items.push({
        title,
        url: `https://satp.goe.go.kr/intro.do#notice-${sn}`,
        date: findDate($(el).text()),
        summary: clean($(el).find('.headthree').text()).slice(0, 160),
        source: '경기도교육청 고등학교 입학전학 포털',
      });
    });
  } catch {
    // 포털이 막혀도 보도자료로 이어간다
  }
  items.push(
    ...(await nttBoard({
      origin: 'https://www.goe.go.kr', site: 'goe', mi: 10102, bbsId: 1922, listCo: 100, source: '경기도교육청 보도자료',
    })),
  );
  return dedupe(items);
}

// ── 경남: 경상남도교육청 고입포털 공지사항
async function gyeongnam() {
  const base = 'https://highschool.gne.go.kr/s10/hsa/archive';
  const $ = cheerio.load(await fetchText(`${base}/notice.do`));
  const items = [];
  $('tbody tr').each((_, tr) => {
    const a = $(tr).find('a[href*="boardSeq="]').first();
    const seq = (a.attr('href') || '').match(/boardSeq=(\d+)/)?.[1];
    const title = clean(a.text());
    if (!seq || !title || !isHsLoose(title)) return;
    items.push({
      title,
      url: `${base}/noticeDetail.do?boardSeq=${seq}`,
      date: rowDate($, $(tr), a, title),
      summary: '',
      source: '경상남도교육청 고입포털',
    });
  });
  return dedupe(items);
}

// ── 경북: 경상북도교육청 온라인 고입전형 포털 공지사항(POST JSON). 상세는 POST 폼이라 목록 주소 + 글번호.
async function gyeongbuk() {
  const body = new URLSearchParams({ pageNo: '1', countPerPage: '20', boardGb: '5', selBrdYear: '', selKeyWd: '', keyword: '' });
  const json = JSON.parse(
    await fetchText('https://hischoolgbe.kr/online/board/getSelectBoardList', {
      init: { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } },
    }),
  );
  return (json.list ?? [])
    .filter((it) => it.title && isHsLoose(it.title))
    .map((it) => ({
      title: clean(it.title),
      url: `https://hischoolgbe.kr/online/board/hsMaterial01#${it.board_no}`,
      date: /^\d{4}-\d{2}-\d{2}$/.test(it.reg_dt ?? '') ? toIso(it.reg_dt) : null,
      summary: clean(it.content ?? '').slice(0, 160),
      source: '경상북도교육청 온라인 고입전형',
    }));
}

// ── 전북: 고입전형포털(satp.jbe.go.kr)은 인증서 체인 문제로 Node에서 접속 불가 → 보도자료 3쪽 키워드 필터
async function jeonbuk() {
  const items = [];
  for (let page = 1; page <= 3; page++) {
    const url =
      'https://www.jbe.go.kr/news/board/list.jbe?boardId=BBS_0000222&listCel=1&menuCd=DOM_000001201001000000' +
      `&orderBy=REGISTER_DATE%20DESC&paging=ok&searchOperation=AND&listRow=50&startPage=${page}`;
    const $ = cheerio.load(await fetchText(url));
    $('a[href*="dataSid="]').each((_, a) => {
      const sid = ($(a).attr('href') || '').match(/dataSid=(\d+)/)?.[1];
      const title = clean($(a).find('strong').text());
      if (!sid || !title || !isHs(title)) return;
      items.push({
        title,
        url: `https://www.jbe.go.kr/news/board/view.jbe?boardId=BBS_0000222&menuCd=DOM_000001201001000000&dataSid=${sid}`,
        date: findDate($(a).find('em.info').text()),
        summary: '',
        source: '전북특별자치도교육청 보도자료',
      });
    });
  }
  return dedupe(items);
}

// 다른 소스와 이어 붙이기 위한 헬퍼
const both = (...fns) => async () => dedupe((await Promise.all(fns.map((f) => f()))).flat());

const src = (id, name, run) => ({ id, name, kind: 'official', allowEmpty: true, run });

export default [
  src('hs-seoul', '서울시교육청 고입자료실', () =>
    openworksBoard({ origin: 'https://www.sen.go.kr', bbsSn: 1068, filter: isHsLoose, source: '서울시교육청 고입자료실' })),
  src('hs-busan', '부산시교육청 고입포털', () =>
    nttBoard({ origin: 'https://home.pen.go.kr', site: 'hischool', mi: 12446, bbsId: 4006, listCo: 30, filter: isHsLoose, source: '부산시교육청 고입포털' })),
  src('hs-daegu', '대구시교육청 공지사항', () =>
    nttBoard({ origin: 'https://www.dge.go.kr', site: 'main', mi: 5053, bbsId: 1045, listCo: 100, source: '대구시교육청 공지사항' })),
  src('hs-incheon', '인천시교육청 고등학교입학자료실', () =>
    nttBoard({ origin: 'https://www.ice.go.kr', site: 'ice', mi: 10889, bbsId: 1618, listCo: 30, filter: isHsLoose, source: '인천시교육청 고등학교입학자료실' })),
  src('hs-gwangju', '광주진로진학지원센터 고입정보', gwangju),
  src('hs-sejong', '세종시교육청 공지·고시공고', both(
    () => nttBoard({ origin: 'https://www.sje.go.kr', site: 'sje', mi: 52119, bbsId: 103, listCo: 100, source: '세종시교육청 공지사항' }),
    () => nttBoard({ origin: 'https://www.sje.go.kr', site: 'sje', mi: 52120, bbsId: 104, listCo: 100, source: '세종시교육청 고시공고' }),
  )),
  src('hs-gyeonggi', '경기도교육청 고입포털·보도자료', gyeonggi),
  src('hs-gangwon', '강원특별자치도교육청 고입자료실', gangwon),
  src('hs-chungbuk', '충북교육청 고입시 게시판', () =>
    nttBoard({ origin: 'https://www.cbe.go.kr', site: 'cbe', mi: 11465, bbsId: 1779, listCo: 30, filter: isHsLoose, source: '충북교육청 고입시' })),
  src('hs-jeonbuk', '전북특별자치도교육청 보도자료', jeonbuk),
  src('hs-jeonnam', '전남교육청 진로진학지원센터 고입자료실', () =>
    nttBoard({ origin: 'https://www.jge.go.kr', site: 'jinro', mi: 824, bbsId: 396, listCo: 30, filter: isHsLoose, source: '전남교육청 진로진학지원센터' })),
  src('hs-gyeongbuk', '경북교육청 온라인 고입전형', gyeongbuk),
  src('hs-gyeongnam', '경남교육청 고입포털', gyeongnam),
];
