// 제목·요약의 키워드로 입시 분류 태그를 붙인다. 순서가 곧 사이트의 카테고리 표시 순서.
export const CATEGORIES = [
  { id: 'suneung', label: '수능·모평', keywords: ['수능', '대학수학능력시험', '모의평가', '모평', '학력평가', '수능특강', '킬러문항', 'EBS 연계'] },
  { id: 'susi', label: '수시', keywords: ['수시', '학생부종합', '학종', '학생부교과', '논술', '면접', '적성고사', '실기전형', '수능최저'] },
  { id: 'jeongsi', label: '정시', keywords: ['정시', '표준점수', '백분위', '가군', '나군', '다군', '추가모집', '충원'] },
  { id: 'medical', label: '의약학계열', keywords: ['의대', '의과대학', '의학계열', '치대', '한의대', '약대', '수의대', '간호', '지역인재', '의대 정원', '의대정원'] },
  { id: 'policy', label: '입시정책', keywords: ['대입 개편', '대입개편', '입시제도', '2028 대입', '2028학년도', '고교학점제', '내신 5등급', '통합형 수능', '대입전형 기본사항', '시행계획', '무전공', '자율전공', '학폭', '공정성'] },
  { id: 'highschool', label: '고입', keywords: ['고입', '특목고', '자사고', '자율형사립고', '과학고', '외고', '외국어고', '국제고', '영재학교', '영재고', '마이스터고', '특성화고'] },
  { id: 'etc', label: '편입·재외·기타', keywords: ['편입', '재외국민', '외국인 전형', '검정고시', '전문대', '재수생', 'N수', '반수생', '사관학교', '경찰대', '교대 입시', '교육대학'] },
];

// 일반 교육 매체 기사 중 입시 관련만 남기기 위한 넓은 키워드.
// '합격', '모집'처럼 입시 밖에서도 흔한 단어는 넣지 않는다.
const RELEVANCE = [
  '입시', '대입', '입학전형', '신입생 모집', '수험생', '경쟁률', '입결', '학생부', '내신', '원서접수',
  ...CATEGORIES.flatMap((c) => c.keywords),
];

export function classify(text) {
  const t = text ?? '';
  return CATEGORIES.filter((c) => c.keywords.some((k) => t.includes(k))).map((c) => c.id);
}

export function isRelevant(text) {
  const t = text ?? '';
  return RELEVANCE.some((k) => t.includes(k));
}
