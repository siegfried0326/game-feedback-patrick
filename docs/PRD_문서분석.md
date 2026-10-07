# PRD: 문서 분석 시스템

## 1. 개요

| 항목 | 내용 |
|------|------|
| 서비스명 | 아카이브 187 (Archive187) |
| AI 엔진 | Anthropic Claude — 기본 분석 Sonnet 5.5 / 정밀 분석 Opus 5.5 / 1단계 스캔 Haiku 4.5 (`lib/analysis/model.ts`) |
| 파일 처리 | 클라이언트 압축/텍스트추출 + 서버 업로드 + **Files API로 원본 전달** + AI 분석 |
| 마지막 갱신 | 2026-10-06 (직군별 채점·모델 세대 교체·Files API·프롬프트 캐싱) |

게임 기획 포트폴리오를 AI로 분석하여 점수, 강점/보완점, 회사별 비교 피드백을 제공하는 핵심 기능.

### 1.1 2026-10-06 개편 요약
| 전 | 후 |
|---|---|
| 모든 문서를 같은 15개 카테고리로 채점 | **직군별 채점표** — 8개 직군 × 15개 카테고리를 핵심/관련/해당 없음으로 구분. 해당 없음은 `value: null`로 점수 제외 |
| 비교 합격작: 키워드 태그 부분일치 → 부족하면 전체 무작위 50개 | **같은 직군 합격작만** 비교. 표본 5건 미만이면 "표본 부족"을 결과에 표시하고 종합 문서로만 보충 |
| 1단계: 키워드 추출 | 1단계: **직군·문서형식·키워드 스캔** (Haiku) → 사용자가 직군 확인·변경 |
| 단일 모델 Sonnet 4 | 기본 Sonnet 5.5 (1크레딧) / 정밀 Opus 5.5 effort high (2크레딧) |
| 10MB 초과 PDF는 텍스트만 (10만 자 절삭) | 원본을 Files API로 전달 (크기 제한 사실상 해제), 실패 시 base64 → 텍스트(40만 자) 폴백 |
| 셔플로 매번 다른 프롬프트 | 결정적 비교군 + 4블록 프롬프트 캐싱 |
| 토큰 사용량 미기록 | `analysis_history.token_usage`에 모델·토큰·추정 원가 기록 |

코드 구조: `lib/analysis/` — `domains.ts`(채점표) · `model.ts`(티어) · `classify.ts`(스캔) · `reference.ts`(비교군) · `prompt.ts`(프롬프트) · `benchmark.ts` · `json.ts` · `usage.ts`. 진입점은 `app/actions/analyze.ts`의 `runAnalysis()` 하나.

## 2. 분석 방식 2가지

| 방식 | 함수 | 설명 |
|------|------|------|
| 파일 업로드 | `analyzeDocumentDirect` | PDF/이미지/DOCX/PPTX/XLSX를 Supabase에 업로드 후 Claude에 전달 |
| URL 분석 | `analyzeUrlDirect` | 웹페이지 URL을 크롤링하여 텍스트 추출 후 Claude에 전달 |
| 텍스트 모드 | `analyzeUrlDirect` (extractedText) | 100MB+ 파일에서 클라이언트가 추출한 텍스트를 직접 전달 |

두 함수는 거의 동일한 시스템 프롬프트, 통계 계산, 랭킹 계산, JSON 파싱 로직을 갖고 있음 (리팩토링 필요).

## 3. 파일 크기별 처리 흐름

```
파일 선택
  │
  ├─ 100MB 이상: 텍스트 추출 모드 (이미지 평가 불가)
  │   └─ extractTextFromPdf() → 최대 300페이지, 30만 자 조기 종료 / 40만 자 상한
  │       └─ analyzeUrlDirect({ extractedText }) → Claude 텍스트 분석
  │
  ├─ 30~100MB: 클라이언트 압축 시도 (3분 타임아웃)
  │   ├─ 성공: 압축된 파일로 일반 분석
  │   └─ 실패: 텍스트 추출 모드로 전환
  │
  └─ 30MB 이하: 일반 분석
      └─ Storage 업로드 → analyzeDocumentDirect()
           ├─ ① Files API 업로드 → document(file_id)로 모델에 원본 전달  ← 기본 경로 (2026-10)
           ├─ ② Files API 실패 & ≤20MB: base64 인라인
           └─ ③ 그 외: 추출 텍스트 폴백 (readability/layout 평가 제외)
           분석 후 Files API 파일 + Storage 파일 삭제
```

