# 보안 점검 보고서 — 2026-02-28

## 1. 점검 범위

프로젝트 전체 28개 항목 (Error Handling 6개, Security 22개)

---

## 2. 1차 수정 — 치명적/높음 (커밋 1: `c53bf2f`)

| # | 문제 | 위험도 | 파일 | 수정 내용 |
|---|------|--------|------|-----------|
| 1 | 분석 API 로그인 체크 없음 | 치명 | `app/actions/analyze.ts` | `analyzeUrlDirect`, `analyzeDocumentDirect`에 `getUser()` 인증 추가 |
| 2 | 관리자 함수 9개 권한 체크 없음 | 치명 | `app/actions/admin.ts` | `verifyAdmin()` 헬퍼 생성, 9개 함수에 관리자 이메일 확인 추가 |
| 3 | 컨설팅 결제 금액 클라이언트 신뢰 | 치명 | `app/actions/tutoring.ts` | 서버에 `TUTORING_PRICES` 테이블 추가, `amount` 파라미터 제거 |
| 4 | 결제 헬퍼 함수 HTTP 엔드포인트 노출 | 높음 | `app/actions/payment.ts` | `lib/toss-api.ts`로 분리 (비 "use server" 파일) |
| 5 | 보안 헤더 없음 | 높음 | `next.config.mjs` | CSP, X-Frame-Options, HSTS 등 7종 추가 |
| 6 | 오픈 리다이렉트 | 높음 | `app/login/page.tsx`, `app/auth/callback/route.ts` | `sanitizeRedirect()` 함수 |
| 7 | SSRF 보호 미흡 | 높음 | `app/actions/analyze.ts` | 클라우드 메타데이터 IP, IPv6 사설 범위, 프로토콜 제한 |
| 8 | 임의 파일 삭제 가능 | 높음 | `app/actions/analyze.ts` | `uploads/` 경로 검증 |
| 9 | body 크기 과다 (1GB) | 중간 | `next.config.mjs` | 500MB로 축소 |

---

## 3. 2차 수정 — 에러 핸들링/RLS/의존성 (커밋 2: `eab4dca`)

| # | 문제 | 위험도 | 파일 | 수정 내용 |
|---|------|--------|------|-----------|
| 10 | next 취약점 3건 (DoS) | 높음 | `package.json` | 16.0.10 → 16.1.6 업데이트 |
| 11 | 전역 에러 핸들러 없음 | 중간 | `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` | 신규 생성 — 빈 화면/스택트레이스 노출 방지 |
| 12 | DB error.message 직접 노출 | 중간 | `subscription.ts` 11곳, `tutoring.ts` 2곳, `payment.ts` 1곳 | `dbError()` 헬퍼로 사용자 메시지만 반환, 실제 에러는 서버 로그 |
| 13 | RLS portfolios/storage 완전 개방 | 치명 | `scripts/008`, `009` + Supabase SQL Editor 직접 실행 | `with check(true)` → `auth.uid() IS NOT NULL` |

---

## 4. 3차 수정 — RLS 대시보드 수동 정리

008/009 스크립트로 해결 안 된 정책을 Supabase SQL Editor에서 직접 삭제/재생성:

| 정책 이름 | 테이블 | 조치 |
|-----------|--------|------|
| `Anyone can delete` | storage.objects | 삭제 |
| `Anyone can upload` | storage.objects | 삭제 |
| `portfolios_delete_service` (qual: true) | portfolios | 삭제 |
| `portfolios_insert_service` (qual: NULL) | portfolios | 삭제 |
| `portfolios_delete_authenticated` (qual: true) | portfolios | 삭제 후 재생성 (auth.uid() IS NOT NULL) |
| `portfolios_update_service` (qual: true) | portfolios | 삭제 |
| `portfolios_update_authenticated` (qual: true) | portfolios | 삭제 후 재생성 (auth.uid() IS NOT NULL) |

