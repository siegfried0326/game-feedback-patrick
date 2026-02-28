# 디자이닛(DesignIt) 시스템 아키텍처

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 16 (App Router), React 19, TailwindCSS |
| 차트 | recharts |
| 백엔드 | Next.js Server Actions (`app/actions/`) |
| DB / Auth / Storage | Supabase |
| AI (사용자 분석) | Anthropic Claude API (Sonnet / Opus) |
| AI (학습 데이터) | Google Gemini 2.0 Flash |
| 결제 | TossPayments |
| PDF 처리 | pdfjs-dist (읽기), jsPDF (쓰기) |
| 배포 | Vercel (git push 자동) |
| 저장소 | siegfried0326/game-feedback-patrick |

## 디렉토리 구조

```
game-feedback-landing-page/
├── app/
│   ├── layout.tsx              # 루트 레이아웃 (메타데이터, 폰트)
│   ├── page.tsx                # 랜딩 페이지
│   ├── analyze/page.tsx        # 분석 페이지 (maxDuration=300)
│   ├── mypage/page.tsx         # 마이페이지 (~987줄)
│   ├── login/page.tsx          # 로그인 페이지
│   ├── admin/                  # 관리자 페이지
│   │   ├── page.tsx            # 메인 대시보드
│   │   ├── training/page.tsx   # 학습 데이터 관리 (~823줄)
│   │   └── data/page.tsx       # → training 리다이렉트
│   ├── auth/callback/route.ts  # OAuth 콜백
│   ├── actions/                # Server Actions
│   │   ├── analyze.ts          # AI 분석 (~1128줄)
│   │   ├── auth.ts             # 인증 (getUser, signOut, ensureSubscription)
│   │   ├── payment.ts          # TossPayments API (~228줄)
│   │   ├── subscription.ts     # 구독/프로젝트/이력 (~369줄)
│   │   ├── tutoring.ts         # 컨설팅 결제 (~108줄)
│   │   └── admin.ts            # 관리자 기능 (~694줄)
│   ├── terms/page.tsx          # 이용약관
│   ├── refund-policy/page.tsx  # 환불정책
│   ├── pricing/page.tsx        # 가격 페이지
│   └── tutoring/page.tsx       # 컨설팅 페이지
├── components/
│   ├── analyze-dashboard.tsx   # 분석 대시보드 (~1387줄)
│   ├── version-comparison.tsx  # 버전 비교 (~250줄)
│   ├── hero-section.tsx        # 랜딩 히어로
│   ├── pricing-modal.tsx       # 요금제 모달
│   ├── pricing-section.tsx     # 랜딩 가격표
│   ├── header.tsx              # 메인 헤더
│   ├── auth-header.tsx         # 인증 정보 주입
│   ├── score-card.tsx          # 점수 카드
│   ├── radar-chart-component.tsx # 레이더 차트
│   ├── feedback-cards.tsx      # 강점/보완점
│   ├── design-scores.tsx       # 게임디자인 점수
│   ├── readability-scores.tsx  # 가독성 점수
│   ├── layout-recommendations.tsx # 레이아웃 제안
│   └── ui/                     # shadcn/ui 기본 컴포넌트
├── lib/
│   ├── pdf-compress.ts         # 클라이언트 PDF 압축 (~75줄)
│   ├── pdf-extract.ts          # 클라이언트 텍스트 추출 (~41줄)
│   ├── excel-parser.ts         # Excel/CSV 파싱 (~49줄)
│   ├── company-parser.ts       # 파일명 → 회사명 추출 (~220줄)
│   ├── admin.ts                # isAdminEmail() (~6줄)
│   ├── utils.ts                # cn() 유틸리티 (~6줄)
│   └── supabase/
│       ├── client.ts           # 브라우저용 클라이언트
│       ├── server.ts           # 서버용 클라이언트
│       ├── types.ts            # TypeScript 타입
│       └── portfolios.ts       # 포트폴리오 CRUD 유틸
├── middleware.ts               # 세션 갱신 + 라우트 보호 (~84줄)
├── docs/                       # 문서
└── public/                     # 정적 파일
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
                                              ├─ 시스템 프롬프트 구성 (통계 + 샘플)
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
    ├─ portfolios 테이블에 저장
    └─ Storage 원본 삭제
```

### 인증 흐름
```
[소셜 로그인] → Supabase OAuth → /auth/callback → ensureSubscription → 리다이렉트
[이메일 로그인] → signInWithPassword → 페이지 이동
[세션 갱신] → 미들웨어에서 매 요청마다 getUser()
```

### 결제 흐름
```
[구독] 카드 등록 → authKey → issueBillingKey → approveBillingPayment → DB upsert
[컨설팅] createOrder → TossPayments 일반결제 → confirmPayment → DB 업데이트 + 구독 부여
```

## DB 테이블 관계

```
auth.users (Supabase 내장)
    │
    ├──→ users_subscription (1:1, user_id FK)
    ├──→ projects (1:N, user_id FK)
    │       └──→ analysis_history (1:N, project_id FK)
    ├──→ tutoring_orders (1:N, user_id FK)
    └──→ (portfolios는 user 연관 없음 - 관리자가 관리)
```

## 환경변수 전체 목록

| 변수명 | 서버/클라 | 용도 |
|--------|-----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 클라이언트 | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 | Supabase anon 키 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 클라이언트 | TossPayments 클라이언트 키 |
| `ANTHROPIC_API_KEY` | 서버 | Claude API |
| `GOOGLE_GENERATIVE_AI_API_KEY` | 서버 | Gemini API |
| `TOSS_SECRET_KEY` | 서버 | TossPayments 시크릿 키 |
| `JINA_API_KEY` | 서버 | Jina AI Reader |
| `ADMIN_EMAILS` | 서버 | 관리자 이메일 |
| `GAMECANVAS_DISCOUNT_CODES` | 서버 | 할인 코드 |

## 파일 크기 TOP 5

| 파일 | 줄 수 | 리팩토링 필요성 |
|------|-------|---------------|
| `components/analyze-dashboard.tsx` | ~1387 | 높음 - 컴포넌트 분리 필요 |
| `app/actions/analyze.ts` | ~1128 | 높음 - 두 함수 중복 |
| `app/mypage/page.tsx` | ~987 | 중간 - 탭별 분리 |
| `app/admin/training/page.tsx` | ~823 | 중간 |
| `app/actions/admin.ts` | ~694 | 낮음 |
