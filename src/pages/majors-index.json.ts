// 학과 찾기 페이지가 불러오는 압축 색인. 빌드 때 /majors-index.json 으로 생성된다.
import type { APIRoute } from 'astro';
import majorsData from '../data/majors.json';
import { univ, kindGroup } from '../lib/univ';

// majors.json 행: [단과대학, 학과, 계열, 수업연한, 입학정원, 주야, 관련직업]
type Major = [string, string, string, string, number, string, string];

export const GET: APIRoute = () => {
  // 같은 이름의 캠퍼스가 여럿이면 본교를 대표로 링크한다
  const byName = new Map<string, (typeof univ.schools)[number]>();
  for (const s of univ.schools) {
    const cur = byName.get(s.name);
    if (!cur || (cur.campus !== '본교' && s.campus === '본교')) byName.set(s.name, s);
  }
  const schools: [string, string, string, string][] = []; // [id, 이름, 지역, 유형]
  const schoolIdx = new Map<string, number>();
  const rows: (string | number)[][] = []; // [학과, 학교번호, 계열, 연한, 정원, 관련직업]
  for (const [name, list] of Object.entries((majorsData as { bySchool: Record<string, Major[]> }).bySchool)) {
    const s = byName.get(name);
    if (!s) continue;
    if (!schoolIdx.has(name)) {
      schoolIdx.set(name, schools.length);
      schools.push([s.id, name, s.region, kindGroup(s)]);
    }
    const i = schoolIdx.get(name)!;
    for (const m of list) if (!/기타모집단위|소속학과없음|^기타$/.test(m[1])) rows.push([m[1] + (m[5] === '야간' ? ' (야간)' : ''), i, m[2], m[3], m[4], m[6]]);
  }
  return new Response(JSON.stringify({ year: univ.year, schools, rows }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
