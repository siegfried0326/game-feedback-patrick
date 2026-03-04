# 디자이닛(DesignIt) 시스템 아키텍처

> 마지막 갱신: 2026-03-04

## 서비스 개요

11년차 현업 게임 기획자가 만든 **게임 기획 포트폴리오 AI 피드백 서비스**.
취준생(게임 기획 지망생)이 포트폴리오를 업로드하면, 강사가 수집한 **187개 실제 합격 포트폴리오** 데이터를 기반으로 Claude AI가 객관적인 피드백을 제공한다.

- 187명 합격자 대비 랭킹/백분위 산출
- 8개 주요 게임사(넥슨, NC, 넷마블, 크래프톤, 스마일게이트, 펄어비스, 네오위즈, 웹젠) 기준 비교
- 15개 카테고리 심층 분석 (기본 5: 논리력, 구체성, 가독성, 기술이해, 창의성 + 게임디자인 10: 코어메카닉, 밸런스/경제, 레벨/맵, UX/UI, 시스템기획, 콘텐츠기획, 내러티브, 수익화, 데이터분석, 라이브운영)
- 문서에 없는 내용은 절대 칭찬하지 않음 (ChatGPT/Gemini 대비 차별점)

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 16 (App Router), React 19, TailwindCSS |
| UI 컴포넌트 | shadcn/ui, recharts (차트) |
| 백엔드 | Next.js Server Actions (`app/actions/`) |
| DB / Auth / Storage | Supabase (PostgreSQL + pgvector) |
| AI (사용자 분석) | Anthropic Claude API (Sonnet / Opus) |
| AI (학습 데이터) | Google Gemini 2.0 Flash |
| AI (벡터 임베딩) | OpenAI text-embedding-3-small (1536차원) |
| 결제 | TossPayments (일반결제 + 빌링키 자동결제) |
| PDF 처리 | pdfjs-dist (읽기), jsPDF (쓰기) |
| 배포 | Vercel (git push 자동, maxDuration=300) |
| 저장소 | siegfried0326/game-feedback-patrick |

## 디렉토리 구조