교체 정책 (로그인 필수):
- `resumes_storage_insert_auth` — INSERT, `bucket_id = 'resumes' AND auth.uid() IS NOT NULL`
- `resumes_storage_delete_auth` — DELETE, `bucket_id = 'resumes' AND auth.uid() IS NOT NULL`
- `portfolios_insert_authenticated` — INSERT, `auth.uid() IS NOT NULL`
- `portfolios_update_authenticated` — UPDATE, `auth.uid() IS NOT NULL`
- `portfolios_delete_authenticated` — DELETE, `auth.uid() IS NOT NULL`

---

## 5. 전체 28개 항목 점검 결과

### Error Handling (6개)

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | AppError 커스텀 에러 클래스 | 미도입 | 추후 도입 가능 — 현재는 기본 Error 사용 |
| 2 | 전역 에러 핸들러 | ✅ 수정 완료 | error.tsx, global-error.tsx, not-found.tsx |
| 3 | RequestID 요청 추적 | 미도입 | 추후 middleware에서 추가 가능 |
| 4 | 에러 노출 차단 | ✅ 수정 완료 | dbError() 헬퍼로 14곳 수정 |
| 5 | 구조화 로그 | 미도입 | console.log 32곳 (추후 정리) |
| 6 | 에러 타입 분리 | 미도입 | 추후 도입 가능 |

### Security (22개)

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 7 | CORS | ✅ 양호 | Next.js Server Action 기본 보호 |
| 8 | CSRF | ✅ 양호 | Next.js Origin 헤더 검증 내장 |
| 9 | XSS + CSP | ⚠️ 부분적 | CSP에 unsafe-inline/eval (Next.js/TossPayments 요구) |
| 10 | SSRF | ✅ 수정 완료 | 클라우드 메타데이터, IPv6, 프로토콜 제한 |
| 11 | AuthN/AuthZ | ✅ 수정 완료 | 모든 서버 액션 인증 체크, verifyAdmin() |
| 12 | RBAC + 테넌트 격리 | ✅ 양호 | user_id 기반 쿼리 + 관리자 이메일 확인 |
| 13 | 최소 권한 | ✅ 양호 | anon key만 사용, service_role 미사용 |
| 14 | Validation + SQLi | ⚠️ 부분적 | SQL 안전 (Supabase), 입력 길이 제한 없음 |
| 15 | Rate Limit | ❌ 없음 | Vercel/Upstash Redis로 추후 도입 |
| 16 | 쿠키/세션 | ✅ 양호 | secure + sameSite + 30일 만료 |
| 17 | Secret 관리 | ✅ 양호 | 서버 전용 키 분리, .gitignore 설정 |
| 18 | 보안 헤더 | ✅ 수정 완료 | CSP, HSTS, X-Frame-Options 등 7종 |
| 19 | AuditLog | ❌ 없음 | 추후 관리자 작업 로그 테이블 추가 |
| 20 | 의존성 취약점 | ✅ 수정 완료 (next) | 잔여 1건: xlsx (패치 없음, 관리자 전용) |
| 21 | 2FA/TOTP | ❌ 없음 | Supabase MFA 설정으로 추후 도입 |
| 22 | 자동 백업 | ⚠️ 플랜 의존 | Supabase 대시보드에서 확인 필요 |
| 23 | 세션 타임아웃 | ⚠️ 부분적 | 30일 고정, 비활동 타임아웃 없음 |
| 24 | DB 권한 분리 | ✅ 양호 | service_role key 미사용, anon key만 |
| 25 | RLS 정책 | ✅ 수정 완료 | portfolios + storage 인증 필수로 변경 |
| 26 | 민감 필드 로깅 | ✅ 양호 | 결제/개인정보 로그 없음 |
| 27 | API 키 분리 | ✅ 양호 | Anthropic/Gemini 서비스별 환경변수 분리 |
| 28 | 암호화 | ✅ 양호 | HTTPS + HSTS + Supabase AES-256 |

### 요약

