# 디자이닛(DesignIt) 프로젝트 브리핑

> **새 대화를 시작할 때 이 문서를 가장 먼저 읽어주세요.**
> 마지막 갱신: 2026-03-06

---

## 1. 서비스 한 줄 요약

11년차 현업 게임 기획자(강사)가 만든 **게임 기획 포트폴리오 AI 피드백 서비스**.
취준생이 포트폴리오를 업로드하면, **187개 실제 합격 포트폴리오** 데이터를 기반으로 Claude AI가 점수/랭킹/피드백을 제공한다.

---

## 2. 기술 스택 요약

| 영역 | 기술 |
|------|------|
| 프론트/백 | Next.js 16 (App Router, Server Actions), React 19, TailwindCSS, shadcn/ui |
| DB/Auth | Supabase (PostgreSQL + pgvector) |
| AI | Claude (사용자 분석), Gemini Flash (학습 데이터), OpenAI embeddings (벡터 검색) |
| 결제 | TossPayments (일반결제 + 빌링키 자동결제 + 환불) |
| 배포 | Vercel (git push → 자동 배포, maxDuration=300) |

---

## 3. 핵심 파일 (코드)

| 파일 | 역할 | 줄 수 |
|------|------|-------|
| `app/actions/analyze.ts` | AI 분석 파이프라인 | ~1128 |
| `app/actions/admin.ts` | 관리자: 학습 데이터 + 공통점 추출 | ~1345 |
| `app/actions/payment.ts` | 결제/환불 서버 액션 | ~397 |
| `app/actions/subscription.ts` | 구독/크레딧/프로젝트 CRUD | ~369 |
| `app/mypage/page.tsx` | 마이페이지 (게이지, 환불, 프로젝트) | ~1187 |
| `components/analyze-dashboard.tsx` | 분석 결과 대시보드 | ~1387 |
| `lib/toss-api.ts` | TossPayments API 헬퍼 | ~147 |

---

## 4. 현재 상태 (2026-03-06)

### 완료된 주요 기능
- ✅ 15개 카테고리 AI 분석 + 187명 대비 랭킹/백분위
- ✅ 벡터 서치 기반 유사 합격 사례 비교
- ✅ 크레딧(회차권) + 구독 결제 시스템
- ✅ 크레딧 우선 소모 정책 (크레딧 > 구독 순서)
- ✅ 마이페이지 셀프 환불 (7일 이내, 토스 API 연동)
- ✅ 합격자 공통점 50가지 자동 추출 (배치 분할)
- ✅ 보안 감사 완료 (RLS, 헤더, SSRF 방어)

### 진행 중 / 대기
- ⏳ 학습데이터 관련 문제개선 (사용자 테스트 후 확정)
- ⏳ DB 마이그레이션 실행 (`scripts/014_add_refund_columns.sql`)
- ⏳ 구독 자동갱신 cron, 만료 자동 처리

### 기술 부채
- analyze.ts/analyze-dashboard.tsx 리팩토링 필요 (1000줄+)
- 테스트 코드 0개
- expired 구독 자동 처리 미구현

---

## 5. 문서 맵 (docs/ 폴더)

> 접두어 규칙: `PRD_` 기획서 | `ARCH_` 아키텍처 | `REF_` 참조 | `TASK_` 태스크 | `QA_` 테스트 | `AUDIT_` 감사 | `LOG_` 이력

### 아키텍처/참조 (전체 구조 파악)
| 문서 | 내용 |
|------|------|
| **`ARCH_시스템.md`** | 시스템 아키텍처 종합 (디렉토리, 데이터 흐름, DB 스키마, API, RLS, SQL 스크립트) |
| `REF_기능목록.md` | 주요 기능 현황 리스트 |
| `REF_운영비용.md` | 월 고정/종량 비용 |
| `REF_회사명추출규칙.md` | 파일명→회사명 추출 파서 규칙 |
| `REF_페이지라우트.md` | 전체 페이지 라우트 목록 |
| `REF_타임아웃설정.md` | Vercel maxDuration 설정 |