> 2026-10 이전에는 서버에서 10MB를 넘으면 무조건 텍스트 폴백(10만 자 절삭)이라 도식·레이아웃이 빠졌다. Files API는 요청 본문 32MB 제한과 무관하고, 신모델은 1M 컨텍스트라 수백 페이지 PDF도 원본으로 평가한다. API가 페이지 수(600p) 등으로 거부하면 ③으로 자동 전환.

### 3.1 클라이언트 PDF 압축 (`lib/pdf-compress.ts`)
- pdfjs-dist로 각 페이지를 150dpi로 렌더링
- JPEG 65% 품질로 변환
- jsPDF로 새 PDF 생성
- 최대 200페이지, 3분 타임아웃

### 3.2 클라이언트 텍스트 추출 (`lib/pdf-extract.ts`)
- pdfjs-dist로 각 페이지 텍스트 추출
- 최대 200페이지
- 80,000자 도달 시 조기 종료
- 100,000자 초과 시 잘라냄
- 타임아웃 없음 (대용량 파일 대응)

## 4. 서버 파일 업로드

### 4.1 허용 파일 타입
PDF, JPEG, PNG, WebP, DOCX, PPTX, XLSX, XLS, PPT, TXT

### 4.2 업로드 흐름 (`uploadFileToStorage`)
```
1. 인증 확인 (getUser)
2. 파일 타입 검증
3. 파일 크기 체크 (최대 200MB, 30MB 이하 권장)
4. UUID 파일명 생성 → uploads/{uuid}.{ext}
5. Supabase Storage "resumes" 버킷에 업로드
6. Public URL 반환
```

## 5. AI 분석 프롬프트

### 5.1 Claude 모델 — 분석 티어 (2026-10-06~)
| 티어 | 모델 (기본값) | effort | 크레딧 | 환경변수 덮어쓰기 |
|------|------|------|------|------|
| 기본 분석 `basic` | claude-sonnet-5-5 | medium | 1 | `ANALYSIS_MODEL_BASIC` |
| 정밀 분석 `precision` | claude-opus-5-5 | high | 2 | `ANALYSIS_MODEL_PRECISION` |
| 1단계 스캔 | claude-haiku-4-5 | – | 0 | `ANALYSIS_MODEL_CLASSIFIER` |

- 사용자가 분석 설정 모달에서 티어를 고른다. 크레딧 사용자는 보유량이 비용 이상일 때만 정밀 선택 가능 (서버도 `guardAnalysisEntry(creditCost)`로 검증)
- 신모델에서는 `temperature`를 보내지 않는다 (400). `output_config.effort`는 effort를 지원하는 모델에만 전달
- 플랜(구독)별 모델 분기는 폐지. 2026-05-06의 "Opus 폭주 적자" 문제는 **정밀 분석을 2크레딧으로 과금**해 해결

### 5.1.1 직군별 채점표 (`lib/analysis/domains.ts`)
8개 직군: 레벨 디자인 / 전투·AI / 시스템 기획 / 경제·BM / UI/UX / 캐릭터·서사 / 데이터 테이블 / 종합 기획.
기본 역량 5개는 모든 직군에서 핵심. 게임 디자인 10개는 직군별로 핵심/관련/해당 없음.
예: 레벨 디자인 → 재화흐름·동기부여·화면조작 해당 없음 / 캐릭터·서사 → 핵심반복구조·재화흐름·기능연결·난이도균형·화면조작·개발일정 해당 없음.
프롬프트에는 채점표 + "이 직군에서 특히 볼 것" 5개 + "요구하면 안 되는 것"(직군별 + 공통: A/B 테스트 결과·엔진 구현 가능성·개발 비용·라이브 KPI)이 들어간다.

### 5.1.2 프롬프트 구조 (`lib/analysis/prompt.ts`)
| 블록 | 내용 | 캐시 |
|------|------|------|
| 1 CORE | 역할, 절대 규칙, 15개 카테고리 정의, 점수 규칙, 응답 JSON 형식 (pdf/text/url 모드별 고정) | ✅ |
| 2 BENCHMARK | 회사별 벤치마크 (`data/company-benchmarks.json`) | ✅ |
| 3 DOMAIN | 직군 채점표 + 금지 목록 + 같은 직군 합격 사례 (직군별 고정, 셔플 없음) | ✅ |
| 4 VOLATILE | 사용자 키워드, 벡터 검색 발췌, 라이브러리 인용 | ✗ |