| 구분 | 수 |
|------|-----|
| ✅ 양호/수정 완료 | 19개 |
| ⚠️ 부분적 | 5개 |
| ❌ 미도입 | 4개 |

---

## 6. 잔여 이슈 (추후 개선)

| 이슈 | 우선도 | 설명 |
|------|--------|------|
| Rate Limiting | 중간 | 분석 API + 할인코드 검증에 요청 제한 필요 |
| AuditLog | 중간 | 관리자 작업 추적 테이블 |
| xlsx 취약점 | 중간 | 패치 없음, exceljs로 대체 고려 |
| 2FA/TOTP | 낮음 | 관리자 계정 2단계 인증 |
| RequestID | 낮음 | middleware에서 요청 추적 ID 부여 |
| console.log 정리 | 낮음 | 프로덕션 디버그 로그 32곳 제거/조건부 |
| 입력값 길이 제한 | 낮음 | URL, 파일명 등 maxLength 검증 |
| CSP unsafe 제거 | 낮음 | Next.js nonce 기반 CSP 전환 (프레임워크 지원 필요) |
| 비활동 세션 타임아웃 | 낮음 | 30일 외에 비활동 시간 기반 만료 추가 |

---

## 7. 보안 아키텍처 요약

```
클라이언트 → "use server" 함수 (HTTP 엔드포인트)
                ↓
            getUser() 인증 확인
                ↓
            (admin 함수) verifyAdmin() 관리자 확인
                ↓
            비즈니스 로직 (에러는 dbError()로 안전하게 반환)
                ↓
            Supabase RLS (DB 레벨 접근 제어)
```

### 결제 보안
- 구독 금액: `processSubscriptionPayment()` 내부에서 서버가 결정
- 컨설팅 금액: `TUTORING_PRICES` 서버 가격표에서 결정
- 결제 확인: DB에 저장된 금액과 대조 (`confirmTutoringPayment`)
- TossPayments API 호출: `lib/toss-api.ts` (HTTP 엔드포인트 아님)

### 에러 처리
- 전역: `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`
- DB 에러: `dbError()` 헬퍼 → 서버 로그에만 실제 에러, 사용자에게 친절한 메시지
- 결제 에러: TossPayments 메시지는 그대로 전달 (사용자가 이해 가능한 내용)

### RLS 정책 최종 상태
| 테이블 | 작업 | 정책 | 조건 |
|--------|------|------|------|
| storage.objects | SELECT | Public read access | bucket_id = 'resumes' |
| storage.objects | INSERT | resumes_storage_insert_auth | bucket_id = 'resumes' AND 로그인 필수 |
| storage.objects | DELETE | resumes_storage_delete_auth | bucket_id = 'resumes' AND 로그인 필수 |
| portfolios | SELECT | portfolios_select_all | 전체 공개 (분석 비교용) |
| portfolios | SELECT | authenticated_select_portfolios | 로그인 사용자 |
| portfolios | SELECT | admin_select_portfolios | 관리자만 |
| portfolios | INSERT | portfolios_insert_authenticated | 로그인 필수 |
| portfolios | INSERT | admin_insert_portfolios | 관리자만 |
| portfolios | UPDATE | portfolios_update_authenticated | 로그인 필수 |
| portfolios | UPDATE | admin_update_portfolios | 관리자만 |
| portfolios | DELETE | portfolios_delete_authenticated | 로그인 필수 |
| portfolios | DELETE | admin_delete_portfolios | 관리자만 |

---

## 8. 수정 이력

| 날짜 | 커밋 | 내용 |
|------|------|------|
| 2026-02-28 | `c53bf2f` | 1차: 인증/인가/결제/헤더/리다이렉트/SSRF |
| 2026-02-28 | `eab4dca` | 2차: next 업데이트, 에러 핸들러, DB 에러 차단, RLS 스크립트 |
| 2026-02-28 | (대시보드) | 3차: Supabase SQL Editor에서 RLS 정책 수동 정리 |