### 기획서 (PRD)
| 문서 | 내용 |
|------|------|
| `PRD_문서분석.md` | **핵심** — AI 분석 방식, 프롬프트, 15개 카테고리 |
| `PRD_결제_구독.md` | 크레딧/구독 결제 흐름 + 환불 |
| `PRD_가격표_요금제.md` | 가격 기준표 (변경 시 여기 먼저) |
| `PRD_인증_로그인.md` | 소셜/이메일 로그인, 미들웨어 |
| `PRD_마이페이지.md` | 마이페이지 인덱스 (→ 하위 3개 문서 참조) |
| `PRD_마이페이지_프로젝트.md` | 프로젝트 관리 |
| `PRD_마이페이지_분석이력.md` | 분석 이력/버전 비교 |
| `PRD_마이페이지_구독.md` | 구독 게이지 + 크레딧 환불 |
| `PRD_벡터서치.md` | 벡터 검색 아키텍처 |
| `PRD_학습데이터_업로드탭.md` | 관리자 업로드 |
| `PRD_학습데이터_데이터관리탭.md` | 관리자 데이터 관리 |

### 태스크/이력/QA
| 문서 | 내용 |
|------|------|
| `TASK_백로그.md` | 전체 백로그 + 기술 부채 |
| `TASK_결제개선.md` | 결제/환불 시스템 개선 태스크 (현재 진행) |
| `LOG_변경이력.md` | 날짜순 변경 이력 (2/14~3/6) |
| `QA_테스트케이스.md` | QA 테스트 체크리스트 100+항목 |
| `AUDIT_보안점검_2026-02-28.md` | 보안 감사 보고서 |

---

## 6. 핵심 규칙 (반드시 지켜야 할 것)

### 빌드
- **반드시 `npx next build`로 로컬 빌드 확인 후 커밋** (Vercel 자동 배포)
- TypeScript strict mode — any 최소화

### 코드
- Server Actions: `app/actions/*.ts`에서 `"use server"` 선언 + `getUser()` 인증 체크
- 관리자 체크: `lib/admin.ts`의 `isAdminEmail()`
- DB: 서버 `lib/supabase/server.ts`, 클라이언트 `lib/supabase/client.ts`

### 커밋
- 한글 커밋 메시지, prefix: fix/feat/perf/docs/refactor
- 예: `feat: 크레딧 셀프 환불 기능`

### 문서
- **⚠️ 코드 변경 시 관련 문서도 반드시 최신화** (PRD, TASK, CHANGELOG)
- 태스크 완료 시 `TASK_*.md` 업데이트 필수
- 가격 변경 시 `PRD_가격표_요금제.md` 먼저 수정

---

## 7. DB 주요 테이블

| 테이블 | 용도 |
|--------|------|
| `users_subscription` | 구독 + 크레딧 (plan, status, analysis_credits, billing_key) |
| `projects` | 사용자 프로젝트 폴더 |
| `analysis_history` | 분석 결과 (15개 카테고리 점수, 랭킹, 회사 피드백) |
| `credit_orders` | 크레딧 주문 (결제/환불 상태) |
| `portfolios` | 학습용 합격 포트폴리오 (관리자 관리) |
| `portfolio_chunks` | 벡터 임베딩 청크 (800자, vector(1536)) |
| `success_patterns` | 합격자 공통점 50가지 |

---

## 8. 환경변수

| 변수명 | 용도 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | Supabase 클라이언트 |
| `ANTHROPIC_API_KEY` | Claude API |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API |
| `OPENAI_API_KEY` | OpenAI 임베딩 |
| `TOSS_SECRET_KEY` / `NEXT_PUBLIC_TOSS_CLIENT_KEY` | TossPayments |
| `JINA_API_KEY` | URL 텍스트 추출 폴백 |
| `ADMIN_EMAILS` | 관리자 이메일 (쉼표 구분) |
| `GAMECANVAS_DISCOUNT_CODES` | 할인 코드 |

---

## 9. 새 대화 시작 시 권장 순서

1. **이 문서** (`docs/START_HERE.md`) — 전체 파악
2. **`CLAUDE.md`** (프로젝트 루트) — 코드 규칙, 기술 부채
3. **상황에 따라**:
   - 분석 기능 수정 → `PRD_문서분석.md` + `ARCH_시스템.md`
   - 결제/환불 수정 → `PRD_결제_구독.md` + `PRD_가격표_요금제.md`
   - 마이페이지 수정 → `PRD_마이페이지_구독.md`
   - 관리자 수정 → `PRD_학습데이터_업로드탭.md` + `PRD_학습데이터_데이터관리탭.md`
   - 백로그 확인 → `TASK_백로그.md`
   - 진행 중 작업 → `TASK_결제개선.md`
