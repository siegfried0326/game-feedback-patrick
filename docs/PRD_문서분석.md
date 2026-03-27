# PRD: 문서 분석 시스템

## 1. 개요

| 항목 | 내용 |
|------|------|
| 서비스명 | 아카이브 187 (Archive187) |
| AI 엔진 | Anthropic Claude API (Sonnet/Opus) |
| 파일 처리 | 클라이언트 압축/텍스트추출 + 서버 업로드 + AI 분석 |
| 마지막 갱신 | 2026-02-27 |

게임 기획 포트폴리오를 AI로 분석하여 점수, 강점/보완점, 회사별 비교 피드백을 제공하는 핵심 기능.

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
  │   └─ extractTextFromPdf() → 최대 200페이지, 80000자 제한
  │       └─ analyzeUrlDirect({ extractedText }) → Claude 텍스트 분석
  │
  ├─ 30~100MB: 클라이언트 압축 시도 (3분 타임아웃)
  │   ├─ 성공: 압축된 파일로 일반 분석
  │   └─ 실패: 텍스트 추출 모드로 전환
  │
  └─ 30MB 이하: 일반 분석
      └─ uploadFileToStorage() → analyzeDocumentDirect() → Claude 이미지+텍스트 분석
```

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

### 5.1 Claude 모델 선택
| 구독 플랜 | 모델 |
|-----------|------|
| free, monthly | claude-sonnet-4-20250514 |
| three_month | claude-opus-4-20250514 |

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

### 6.1 포트폴리오 통계 로드
```sql
SELECT * FROM portfolios ORDER BY overall_score DESC LIMIT 50
```

### 6.2 시스템 프롬프트에 주입되는 데이터
- 전체 평균 점수 (6개 항목별)
- 회사별 평균 점수
- 태그 빈도 상위 15개
- 샘플 포트폴리오 12개 (회사별 균형 샘플링)
- 회사별 강점/약점 패턴

### 6.3 랭킹 계산
```
표시 기준: 187명 (고정)
백분위 = (나보다 낮은 점수 비율) * 100
순위 = 187 - (백분위/100 * 187), 최소 1
```

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
| analyzeUrlDirect/analyzeDocumentDirect 중복 | 두 함수의 프롬프트, 통계, 파싱 로직이 거의 동일 → 공통 함수 추출 필요 |
| 100MB+ 이미지 평가 불가 | 텍스트 추출 모드에서는 가독성/레이아웃 평가가 빠짐 |
| Vercel 타임아웃 | Hobby 플랜 60초 제한, maxDuration=300 설정했지만 Pro 필요 |
| 가짜 진행률 | 실제 진행 상태가 아닌 시간 기반 → 서버 진행 상태 전달 개선 필요 |
