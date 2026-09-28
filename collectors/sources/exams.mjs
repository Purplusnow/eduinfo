import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.mjs';
import { toIso } from '../lib/util.mjs';

// 평가원 수능 기출문제 게시판(1500234). 행: 번호 | 학년도 | 영역 | 제목 | 등록일 | 조회 | 첨부
async function suneungPastExams() {
  const items = [];
  for (let page = 1; page <= 3; page++) {
    const url = `https://www.suneung.re.kr/boardCnts/list.do?boardID=1500234&m=0403&s=suneung&page=${page}`;
    const $ = cheerio.load(await fetchText(url));
    $('table:not(.mb) td.link a').each((_, a) => {
      const seq = ($(a).attr('onclick') || '').match(/'1500234',\s*'(\d+)'/)?.[1];
      const tds = $(a).closest('tr').find('td');
      if (!seq) return;
      const year = tds.eq(1).text().trim();
      const subject = tds.eq(2).text().trim();
      items.push({
        id: `kice-exam-${seq}`,
        title: `${year}학년도 수능 ${subject} ${($(a).attr('title') || $(a).text()).trim()}`,
        url: `https://www.suneung.re.kr/boardCnts/view.do?boardID=1500234&boardSeq=${seq}&lev=0&m=0403&s=suneung`,
        date: toIso(tds.eq(4).text().trim()),
        summary: '',
        source: '한국교육과정평가원',
        year: Number(year) || null,
        subject,
      });
    });
  }
  return items;
}

export default [{ id: 'kice-exams', name: '평가원 수능 기출문제', kind: 'exam', run: suneungPastExams }];
