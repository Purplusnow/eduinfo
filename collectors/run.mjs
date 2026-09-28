// 모든 소스를 수집해 src/data/*.json 에 누적 저장한다.
// 한 소스가 실패해도 기존 데이터는 유지되고, 상태는 status.json 에 남는다.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import news from './sources/news.mjs';
import official from './sources/official.mjs';
import schools from './sources/schools.mjs';
import highschool from './sources/highschool.mjs';
import { classify } from './lib/classify.mjs';
import { hash, normTitle, truncate } from './lib/util.mjs';

// 시·도교육청 고입 게시판(hs-*)에서 온 글은 제목 키워드와 관계없이 고입으로 분류
const categorize = (it) => {
  const c = classify(`${it.title} ${it.summary ?? ''}`);
  return it.sourceId?.startsWith('hs-') && !c.includes('highschool') ? [...c, 'highschool'] : c;
};

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data');
const SOURCES = [...news, ...official, ...highschool, ...schools];

// kind별 보관 정책
const RETENTION = {
  news: { file: 'news.json', maxDays: 45, maxItems: 1500 },
  official: { file: 'official.json', maxDays: 400, maxItems: 800 },
};

const now = new Date();
const only = process.argv.slice(2); // 예: node collectors/run.mjs moe kice-notice

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 1) + '\n');
}

function normalize(raw, src) {
  const title = raw.title?.trim();
  if (!title || !raw.url) return null;
  return {
    id: raw.id ?? hash(raw.url),
    title,
    url: raw.url,
    date: raw.date ?? null,
    firstSeen: now.toISOString(),
    source: raw.source ?? src.name,
    sourceId: src.id,
    summary: truncate(raw.summary ?? '', 180),
    categories: categorize({ title, summary: raw.summary, sourceId: src.id }),
    ...(raw.year ? { year: raw.year, subject: raw.subject } : {}),
  };
}

function merge(existing, incoming, { maxDays, maxItems }) {
  const byId = new Map(existing.map((it) => [it.id, it]));
  const titles = new Set(existing.map((it) => normTitle(it.title)));
  let added = 0;
  for (const it of incoming) {
    const prev = byId.get(it.id);
    if (prev) {
      byId.set(it.id, { ...it, firstSeen: prev.firstSeen, date: it.date ?? prev.date });
      continue;
    }
    const key = normTitle(it.title);
    if (titles.has(key)) continue; // 다른 피드에서 이미 받은 같은 기사
    titles.add(key);
    byId.set(it.id, it);
    added++;
  }
  const cutoff = now.getTime() - maxDays * 86400_000;
  const items = [...byId.values()]
    .filter((it) => new Date(it.date ?? it.firstSeen).getTime() >= cutoff)
    // 미래 날짜(피드 오류)는 처음 본 시각으로 보정하고, 키워드 변경이 기존 항목에도 반영되도록 다시 분류
    .map((it) => ({
      ...it,
      date: it.date && new Date(it.date) > now ? it.firstSeen : it.date,
      categories: categorize(it),
    }))
    .sort((a, b) => new Date(b.date ?? b.firstSeen) - new Date(a.date ?? a.firstSeen))
    .slice(0, maxItems);
  return { items, added };
}

const status = await readJson('status.json', { sources: {} });
const buckets = { news: [], official: [] };

const targets = only.length ? SOURCES.filter((s) => only.includes(s.id)) : SOURCES;
const results = await Promise.allSettled(targets.map((s) => s.run()));

for (const [i, src] of targets.entries()) {
  const r = results[i];
  const prev = status.sources[src.id] ?? {};
  if (r.status === 'rejected') {
    console.error(`✗ ${src.id}: ${r.reason?.message ?? r.reason}`);
    status.sources[src.id] = { ...prev, name: src.name, ok: false, error: String(r.reason?.message ?? r.reason), checkedAt: now.toISOString(), since: prev.since ?? now.toISOString() };
    continue;
  }
  if (r.value == null) {
    console.log(`- ${src.id}: 건너뜀(설정 없음)`);
    status.sources[src.id] = { ...prev, name: src.name, ok: null, skipped: true, checkedAt: now.toISOString() };
    continue;
  }
  if (src.kind === 'schools') {
    await writeJson('schools.json', { updatedAt: now.toISOString(), items: r.value });
  } else {
    buckets[src.kind].push(...r.value.map((raw) => normalize(raw, src)).filter(Boolean));
  }
  console.log(`✓ ${src.id}: ${r.value.length}건`);
  status.sources[src.id] = {
    name: src.name,
    ok: true,
    count: r.value.length,
    checkedAt: now.toISOString(),
    lastSuccess: now.toISOString(),
    // 0건이 계속되는 것도 장애로 본다(allowEmpty 출처 제외). health.mjs 가 참고
    lastNonEmpty: r.value.length > 0 ? now.toISOString() : prev.lastNonEmpty,
    allowEmpty: src.allowEmpty ?? false,
    since: prev.since ?? now.toISOString(),
  };
}

for (const [kind, incoming] of Object.entries(buckets)) {
  if (!incoming.length) continue;
  const policy = RETENTION[kind];
  const store = await readJson(policy.file, { items: [] });
  const { items, added } = merge(store.items, incoming, policy);
  await writeJson(policy.file, { updatedAt: now.toISOString(), items });
  console.log(`→ ${policy.file}: 신규 ${added}건, 총 ${items.length}건`);
}

status.updatedAt = now.toISOString();
await writeJson('status.json', status);

const failed = targets.filter((s) => status.sources[s.id]?.ok === false).length;
if (failed === targets.length) {
  console.error('모든 소스가 실패했습니다');
  process.exit(1);
}