응답의 각 카테고리에 `applicable: true|false`가 추가됐고 해당 없음은 `value: null`. 서버는 모델 응답과 무관하게 채점표대로 다시 정규화한다.

### 5.2 평가 카테고리 (15개)

**기본 5개:**
1. 논리력 (logic) - 문제 정의 → 해결의 논리 흐름
2. 구체성 (specificity) - 수치, KPI, 구체적 사례
3. 가독성 (readability) - 문서 구조, 시각 정리
4. 기술이해 (technical) - 게임 개발 기술/용어
5. 창의성 (creativity) - 독창적 아이디어

**게임디자인 10개:**
6. 핵심 메카닉 설계 (core_mechanic)
7. 밸런스/이코노미 (balance_economy)
8. 레벨/맵 디자인 (level_design)
9. UX/UI 설계 (ux_ui)
10. 시스템 기획 (system_design)
11. 콘텐츠 기획 (content_design)
12. 내러티브 기획 (narrative)
13. 수익화 설계 (monetization)
14. 데이터 분석 (data_analysis)
15. 라이브 운영 (live_ops)

### 5.3 가독성 세부 평가 (PDF 이미지 분석 시)
10개 항목: 시각 위계, 정보 밀도, 색상/대비, 타이포그래피, 그리드/정렬, 다이어그램, 데이터 시각화, 여백, 시선 흐름, 아이콘/그래픽

### 5.4 레이아웃 개선 제안 (PDF 이미지 분석 시)
현재 레이아웃 vs 개선 후 레이아웃을 좌표 기반 JSON으로 출력

### 5.5 회사별 비교 피드백
고정 8개 회사: 넥슨, 엔씨소프트, 넷마블, 크래프톤, 스마일게이트, 펄어비스, 네오위즈, 웹젠

## 6. 학습 데이터 활용

### 6.1 비교군 선택 (`lib/analysis/reference.ts`)
1. `portfolios` 전체 로드 (187건, `design_domain` 컬럼 포함 — 없으면 컬럼 없이 재조회)
2. 각 행의 직군 = `design_domain` 값, NULL이면 파일명·태그·요약 휴리스틱(`classifyHeuristically`)으로 추정
3. 사용자 문서 직군과 같은 행만 선택 (`general`이면 전체). **5건 미만이면 `insufficient = true`** → 종합 문서로만 보충하고 프롬프트·결과 UI에 표본 부족을 명시
4. 회사별 균형 샘플링 최대 16건, 정렬은 점수 내림차순 → 파일명 (결정적)
5. 합격작 약점 문장 중 직군 무관·상투 문구(A/B 테스트, 엔진 구현, 최적화, 비UI 문서의 UI 요구 등)는 주입 전 제거 — DB 정제 전 안전장치

### 6.2 시스템 프롬프트에 주입되는 데이터
- 같은 직군 합격 표본 수, 회사별 표본 수, 직군 공통 키워드 15개
- 합격 사례 최대 16건: 강점 3 + (필터된) 약점 2 + 요약, 직군·회사 표기
- 벤치마크 (블록 2), 벡터 검색 유사 발췌 15청크, 라이브러리 원칙·패턴 6청크 (블록 4)
- 점수 분포는 주입하지 않음 (합격자 = 100점 기준선 유지)

### 6.3 랭킹 계산
```
풀 = 같은 직군 합격작 (5건 이상일 때) / 아니면 전체
total = 풀 크기 (고정 187 아님)
백분위 = (풀에서 나보다 낮은 점수 비율) * 100
순위 = total - round(백분위/100 * total), 1 ≤ 순위 ≤ total
```
결과에 `comparisonPool { sameDomainCount, total, insufficient }`가 포함되어 UI가 "같은 직군 합격작 N건과 비교"를 표시한다.

