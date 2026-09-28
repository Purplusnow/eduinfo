# 입시정보 한눈에 (eduinfo)

국내 입시 정보를 자동으로 모아 보여주는 정적 사이트입니다. → https://edu.koreanblog.xyz GitHub Actions가 3시간마다 공식 기관과 언론의 입시 소식을 수집해 커밋하고, Astro로 빌드한 뒤 GitHub Pages에 배포합니다.

## 무엇을 모으나

| 종류 | 출처 | 방식 | 코드 |
| --- | --- | --- | --- |
| 뉴스 | 베리타스알파, 에듀진, 한국대학신문, 에듀프레스, 에듀인뉴스 | RSS, 입시 키워드로 거름 | `collectors/sources/news.mjs` |
| 공식 발표 | 교육부 보도자료(입시 관련만, 평가원 수능 발표 포함) | 게시판 크롤링 | `collectors/sources/official.mjs` |
| 고입 공지 | 13개 시·도교육청 고입 게시판 | 게시판 크롤링 | `collectors/sources/highschool.mjs` |
| 대학 정보 | 대학알리미 공시·학과 (`DATA_GO_KR_KEY`) | Open API | `collectors/universities.mjs` |
| 기출문제 | 평가원 수능 기출문제 링크 | 직접 관리(수능 후 연 1회) | `src/data/exams.json` |
| 고교 정보 | NEIS 학교기본정보 (선택: `NEIS_API_KEY`) | Open API | `collectors/sources/schools.mjs` |
| 주간 브리핑 | 수집 데이터를 Claude가 요약 (선택: `ANTHROPIC_API_KEY`) | Claude API | `collectors/digest.mjs` |
| 입시 일정 | 대교협 기본사항, 교육부·평가원 발표 | 직접 검증해 작성 | `src/data/schedule.json` |
| 가이드 | 공개 자료 기반 정리글 | 직접 작성 | `src/content/guides/*.md` |

## 로컬 실행

```bash
npm install
npm run collect      # src/data/*.json 갱신 (특정 출처만: node collectors/run.mjs moe hs-seoul)
npm run dev          # http://localhost:4321
npm run build        # dist/ 생성 + Pagefind 검색 색인
```

## 배포 설정

1. GitHub에 저장소를 만들고 push
2. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정
3. (선택) **Settings → Secrets and variables → Actions**에 추가
   - `NEIS_API_KEY`: [NEIS 교육정보 개방 포털](https://open.neis.go.kr)에서 발급. 전국 고등학교 페이지(`/schools/`)가 생깁니다.
   - `ANTHROPIC_API_KEY`: 매주 월요일 주간 입시 브리핑을 자동 작성합니다. 모델은 `DIGEST_MODEL` 환경 변수로 바꿀 수 있습니다(기본 `claude-opus-5`).
4. **Actions** 탭에서 워크플로를 수동 실행(`workflow_dispatch`)해 첫 배포

## 구조

```
collectors/           수집기 (Node, 의존성: cheerio, fast-xml-parser)
  lib/                HTTP(호스트별 순차 요청), RSS 파서, 키워드 분류
  sources/            출처별 수집 함수 — 새 출처는 여기에 추가하고 run.mjs에 등록
  run.mjs             전체 실행, 병합·중복 제거·보관기간 정리, status.json 기록
  digest.mjs          주간 브리핑 생성
src/data/             수집 결과(JSON) + 직접 관리하는 일정·링크
src/content/guides/   직접 작성하는 가이드(Markdown, 출처 필수)
src/content/digests/  자동 생성 주간 브리핑
src/pages/            페이지
.github/workflows/    수집·빌드·배포 워크플로
```

## 운영 메모

- **수집 원칙:** 새 출처를 추가하기 전에 robots.txt를 확인합니다. Google 뉴스, 평가원 수능 사이트(suneung.re.kr), 대교협 어디가(adiga.kr)는 자동 수집을 금지하므로 쓰지 않습니다(대전·충남·제주교육청도 같은 이유로 제외).

- 한 출처가 실패해도 기존 데이터는 유지됩니다. 상태는 사이트의 `/status/` 페이지에서 볼 수 있습니다.
- 게시판 크롤러는 사이트 HTML 구조가 바뀌면 0건을 반환할 수 있습니다. `/status/`에서 0건이 이어지면 해당 `sources/*.mjs`의 선택자를 확인하세요.
- 분류 키워드는 `collectors/lib/classify.mjs`에서 관리합니다. 바꾸면 다음 수집 때 기존 항목도 다시 분류됩니다.
- `schedule.json`은 학년도가 바뀔 때(매년 대입전형 기본사항 발표 후) 직접 갱신해야 합니다.
- GitHub은 60일 동안 저장소 활동이 없으면 예약 워크플로를 멈춥니다. 자동 커밋이 활동으로 잡히지만, 멈추면 Actions 탭에서 다시 켜세요.
