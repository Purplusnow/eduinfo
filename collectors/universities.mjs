// 공공데이터포털 대학알리미 API(한국대학교육협의회)로 대학 목록·공시 지표·학과 정보를 모은다.
// 통계 API는 학교마다 따로 호출해야 하고 개발계정 한도가 API별 하루 1,000건이라,
// 하루 예산(DAILY_BUDGET) 안에서 오래된 값부터 조금씩 채워 src/data/universities.json 에 누적한다.
// DATA_GO_KR_KEY 가 없으면 아무것도 하지 않는다.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { fetchText } from './lib/http.mjs';

const KEY = process.env.DATA_GO_KR_KEY;
if (!KEY) {
  console.log('DATA_GO_KR_KEY 가 없어 대학 정보 수집을 건너뜁니다.');
  process.exit(0);
}
// 포털이 주는 "일반 인증키"는 이미 URL 인코딩된 값이다. 인코딩 전 값이 들어오면 인코딩한다.
const SERVICE_KEY = KEY.includes('%') ? KEY : encodeURIComponent(KEY);

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data');
const BASE = 'https://apis.data.go.kr/B340014';
const DAILY_BUDGET = Number(process.env.UNIV_DAILY_BUDGET || 900); // API(서비스)별 하루 호출 수
const METRIC_TTL_DAYS = 30;
const LIST_TTL_DAYS = 7;
const KINDS = new Set(['대학교', '교육대학', '산업대학', '전문대학']);

// 대학별 공시 지표: 서비스, 오퍼레이션, 값 필드
const METRICS = [
  { id: 'competition', service: 'StudentService', op: 'getComparisonInsideFixedNumberFreshmanCompetitionRate', field: 'indctVal1' },
  { id: 'fillRate', service: 'StudentService', op: 'getComparisonFreshmanEnsureCrntSt', field: 'indctVal1' },
  { id: 'employment', service: 'StudentService', op: 'getNoticeGraduateEmploymentRate', field: 'indctVal4', avg: 'indctAvg' },
  { id: 'dropout', service: 'StudentService', op: 'getNoticeStudentsWastageRate', field: 'indctVal4', avg: 'indctAvg' },
  { id: 'tuition', service: 'FinancesService', op: 'getComparisonTuitionCrntSt', field: 'indctVal1' },
  { id: 'scholarship', service: 'FinancesService', op: 'getComparisonScholarshipBenefitCrntSt', field: 'indctVal1' },
];

const parser = new XMLParser({ parseTagValue: false });
const now = new Date();
const kstDate = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
const daysSince = (iso) => (iso ? (now - new Date(iso)) / 86400_000 : Infinity);

async function call(service, op, params) {
  const qs = new URLSearchParams(params).toString();
  const xml = await fetchText(`${BASE}/${service}/${op}?serviceKey=${SERVICE_KEY}&${qs}`, { timeout: 30000 });
  const doc = parser.parse(xml);
  const res = doc.response ?? doc.OpenAPI_ServiceResponse;
  const code = res?.header?.resultCode ?? res?.cmmMsgHeader?.returnReasonCode;
  if (code !== '00' && code !== 0 && code !== '0') {
    const msg = res?.header?.resultMsg ?? res?.cmmMsgHeader?.returnAuthMsg ?? xml.slice(0, 200);
    throw new Error(`${service}/${op} 오류 ${code}: ${msg}`);
  }
  const items = res.body?.items?.item;
  return { items: items == null ? [] : [].concat(items), total: Number(res.body?.totalCount ?? 0) };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
}
const writeJson = (file, data) => writeFile(path.join(DATA_DIR, file), JSON.stringify(data) + '\n');

const store = await readJson('universities.json', { schools: [], meta: {} });
const meta = (store.meta ??= {});
if (meta.calls?.date !== kstDate) meta.calls = { date: kstDate };
const used = (svc) => meta.calls[svc] ?? 0;
const spend = (svc) => (meta.calls[svc] = used(svc) + 1);
const report = {};