### 6.4 합격 DB 재구축 — 기준 카드 (2026-10-06)
Gemini 약점 문장을 정제하는 대신 **비교 재료 자체를 교체**했다 (`AUDIT_학습DB_정제_2026-10-06.md`는 폐기된 접근으로 보관).
- 원본 187건(Dropbox) → 원문 텍스트 추출 → 작성자 이름·이메일·전화번호 제거 → `portfolios.content_text` → 원문 기준 재임베딩
- 문서마다 **기준 카드**(`standard_card`): 구조, 산출물, 깊이 지표, 합격 수준인 이유, 표준 요소. **약점은 뽑지 않는다**
- 프롬프트에는 카드 + 직군 공통 요소표(N/M건) + 원문 발췌만. 합격작은 `anon_label`(구조 설명)로만 지칭 — 파일명·게임명·작성자명 금지
- 응답에 `standardsCheck`(요소별 있음/부분/없음 + 근거)와 `nextSteps` 추가 → `components/standards-check.tsx`
- 회사별 피드백은 마케팅용 보조 정보로 축소 (회사당 1~2문장)
- 규약·진행 현황: `data/standards/README.md`, 목표 출력 예시: `data/standards/EXAMPLE_feedback_*.md`
- 반영 절차: `scripts/021_add_standard_cards.sql` → `node --env-file=.env.local scripts/seed-standards.mjs --apply` → `DELETE FROM portfolio_chunks` → 관리자 임베딩(force)

### 6.5 점수 보정 + 고유명 차단 (2026-10-07)
- **점수 보정**: 합격 문서를 자기 자신 빼고 넣어도 52~69점이 나오던 문제. `buildChecklist`가 같은 직군 카드의 깊이 지표(수치 표·도식·분석 레퍼런스·의도→결정) 사분위를 계산해 "점수 보정 기준" 블록을 프롬프트에 넣는다 — 합격 하위 25% 수준 78~84 / 중앙값 85~90 / 상위 25% 91+ / 절반 이하 60~77 / 초안 60 미만. 점수 구간표(prompt.ts)도 같은 경계로 맞춤
- 공통 요소표는 **주 직군 카드만** 사용 (보조 직군 섞임 방지), 35% 이상 등장 요소 상위 10개
- **고유명 차단 2겹** (`lib/analysis/anonymize.ts`, 금지어 원본 `data/standards/banned-terms.json`):
  1. `maskForPrompt` — 원문 발췌를 프롬프트에 넣기 전 금지어를 `[고유명]`으로 가림
  2. `scrubOutput` — 모델 응답 JSON의 모든 문자열에서 금지어를 "한 합격 문서"로 치환
  - 사용자 자기 문서에 있는 단어는 건드리지 않음. 비교는 **공백 무시** (PDF 추출 텍스트는 띄어쓰기가 원본과 달라 자기 문서 이름을 잘못 지우던 문제 수정)
  - 금지어 목록에 없는 새 고유명은 막지 못한다 → 새 합격 문서 추가 시 `validate-cards.mjs`와 함께 목록 갱신

## 7. URL 분석 흐름

```
1. SSRF 검증 (내부 네트워크 URL 차단)
2. 직접 fetch로 HTML 가져오기 (15초 타임아웃)
3. HTML에서 텍스트 추출 (script/style 태그 제거)
4. 텍스트 1000자 미만이면 SPA 의심 → Jina AI Reader 폴백
5. 추출된 텍스트 50,000자로 잘라냄
6. Claude에 텍스트로 전달
```

## 8. 분석 결과 구조 (AnalysisResult)

```typescript
{
  fileName: string
  score: number               // 종합 점수 (0-100)
  categories: {               // 15개 카테고리
    subject: string
    value: number
    fullMark: number
    feedback?: string
  }[]
  strengths: string[]          // 강점 6개
  weaknesses: string[]         // 보완점 6개
  detailedFeedback?: string    // AI 상세 피드백
  companyFeedback?: string     // 회사별 비교 텍스트
  analysisSource?: "pdf" | "url"
  readabilityCategories?: {...}[]     // 가독성 10개 (이미지 분석 시)
  layoutRecommendations?: {...}[]     // 레이아웃 제안 (이미지 분석 시)
  ranking?: {
    total: number
    percentile: number
    rank?: number
    companyComparison?: { company, avgScore, userScore, sampleCount }[]
  }
}
```

## 9. 분석 결과 저장

`saveAnalysisHistory`로 Supabase `analysis_history` 테이블에 저장.
categories는 JSON 배열 → 카테고리 수 변경해도 스키마 수정 불필요.

## 10. UI 흐름 (`components/analyze-dashboard.tsx`)

### 10.1 페이지 진입
```
1. checkBeforeAnalysis() → 로그인/구독 상태 확인
2. getProjects() → 프로젝트 목록 로드
3. 비로그인이면 분석 UI는 보여주되, 분석 시 로그인 유도
```