```
game-feedback-landing-page/
├── app/
│   ├── layout.tsx                    # 루트 레이아웃 (메타데이터, 폰트)
│   ├── page.tsx                      # 랜딩 페이지
│   ├── analyze/page.tsx              # 분석 페이지 (maxDuration=300)
│   ├── mypage/page.tsx               # 마이페이지 (~987줄)
│   ├── login/page.tsx                # 로그인 페이지
│   ├── pricing/page.tsx              # 가격 페이지
│   ├── sample-portfolio/page.tsx     # 샘플 포트폴리오
│   ├── terms/page.tsx                # 이용약관
│   ├── refund-policy/page.tsx        # 환불정책
│   ├── admin/                        # 관리자 페이지
│   │   ├── page.tsx                  # 메인 대시보드
│   │   ├── training/page.tsx         # 학습 데이터 관리 (~823줄)
│   │   ├── data/page.tsx             # → training 리다이렉트
│   │   └── success-patterns/page.tsx # 합격자 공통점 50가지
│   ├── auth/callback/route.ts        # OAuth 콜백
│   ├── payment/                      # 결제 페이지
│   │   ├── billing/page.tsx          # 구독 결제 (빌링키)
│   │   ├── billing/success/page.tsx  # 구독 결제 성공
│   │   ├── billing/fail/page.tsx     # 구독 결제 실패
│   │   ├── credits/page.tsx          # 크레딧 결제
│   │   └── credits/success/page.tsx  # 크레딧 결제 성공
│   ├── actions/                      # Server Actions
│   │   ├── analyze.ts                # AI 분석 (~1128줄)
│   │   ├── auth.ts                   # 인증 (getUser, signOut, ensureSubscription)
│   │   ├── payment.ts                # TossPayments API (~228줄)
│   │   ├── subscription.ts           # 구독/프로젝트/이력 (~369줄)
│   │   └── admin.ts                  # 관리자 기능 (~1345줄)
│   └── api/
│       ├── admin/embed/route.ts      # 벡터 임베딩 API (maxDuration=60)
│       └── test-connection/route.ts  # Supabase 연결 테스트
├── components/
│   ├── analyze-dashboard.tsx         # 분석 대시보드 (~1387줄)
│   ├── version-comparison.tsx        # 버전 비교 (~250줄)
│   ├── hero-section.tsx              # 랜딩 히어로
│   ├── pricing-modal.tsx             # 요금제 모달
│   ├── pricing-section.tsx           # 랜딩 가격표
│   ├── header.tsx                    # 메인 헤더
│   ├── auth-header.tsx               # 인증 정보 주입
│   ├── score-card.tsx                # 점수 카드
│   ├── radar-chart-component.tsx     # 레이더 차트
│   ├── feedback-cards.tsx            # 강점/보완점
│   ├── design-scores.tsx             # 게임디자인 점수
│   ├── readability-scores.tsx        # 가독성 점수
│   ├── layout-recommendations.tsx    # 레이아웃 제안
│   └── ui/                           # shadcn/ui 기본 컴포넌트
├── lib/
│   ├── pdf-compress.ts               # 클라이언트 PDF 압축 (~75줄)
│   ├── pdf-extract.ts                # 클라이언트 텍스트 추출 (~41줄)
│   ├── excel-parser.ts               # Excel/CSV 파싱 (~49줄)
│   ├── company-parser.ts             # 파일명 → 회사명 추출 (~220줄)
│   ├── vector-search.ts              # 벡터 검색: 청킹, 임베딩 저장, 유사도 검색
│   ├── openai-embedding.ts           # OpenAI 임베딩 API 호출
│   ├── admin.ts                      # isAdminEmail() (~6줄)
│   ├── utils.ts                      # cn() 유틸리티 (~6줄)
│   └── supabase/
│       ├── client.ts                 # 브라우저용 클라이언트
│       ├── server.ts                 # 서버용 클라이언트
│       ├── types.ts                  # TypeScript 타입
│       └── portfolios.ts             # 포트폴리오 CRUD 유틸
├── scripts/                          # SQL 마이그레이션 스크립트
│   ├── 001_create_portfolios.sql     # portfolios 테이블 + 뷰
│   ├── 002_create_storage.sql        # Storage RLS 정책
│   ├── 011_add_vector_search.sql     # pgvector + portfolio_chunks
│   ├── 012_create_success_patterns.sql # success_patterns 테이블
│   └── 013_create_portfolio_analysis.sql # portfolio_analysis 테이블
├── middleware.ts                     # 세션 갱신 + 라우트 보호 (~84줄)
├── docs/                             # PRD + 아키텍처 문서
└── public/                           # 정적 파일
```

## 데이터 흐름

### 사용자 분석 흐름
```
[브라우저] 파일 선택
    │
    ├─ 100MB+: extractTextFromPdf() ──→ analyzeUrlDirect(extractedText)
    ├─ 30-100MB: compressPdf() ──→ uploadFileToStorage() ──→ analyzeDocumentDirect()
    └─ ~30MB: uploadFileToStorage() ──→ analyzeDocumentDirect()
                                              │
                                              ├─ portfolios에서 학습 데이터 로드 (TOP 50)
                                              ├─ portfolio_chunks 벡터 검색 (유사 포트폴리오)
                                              ├─ 시스템 프롬프트 구성 (통계 + 샘플 + 유사 콘텐츠)
                                              ├─ Claude API 호출
                                              ├─ JSON 파싱 + 랭킹 계산
                                              └─ saveAnalysisHistory() ──→ [Supabase DB]
```

### 학습 데이터 흐름
```
[관리자] 파일 업로드
    │
    ├─ Supabase Storage에 저장
    ├─ company-parser로 회사명 추출
    ├─ Gemini 2.0 Flash 분석
    ├─ portfolios 테이블에 저장 (점수, 태그, 요약 등)
    ├─ content_text 저장 (스프레드시트는 파싱 결과, PDF는 메타데이터)
    ├─ 텍스트 청킹 → OpenAI 임베딩 → portfolio_chunks 저장
    └─ Storage 원본 삭제
```

### 합격자 공통점 추출 흐름
```
[관리자] "공통점 새로 추출하기" 클릭
    │
    ├─ portfolio_chunks에서 전체 포트폴리오 텍스트 로드
    ├─ 45개씩 N배치로 분할 (포트폴리오당 1000자)
    ├─ 각 배치: Claude API 호출 → 15~25개 중간 패턴 추출
    ├─ 모든 중간 패턴 수집 (60~100개)
    ├─ Claude 통합 호출 → 중복 제거 + 빈도 기반 → 최종 50개
    └─ success_patterns 테이블에 저장
```

