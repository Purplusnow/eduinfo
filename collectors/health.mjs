// status.json 을 보고 출처별 장애·복구를 판정한다. 상태가 바뀐 경우에만 알림 문구를 표준출력으로 내보내고,
// 알림 상태는 status.json 의 alerts 에 기록해 같은 장애로 반복 알림하지 않는다.
// 판정: 마지막 정상 수집(allowEmpty 출처는 성공, 그 밖에는 1건 이상 수집)이 THRESHOLD_H 시간을 넘으면 장애.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const THRESHOLD_H = Number(process.env.HEALTH_THRESHOLD_HOURS || 24);
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/status.json');
const status = JSON.parse(await readFile(file, 'utf8'));
const alerts = (status.alerts ??= {});
const now = Date.now();
// '09/27 09:50' (KST)
const kst = (iso) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(5, 16).replace('-', '/').replace('T', ' ') : '기록 없음');

const down = [];
const recovered = [];
for (const [id, s] of Object.entries(status.sources)) {
  if (s.skipped) continue;
  const healthyAt = s.allowEmpty ? s.lastSuccess : s.lastNonEmpty;
  const ref = healthyAt ?? s.since ?? s.checkedAt;
  const isDown = now - new Date(ref).getTime() > THRESHOLD_H * 3600_000;
  if (isDown && !alerts[id]) {
    alerts[id] = new Date(now).toISOString();
    down.push({ id, s, healthyAt });
  } else if (!isDown && alerts[id]) {
    recovered.push({ id, s, since: alerts[id] });
    delete alerts[id];
  }
}

await writeFile(file, JSON.stringify(status, null, 1) + '\n');

const lines = [];
if (down.length) {
  lines.push(`[입시정보] 수집 장애 ${down.length}건`);
  for (const { id, s, healthyAt } of down) {
    const why = s.ok === false ? `실패: ${(s.error ?? '').slice(0, 100)}` : '계속 0건';
    lines.push('', `■ ${s.name} (${id})`, `  ${why}`, `  마지막 정상: ${kst(healthyAt)}`);
  }
}
if (recovered.length) {
  if (lines.length) lines.push('');
  lines.push(`[입시정보] 수집 복구 ${recovered.length}건`);
  for (const { id, s, since } of recovered) lines.push(`■ ${s.name} (${id}) — ${kst(since)} 장애 알림 이후 정상화`);
}
if (lines.length) {
  const still = Object.keys(alerts).length;
  if (still) lines.push('', `현재 장애 중인 출처: ${still}곳`);
  process.stdout.write(lines.join('\n') + '\n');
}