### 10.2 파일 업로드 → 분석 시작
```
1. 파일 드롭/선택 → FileStatus 생성
2. 프로젝트 선택 확인 (없으면 "기본 프로젝트" 자동 생성)
3. 구독 상태 재확인
4. 파일 크기별 분기 처리 (위 3번 참조)
5. 분석 중: 시간 기반 가짜 진행률 (0→90% 60초) + 로딩 메시지 순환
6. 완료: 100%로 점프 + 결과 표시
```

### 10.3 결과 표시
- 종합 점수 + 등급 (S/A/B/C/D)
- 레이더 차트 2탭 (기본 5개 / 게임디자인 10개)
- 강점/보완점 카드
- 회사별 비교 피드백
- 가독성 점수 레이더 (이미지 분석 시)
- 레이아웃 개선 제안 (이미지 분석 시)
- 합격자 비교 랭킹

## 11. 관련 파일

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `app/actions/analyze.ts` | ~1128 | 서버 액션: 업로드, 분석, URL 크롤링 |
| `components/analyze-dashboard.tsx` | ~1387 | 메인 분석 UI (업로드+결과) |
| `lib/pdf-compress.ts` | ~75 | 클라이언트 PDF 압축 |
| `lib/pdf-extract.ts` | ~41 | 클라이언트 텍스트 추출 |
| `lib/excel-parser.ts` | ~49 | Excel/CSV → 텍스트 변환 |
| `components/score-card.tsx` | - | 점수 카드 |
| `components/radar-chart-component.tsx` | - | 레이더 차트 |
| `components/feedback-cards.tsx` | - | 강점/보완점 카드 |
| `components/design-scores.tsx` | - | 게임디자인 점수 |
| `components/readability-scores.tsx` | - | 가독성 점수 |
| `components/layout-recommendations.tsx` | - | 레이아웃 제안 |

## 12. 환경변수

| 변수명 | 용도 |
|--------|------|
| `ANTHROPIC_API_KEY` | Claude API 인증 |
| `JINA_API_KEY` | Jina AI Reader (SPA 폴백) |

## 13. 알려진 이슈

| 항목 | 설명 |
|------|------|
| ~~analyzeUrlDirect/analyzeDocumentDirect 중복~~ | 2026-10-06 해결 — `runAnalysis()` 하나로 통합 |
| 100MB+ 이미지 평가 불가 | 클라이언트가 100MB 이상을 텍스트 모드로 보내는 분기는 아직 남아 있음. Files API는 500MB까지 받으므로 클라이언트 분기 상향 검토 (단, 600페이지 API 제한) |
| 학습 DB 노이즈 | 합격작 약점 문장의 직군 불일치·상투 문구 — 정제 전까지 `filterNoiseWeaknesses`로 임시 차단 |
| 무료 진단(라이트) 미구현 | 무료 체험을 전체 리포트 대신 "직군 판별 + 총점 + 핵심 문제 3개"로 줄이는 안은 보류 중 (`TASK_서비스개선_2026-10.md` 5장) |
| Vercel 타임아웃 | Hobby 플랜 60초 제한, maxDuration=300 설정했지만 Pro 필요 |
| 가짜 진행률 | 실제 진행 상태가 아닌 시간 기반 → 서버 진행 상태 전달 개선 필요 |


### 2026-10-07 분석 설정 창 · 텍스트 추출
- 분석 설정 창의 "문서 분야": AI가 직군 3개를 미리 선택 (첫 번째 = 주 직군 → `domain`, 나머지 → `secondaryDomains`). 칩을 누르면 빠지고(최소 1개), 새 칩은 3개까지 · 이미 3개면 마지막과 교체. 사용자가 적은 주제는 AI 키워드 앞에 붙여 `keywords`로 전달
- 브라우저 텍스트 추출의 pdf.js 워커는 같은 출처(`/pdf.worker.min.mjs`)에서 받는다 — CSP가 외부 CDN을 막음

### 2026-10-07 지원 회사 · 문서 묶음
- 분석 옵션 `targetCompany` (lib/analysis/companies.ts `TARGET_COMPANIES`): 프롬프트 요청별 블록에 지원 회사 섹션 추가. 결과 `targetCompany`, 이력은 `ranking.targetCompany`에 저장. UI `components/company-feedback.tsx`
- 분석 이력 `document_name` (scripts/022): 프로젝트 안 문서 묶음. `/analyze?projectId=&doc=`로 들어오면 그 문서의 새 버전으로 저장. 서버 액션 `assignAnalysisToProject(id, projectId, documentName)`, `setAnalysisDocument`, `renameDocument`