// 1) 공시 연도와 대학 목록(주 1회)
async function refreshSchools() {
  const thisYear = now.getFullYear();
  for (const year of [thisYear, thisYear - 1, thisYear - 2]) {
    const rows = [];
    for (let page = 1; page <= 5; page++) {
      const { items, total } = await call('SchoolInfoService', 'getSchoolInfo', { pageNo: page, numOfRows: 1000, svyYr: year });
      rows.push(...items);
      if (rows.length >= total || !items.length) break;
    }
    if (!rows.length) continue;
    const prev = new Map(store.schools.map((s) => [s.id, s]));
    store.schools = rows
      .filter((r) => (r.schlDivNm === '대학' || r.schlDivNm === '전문대학') && KINDS.has(r.schlKndNm))
      .map((r) => ({
        id: r.schlId,
        name: r.schlNm,
        campus: r.psbsDivNm,
        kind: r.schlKndNm,
        estb: r.schlEstbDivNm,
        region: r.pbnfAreaNm,
        address: r.postNoAdrs,
        homepage: r.schlUrlAdrs,
        phone: r.schlRepTpNoCtnt,
        founded: r.schlEstbDt,
        metrics: prev.get(r.schlId)?.metrics ?? {},
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    store.year = year;
    meta.schoolsAt = now.toISOString();
    return store.schools.length;
  }
  throw new Error('대학 목록을 받지 못했습니다');
}

// 2) 대학별 지표(하루 예산 안에서 오래된 것부터). 요청은 http 계층이 동시 4건으로 조절한다.
async function refreshMetrics() {
  const todo = [];
  // 학교 단위로 여섯 지표를 함께 채워, 수집 도중에도 완성된 대학 페이지가 늘어나게 한다
  for (const s of store.schools) {
    for (const m of METRICS) {
      const cur = s.metrics[m.id];
      if (cur && cur.year === store.year && daysSince(cur.at) < METRIC_TTL_DAYS) continue;
      if (used(m.service) >= DAILY_BUDGET) continue;
      spend(m.service);
      todo.push({ m, s });
    }
  }
  let failed = 0;
  const errors = [];
  await Promise.all(
    todo.map(async ({ m, s }) => {
      try {
        const { items } = await call(m.service, m.op, { pageNo: 1, numOfRows: 5, svyYr: store.year, schlId: s.id });
        const it = items.find((x) => String(x.schlId) === s.id) ?? items[0];
        const v = it?.[m.field] != null && it[m.field] !== '' ? Number(it[m.field]) : null;
        s.metrics[m.id] = { v: Number.isFinite(v) ? v : null, year: store.year, at: now.toISOString() };
        if (m.avg && it?.[m.avg] != null) s.metrics[m.id].avg = Number(it[m.avg]);
      } catch (err) {
        failed++;
        errors.push(`${s.name} ${m.id}: ${err.message}`);
      }
    }),
  );
  errors.slice(0, 3).forEach((e) => console.error('  ' + e));
  if (todo.length && failed > todo.length / 2) throw new Error(`지표 ${todo.length}건 중 ${failed}건 실패: ${errors[0]}`);
  return todo.length - failed;
}

// 3) 학과 정보(주 1회). 운영 중인 학사·전문학사 과정만, 학교명별로 묶는다.
async function refreshMajors() {
  const bySchool = {};
  const names = new Set(store.schools.map((s) => s.name));
  let total = 0;
  for (let page = 1; page <= 100; page++) {
    const { items, total: t } = await call('SchoolMajorInfoService', 'getSchoolMajorInfo', { pageNo: page, numOfRows: 1000, svyYr: store.year });
    total = t;
    for (const r of items) {
      if (!names.has(r.schlNm)) continue;
      if (r.pbnfDgriCrseDivNm !== '학사' && r.pbnfDgriCrseDivNm !== '전문학사') continue;
      if (r.schlMjrStatNm === '폐과') continue;
      const jobs = String(r.pwayEmplLtrCtnt ?? '').split('|').filter(Boolean).slice(0, 5).join(', ');
      // [단과대학, 학과, 계열, 수업연한, 입학정원, 주야, 관련직업]
      (bySchool[r.schlNm] ??= []).push([r.clgNm ?? '', r.korMjrNm ?? '', r.onsfSrsClftNm ?? '', r.lsnTrmNm ?? '', Number(r.eschlPscpNum) || 0, r.dghtDivNm ?? '', jobs]);
    }
    if (page * 1000 >= total || !items.length) break;
  }
  for (const list of Object.values(bySchool)) list.sort((a, b) => a[0].localeCompare(b[0], 'ko') || a[1].localeCompare(b[1], 'ko'));
  await writeJson('majors.json', { updatedAt: now.toISOString(), year: store.year, bySchool });
  meta.majorsAt = now.toISOString();
  return Object.values(bySchool).reduce((n, l) => n + l.length, 0);
}

async function step(id, name, fn, staleHours) {
  try {
    const count = await fn();
    report[id] = { name, ok: true, count, staleHours };
    console.log(`✓ ${id}: ${count}건`);
  } catch (err) {
    report[id] = { name, ok: false, error: err.message, staleHours };
    console.error(`✗ ${id}: ${err.message}`);
  }
}

if (!store.schools.length || daysSince(meta.schoolsAt) >= LIST_TTL_DAYS) {
  await step('univ-list', '대학알리미 대학 목록', refreshSchools, 24 * 9);
}
if (store.schools.length) {
  await step('univ-metrics', '대학알리미 공시 지표', refreshMetrics, 24 * 3);
  if (daysSince(meta.majorsAt) >= LIST_TTL_DAYS) await step('univ-majors', '대학알리미 학과 정보', refreshMajors, 24 * 9);
}

store.updatedAt = now.toISOString();
await writeJson('universities.json', store);

// 수집 현황(status.json)에 기록. 주기가 긴 작업은 staleHours 로 장애 판정 기준을 늘린다.
const status = await readJson('status.json', { sources: {} });
for (const [id, r] of Object.entries(report)) {
  const prev = status.sources[id] ?? {};
  status.sources[id] = r.ok
    ? { ...prev, ...r, error: undefined, checkedAt: now.toISOString(), lastSuccess: now.toISOString(), lastNonEmpty: now.toISOString(), allowEmpty: true, since: prev.since ?? now.toISOString() }
    : { ...prev, ...r, checkedAt: now.toISOString(), allowEmpty: true, since: prev.since ?? now.toISOString() };
}
await writeFile(path.join(DATA_DIR, 'status.json'), JSON.stringify(status, null, 1) + '\n');

// 워크플로 알림용: 대학 지표 채움 현황을 요약 파일에 덧붙인다
if (process.env.SUMMARY_FILE) {
  let sum = {};
  try {
    sum = JSON.parse(await readFile(process.env.SUMMARY_FILE, 'utf8'));
  } catch {}
  const complete = store.schools.filter((s) => METRICS.every((m) => s.metrics[m.id]?.year === store.year)).length;
  sum.univ = { complete, total: store.schools.length, year: store.year, fetched: report['univ-metrics']?.count ?? 0 };
  await writeFile(process.env.SUMMARY_FILE, JSON.stringify(sum));
}

const filled = METRICS.map((m) => `${m.id} ${store.schools.filter((s) => s.metrics[m.id]?.year === store.year).length}/${store.schools.length}`);
console.log(`공시연도 ${store.year} · 오늘 호출 ${JSON.stringify(meta.calls)} · ${filled.join(', ')}`);
