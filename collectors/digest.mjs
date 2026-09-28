// 지난 7일간 수집한 뉴스·공식 발표로 주간 입시 브리핑을 작성해 src/content/digests/ 에 저장한다.
// ANTHROPIC_API_KEY 가 없으면 아무것도 하지 않는다. 월요일에만, 하루 한 번만 작성한다(--force 로 강제).
import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = process.env.DIGEST_MODEL || 'claude-opus-5';

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('ANTHROPIC_API_KEY 가 없어 주간 브리핑을 건너뜁니다.');
  process.exit(0);
}

const kstDate = (d) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
const today = kstDate(new Date());
const file = path.join(ROOT, 'src/content/digests', `${today}.md`);
if (!process.argv.includes('--force')) {
  // 매주 월요일(KST)에만 작성
  if (new Date(Date.now() + 9 * 3600_000).getUTCDay() !== 1) {
    console.log('주간 브리핑은 월요일에만 작성합니다(--force 로 강제).');
    process.exit(0);
  }
  const exists = await access(file).then(() => true, () => false);
  if (exists) {
    console.log(`${today} 브리핑이 이미 있습니다.`);
    process.exit(0);
  }
}

const load = async (f) => JSON.parse(await readFile(path.join(ROOT, 'src/data', f), 'utf8')).items;
const since = Date.now() - 7 * 86400_000;
const recent = (items) => items.filter((it) => new Date(it.date ?? it.firstSeen).getTime() >= since);
const news = recent(await load('news.json'));
const official = recent(await load('official.json'));
const schedule = JSON.parse(await readFile(path.join(ROOT, 'src/data/schedule.json'), 'utf8'));

const line = (it) => `- [${kstDate(new Date(it.date ?? it.firstSeen))}] (${it.source}) ${it.title} <${it.url}>`;
const upcoming = schedule.events
  .filter((e) => (e.end ?? e.start) >= today)
  .slice(0, 8)
  .map((e) => `- ${e.start}${e.end ? ` ~ ${e.end}` : ''}: ${e.title}`);

const prompt = `오늘은 ${today}(KST)입니다. 아래는 지난 7일 동안 수집한 한국 입시 관련 공식 발표와 뉴스 기사 제목 목록입니다.
고3·N수생과 학부모가 읽을 "주간 입시 브리핑"을 한국어 마크다운으로 써 주세요.

규칙:
- 첫 줄은 "# " 로 시작하는 제목(예: "9월 넷째 주 입시 브리핑: …"), 둘째 줄은 "> " 로 시작하는 한 문장 요약.
- 이어서 "## 이번 주 핵심" (3~5개 항목), "## 공식 발표", "## 분야별 소식"(수능·수시·정시·의약학·정책·고입 중 해당하는 것만), "## 다가오는 일정" 순서로 작성.
- 목록에 있는 제목에서 확인되는 사실만 씁니다. 제목에 없는 수치·날짜·해석을 지어내지 마세요. 추측이 필요하면 쓰지 마세요.
- 각 항목 끝에 근거 기사 링크를 [출처명](URL) 형식으로 붙입니다. URL은 목록의 것을 그대로 씁니다.
- 같은 사건을 다룬 기사는 하나로 묶고, 광고성·지역 행사성 기사는 뺍니다.
- 전체 분량은 A4 한 장 안팎.

## 공식 발표 (${official.length}건)
${official.map(line).join('\n') || '- 없음'}

## 뉴스 (${news.length}건)
${news.slice(0, 400).map(line).join('\n')}

## 다가오는 일정 (확정 일정)
${upcoming.join('\n')}`;

const client = new Anthropic();
let response;
try {
  response = await client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      // 안전 분류기가 거절하면 서버가 다른 모델로 자동 재시도
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: prompt }],
    })
    .finalMessage();
} catch (err) {
  if (err instanceof Anthropic.RateLimitError) console.error('요청 한도 초과, 다음 주기에 다시 시도합니다.');
  else if (err instanceof Anthropic.APIError) console.error(`API 오류 ${err.status}: ${err.message}`);
  else console.error(err);
  process.exit(0); // 브리핑 실패가 사이트 배포를 막지 않도록
}

if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
  console.error(`브리핑 생성 중단: ${response.stop_reason}`);
  process.exit(0);
}

const text = response.content
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('')
  .trim();
const lines = text.split('\n');
const title = (lines.find((l) => l.startsWith('# ')) ?? `# ${today} 주간 입시 브리핑`).slice(2).trim();
const summary = (lines.find((l) => l.startsWith('> ')) ?? '> ').slice(2).trim();
const body = lines.filter((l) => !l.startsWith('# ') && l !== `> ${summary}`).join('\n').trim();

const yaml = (s) => JSON.stringify(s); // JSON 문자열은 유효한 YAML 스칼라
await writeFile(
  file,
  `---\ntitle: ${yaml(title)}\ndate: ${today}\nsummary: ${yaml(summary)}\ngenerated: true\n---\n\n${body}\n`,
);
console.log(`브리핑 저장: ${path.relative(ROOT, file)} (${response.model}, 출력 ${response.usage.output_tokens} 토큰)`);
