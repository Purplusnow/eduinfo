import { fetchJson } from '../lib/http.mjs';

// NEIS 교육정보 개방 포털 학교기본정보. 인증키(NEIS_API_KEY)가 없으면 5건만 내려주므로 건너뛴다.
async function neisHighSchools() {
  const key = process.env.NEIS_API_KEY;
  if (!key) return null;
  const rows = [];
  for (let page = 1; page <= 10; page++) {
    const url =
      `https://open.neis.go.kr/hub/schoolInfo?KEY=${key}&Type=json&pIndex=${page}&pSize=1000` +
      `&SCHUL_KND_SC_NM=${encodeURIComponent('고등학교')}`;
    const data = await fetchJson(url);
    const batch = data.schoolInfo?.[1]?.row ?? [];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows.map((r) => ({
    id: r.SD_SCHUL_CODE,
    name: r.SCHUL_NM,
    region: r.LCTN_SC_NM,
    type: r.HS_SC_NM, // 일반고/특목고/자율고/특성화고
    track: r.SPCLY_PURPS_HS_ORD_NM, // 과학계열·외국어계열 등
    founding: r.FOND_SC_NM,
    coed: r.COEDU_SC_NM,
    address: r.ORG_RDNMA,
    homepage: r.HMPG_ADRES,
  }));
}

export default [{ id: 'neis-schools', name: 'NEIS 고등학교 정보', kind: 'schools', run: neisHighSchools }];
