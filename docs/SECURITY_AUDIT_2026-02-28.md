# 보안 점검 보고서 — 2026-02-28

## 1. 점검 범위

프로젝트 전체 (app/, lib/, components/, public/, middleware, next.config.mjs)

---

## 2. 발견된 문제 및 수정 현황

### 치명적 (CRITICAL) — 모두 수정 완료

| # | 문제 | 파일 | 수정 내용 |
|---|------|------|-----------|
| 1 | 분석 API 로그인 체크 없음 | `app/actions/analyze.ts` | `analyzeUrlDirect`, `analyzeDocumentDirect`에 `getUser()` 인증 추가 |
| 2 | 관리자 함수 9개 권한 체크 없음 | `app/actions/admin.ts` | `verifyAdmin()` 헬퍼 생성, 9개 함수에 관리자 이메일 확인 추가 |
| 3 | 컨설팅 결제 금액 클라이언트 신뢰 | `app/actions/tutoring.ts` | 서버에 `TUTORING_PRICES` 테이블 추가, `amount` 파라미터 제거 |
| 4 | 결제 헬퍼 함수 HTTP 엔드포인트 노출 | `app/actions/payment.ts` | `lib/toss-api.ts`로 분리 (비 "use server" 파일) |

### 높음 (HIGH) — 모두 수정 완료

| # | 문제 | 파일 | 수정 내용 |
|---|------|------|-----------|
| 5 | 보안 헤더 없음 (CSP, HSTS 등) | `next.config.mjs` | CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy 추가 |
| 6 | 오픈 리다이렉트 | `app/login/page.tsx`, `app/auth/callback/route.ts` | `sanitizeRedirect()` 함수로 내부 경로만 허용 (`/`로 시작 + `//` 차단) |
| 7 | SSRF 보호 미흡 | `app/actions/analyze.ts` | 클라우드 메타데이터 IP (169.254.x.x), IPv6 사설 범위, 프로토콜 제한 추가 |

### 중간 (MEDIUM) — 수정 완료

| # | 문제 | 파일 | 수정 내용 |
|---|------|------|-----------|
| 8 | 임의 파일 삭제 가능 | `app/actions/analyze.ts` | `deleteFileFromStorage`에 `uploads/` 경로 검증 추가 |
| 9 | body 크기 제한 과다 (1GB) | `next.config.mjs` | 500MB로 축소 (관리자 업로드 최대치에 맞춤) |

---

## 3. 수정된 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `app/actions/analyze.ts` | 로그인 체크 2곳, SSRF 강화, 파일 경로 검증 |
| `app/actions/admin.ts` | `verifyAdmin()` 헬퍼 + 9개 함수 관리자 체크 |
| `app/actions/tutoring.ts` | `TUTORING_PRICES` 서버 가격표, `amount` 파라미터 제거 |
| `app/actions/payment.ts` | 헬퍼 함수 4개 제거 → lib로 이동, import 추가 |
| `app/actions/subscription.ts` | import 경로 변경 (`./payment` → `@/lib/toss-api`) |
| `app/tutoring/page.tsx` | `createTutoringOrder` 호출에서 `amount` 제거, 서버 반환값 사용 |
| `app/login/page.tsx` | `sanitizeRedirect()` 오픈 리다이렉트 방지 |
| `app/auth/callback/route.ts` | `sanitizeRedirect()` 오픈 리다이렉트 방지 |
| `next.config.mjs` | 보안 헤더 7종 추가, body 크기 500MB로 조정 |
| `lib/toss-api.ts` | **신규** — TossPayments API 헬퍼 (비 엔드포인트) |

---

## 4. 잔여 이슈 (추후 개선)

| 이슈 | 우선도 | 설명 |
|------|--------|------|
| Rate Limiting 없음 | 중간 | 분석 API에 요청 제한 필요 (Vercel에서 제공 가능) |
| Supabase RLS 강화 필요 | 중간 | `portfolios` 테이블 INSERT/UPDATE 정책이 `with check (true)` → 관리자만 허용으로 변경 필요 (Supabase 대시보드) |
| console.log 프로덕션 노출 | 낮음 | admin.ts, analyze.ts의 디버그 로그 제거 또는 조건부 처리 |
| 입력값 길이 제한 없음 | 낮음 | URL, 파일명 등에 maxLength 검증 추가 가능 |

---

## 5. 보안 아키텍처 요약

```
클라이언트 → "use server" 함수 (HTTP 엔드포인트)
                ↓
            getUser() 인증 확인
                ↓
            (admin 함수) verifyAdmin() 관리자 확인
                ↓
            비즈니스 로직
                ↓
            Supabase RLS (DB 레벨 접근 제어)
```

### 결제 보안
- 구독 금액: `processSubscriptionPayment()` 내부에서 서버가 결정
- 컨설팅 금액: `TUTORING_PRICES` 서버 가격표에서 결정
- 결제 확인: DB에 저장된 금액과 대조 (`confirmTutoringPayment`)
- TossPayments API 호출: `lib/toss-api.ts` (HTTP 엔드포인트 아님)