### 인증 흐름
```
[소셜 로그인] → Supabase OAuth → /auth/callback → ensureSubscription → 리다이렉트
[이메일 로그인] → signInWithPassword → 페이지 이동
[세션 갱신] → 미들웨어에서 매 요청마다 getUser()
```

### 결제 흐름
```
[크레딧] createCreditOrder → TossPayments 일반결제 → confirmCreditPayment → credits 증가
[구독] 카드 등록 → authKey → issueBillingKey → approveBillingPayment → DB upsert
```

## DB 테이블 관계

```
auth.users (Supabase 내장)
    │
    ├──→ users_subscription (1:1, user_id FK)
    │       ├─ plan: free/monthly/three_month
    │       ├─ status: active/cancelled/expired
    │       ├─ analysis_credits: 남은 크레딧
    │       └─ billing_key: TossPayments 빌링키
    │
    ├──→ projects (1:N, user_id FK)
    │       └──→ analysis_history (1:N, project_id FK)
    │               ├─ categories: jsonb (15개 카테고리 점수)
    │               ├─ ranking: jsonb (백분위, 순위)
    │               └─ company_feedback: text (8개 회사 피드백)
    │
    └──→ credit_orders (1:N, user_id FK)
            └─ 크레딧 결제 주문 이력

portfolios (user 연관 없음 — 관리자가 관리하는 학습 데이터)
    │
    ├──→ portfolio_chunks (1:N, portfolio_id FK)
    │       ├─ chunk_text: 800자 단위 텍스트 조각
    │       ├─ embedding: vector(1536) OpenAI 임베딩
    │       └─ metadata: jsonb (회사명, 파일명 등)
    │
    └──→ portfolio_analysis (1:1, portfolio_id FK)
            └─ Claude 15개 카테고리 심층 분석 결과

success_patterns (독립 테이블)
    ├─ category: "general" 또는 회사명
    ├─ title, description, importance
    ├─ example_files: 예시 파일명 배열
    └─ batch_id: 추출 세션 그룹
```

## 환경변수 전체 목록

| 변수명 | 서버/클라 | 용도 |
|--------|-----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 클라이언트 | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 | Supabase anon 키 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 클라이언트 | TossPayments 클라이언트 키 |
| `ANTHROPIC_API_KEY` | 서버 | Claude API (사용자 분석 + 공통점 추출) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | 서버 | Gemini API (학습 데이터 분석) |
| `OPENAI_API_KEY` | 서버 | OpenAI 임베딩 (벡터 서치) |
| `TOSS_SECRET_KEY` | 서버 | TossPayments 시크릿 키 |
| `JINA_API_KEY` | 서버 | Jina AI Reader (SPA 크롤링 폴백) |
| `ADMIN_EMAILS` | 서버 | 관리자 이메일 (쉼표 구분) |
| `GAMECANVAS_DISCOUNT_CODES` | 서버 | 할인 코드 (쉼표 구분) |

## Vercel 배포 설정

| 설정 | 값 | 적용 라우트 |
|------|-----|------------|
| maxDuration | 300초 (5분) | /analyze, /admin/*, /admin/success-patterns |
| maxDuration | 60초 | /api/admin/embed |
| Framework | Next.js | 자동 감지 |
| Build Command | `next build` | 기본값 |

## 파일 크기 TOP 5

| 파일 | 줄 수 | 리팩토링 필요성 |
|------|-------|---------------|
| `components/analyze-dashboard.tsx` | ~1387 | 높음 — 컴포넌트 분리 필요 |
| `app/actions/admin.ts` | ~1345 | 중간 — 공통점 추출 + 학습 데이터 관리 |
| `app/actions/analyze.ts` | ~1128 | 높음 — analyzeUrlDirect/analyzeDocumentDirect 중복 |
| `app/mypage/page.tsx` | ~987 | 중간 — 프로젝트/분석/구독 탭별 분리 |
| `app/admin/training/page.tsx` | ~823 | 중간 |
