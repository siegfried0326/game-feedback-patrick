# CLAUDE.md — 디자이닛(DesignIt) 프로젝트 컨텍스트

## 프로젝트 개요
11년차 현업 게임 기획자가 만든 **게임 기획 포트폴리오 AI 피드백 서비스**.
취준생(게임 기획 지망생)이 자신의 포트폴리오(PDF/URL)를 업로드하면, 강사가 수집한 **187개 실제 합격 포트폴리오** 데이터를 기반으로 Claude AI가 객관적인 컨설팅을 제공한다.

### 핵심 차별점
- ChatGPT/Gemini는 교과서적 조언만 → 디자이닛은 **실제 합격 데이터 기반** 피드백
- 187명 합격자 대비 **랭킹/백분위** 제공
- 8개 주요 게임사(넥슨, NC, 넷마블, 크래프톤, 스마일게이트, 펄어비스, 네오위즈, 웹젠) 기준 비교
- 15개 카테고리(기본 5 + 게임디자인 10) 심층 분석
- 문서에 없는 내용은 절대 칭찬하지 않음 (환각 방지)

## 기술 스택
- **프론트**: Next.js 16 (App Router), React 19, TailwindCSS, shadcn/ui
- **백엔드**: Next.js Server Actions (`app/actions/`)
- **DB/Auth**: Supabase (PostgreSQL + pgvector)
- **AI**: Claude API (사용자 분석), Gemini 2.0 Flash (학습 데이터), OpenAI embeddings (벡터 검색)
- **결제**: TossPayments (일반결제 + 빌링키 자동결제)
- **배포**: Vercel (maxDuration=300, git push 자동 배포)

## 핵심 규칙

### 빌드 & 배포
- Vercel에서 빌드됨 — **반드시 `npx next build`로 로컬 빌드 확인 후 커밋**
- maxDuration=300 (5분) — 모든 서버 액션은 5분 내 완료되어야 함
- TypeScript strict mode — any 타입 최소화

### 코드 규칙
- Server Actions 패턴: `app/actions/*.ts`에서 `"use server"` 선언 후 `getUser()` 인증 체크
- 관리자 체크: `lib/admin.ts`의 `isAdminEmail()` 사용
- UI 컴포넌트: `components/ui/`는 shadcn/ui 기본, 커스텀은 `components/` 루트
- DB 클라이언트: 서버에서 `lib/supabase/server.ts`, 클라이언트에서 `lib/supabase/client.ts`

### 파일 구조
```
app/actions/analyze.ts    — AI 분석 (Claude API, ~1128줄)
app/actions/admin.ts      — 관리자 기능 (학습 데이터 + 공통점 추출, ~1345줄)
app/actions/payment.ts    — TossPayments 결제
app/actions/subscription.ts — 구독/프로젝트/이력 CRUD
components/analyze-dashboard.tsx — 분석 결과 대시보드 (~1387줄)
```

### DB 주요 테이블
- `users_subscription` — 구독 정보 (plan: free/monthly/three_month, status, billing_key, expires_at)
- `projects` / `analysis_history` — 프로젝트 + 분석 결과
- `portfolios` — 학습용 포트폴리오 데이터 (관리자 관리)
- `portfolio_chunks` — 포트폴리오 텍스트 청크 + vector(1536) 임베딩
- `success_patterns` — 합격자 공통점 50가지

### 알려진 기술 부채
- analyze.ts의 analyzeUrlDirect/analyzeDocumentDirect 중복 로직
- analyze-dashboard.tsx 1387줄 — 컴포넌트 분리 필요
- 테스트 코드 0개
- expired 구독 자동 처리 cron 미구현

## 최근 작업 (2026-03-04)
- 합격자 공통점 추출: 단일 호출 → 배치 분할 방식으로 변경 (45개씩 N배치 → 통합)
- ARCHITECTURE.md 전면 업데이트

## 커밋 컨벤션
- 한글 커밋 메시지 사용
- prefix: fix, feat, perf, docs, refactor
- 예: `fix: 공통점 100개→50개 축소 + 잘린 JSON 복구 로직 추가`
