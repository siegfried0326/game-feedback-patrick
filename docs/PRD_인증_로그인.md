# PRD: 인증/로그인 시스템

## 1. 개요

| 항목 | 내용 |
|------|------|
| 서비스명 | 디자이닛 (DesignIt) |
| 인증 기반 | Supabase Auth (PKCE flow) |
| 소셜 로그인 | Google, Kakao, Apple |
| 세션 유지 | 30일 쿠키 기반 |
| 마지막 갱신 | 2026-02-27 |

## 2. 기능 목록

| 번호 | 기능 | 설명 |
|------|------|------|
| 1 | Google 소셜 로그인 | Supabase OAuth |
| 2 | Kakao 소셜 로그인 | Supabase OAuth |
| 3 | Apple 소셜 로그인 | Supabase OAuth |
| 4 | 이메일/비밀번호 로그인 | signInWithPassword |
| 5 | OAuth 콜백 처리 | code → session 교환 |
| 6 | 세션 관리 | 30일 쿠키, 자동 갱신 |
| 7 | 미들웨어 라우트 보호 | 비로그인 차단 |
| 8 | 관리자 권한 체크 | ADMIN_EMAILS 환경변수 |
| 9 | 첫 로그인 시 free 구독 생성 | users_subscription 자동 삽입 |
| 10 | 로그아웃 | 세션 삭제 + 홈 이동 |
| 11 | 리다이렉트 복원 | 로그인 후 원래 페이지로 이동 |

## 3. 상세 흐름

### 3.1 소셜 로그인

```
사용자 → 로그인 페이지 → 소셜 버튼 클릭
  ├─ redirectTo 값이 "/" 아니면 쿠키에 백업 저장 (redirect_after_login, 600초)
  ├─ supabase.auth.signInWithOAuth() 호출
  └─ Provider 인증 완료 → /auth/callback 으로 리다이렉트

/auth/callback 처리:
  ├─ URL에서 code, next 파라미터 추출
  ├─ 쿠키에서 redirect_after_login 백업값 추출
  ├─ exchangeCodeForSession(code) → 세션 발급
  ├─ ensureSubscription(user.id) → free 구독 자동 생성
  ├─ 리다이렉트 쿠키 삭제
  └─ 최종 URL로 이동 (next 우선, 쿠키 백업 차선)
```

### 3.2 이메일/비밀번호 로그인

```
사용자 → "이메일로 로그인" 클릭 → 이메일/비밀번호 입력
  ├─ signInWithPassword({ email, password }) 호출
  ├─ 성공: window.location.href = redirectTo
  └─ 실패: "이메일 또는 비밀번호가 올바르지 않습니다." 표시
```

- OAuth 콜백을 거치지 않음 → ensureSubscription 즉시 미호출
- 대신 getSubscription()에서 레코드 미존재 시 자동 생성 (PGRST116 에러 처리)

### 3.3 리다이렉트 로직

| 저장 위치 | 용도 | 만료 |
|-----------|------|------|
| URL `?next=` | OAuth 콜백에서 1차 사용 | 콜백 처리 시 소멸 |
| 쿠키 `redirect_after_login` | next 유실 시 백업 | 600초 |

- 비로그인 → `/mypage` 접근 → `/login?redirect=/mypage`
- 비로그인 → `/admin/*` 접근 → `/login?redirect=/admin/...`
- 로그인 → `/login` 접근 → `/` (홈으로)

### 3.4 로그아웃

```
헤더 로그아웃 버튼 → signOut() 서버 액션
  ├─ supabase.auth.signOut()
  └─ redirect("/")
```

### 3.5 관리자 권한 체크

관리자 체크가 3곳에 존재 (통합 필요):
1. `middleware.ts` — 라우트 접근 시 (환경변수 직접 파싱)
2. `lib/admin.ts` — `isAdminEmail()` 함수 (헤더에서 사용)
3. `app/actions/admin.ts` — 서버 액션 내부

## 4. 관련 파일

| 파일 | 역할 |
|------|------|
| `app/login/page.tsx` | 로그인 페이지 UI (소셜 3종 + 이메일) |
| `app/auth/callback/route.ts` | OAuth 콜백 (code→session, 구독 생성, 리다이렉트) |
| `app/actions/auth.ts` | 서버 액션: getUser, signOut, ensureSubscription |
| `middleware.ts` | 세션 갱신, 라우트 보호, 관리자 체크 |
| `lib/supabase/client.ts` | 브라우저용 Supabase 클라이언트 |
| `lib/supabase/server.ts` | 서버용 Supabase 클라이언트 |
| `lib/admin.ts` | isAdminEmail() 함수 |
| `components/auth-header.tsx` | 서버에서 유저 정보 조회 → Header에 전달 |
| `components/header.tsx` | 메인 헤더 (로그인/로그아웃 버튼, 관리자 뱃지) |

## 5. DB 테이블

### auth.users (Supabase 내장)

| 필드 | 설명 |
|------|------|
| `id` (UUID) | 사용자 식별자, 외래키로 사용 |
| `email` | 이메일 주소 |
| `user_metadata` | 소셜 provider 메타데이터 (full_name, name 등) |

### users_subscription

| 필드 | 타입 | 설명 |
|------|------|------|
| `user_id` | UUID (FK) | 사용자 식별자 |
| `plan` | text | "free", "monthly", "three_month" |
| `status` | text | "active", "cancelled", "expired" |
| `billing_key` | text | TossPayments 빌링키 |
| `expires_at` | timestamptz | 구독 만료일 |

## 6. 세션 관리

| 옵션 | 값 | 설명 |
|------|-----|------|
| `maxAge` | 30일 | 세션 유지 기간 |
| `sameSite` | `lax` | OAuth 리다이렉트 호환 |
| `secure` | production만 | HTTPS 강제 |

미들웨어에서 모든 요청마다 `supabase.auth.getUser()` 호출 → 토큰 만료 임박 시 자동 갱신

## 7. 미들웨어 라우트 보호

| 라우트 | 접근 조건 | 미인증 시 |
|--------|-----------|-----------|
| `/mypage` | 로그인 필요 | `/login?redirect=/mypage` |
| `/admin/*` | 로그인 + ADMIN_EMAILS | 미로그인→로그인, 비관리자→홈 |
| `/login` | 비로그인만 | 로그인 상태면 홈으로 |

## 8. 환경변수

| 변수명 | 필수 | 설명 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 필수 | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 필수 | Supabase anon 키 |
| `ADMIN_EMAILS` | 선택 | 관리자 이메일 (쉼표 구분) |

## 9. 알려진 이슈

| 항목 | 설명 |
|------|------|
| 회원가입 없음 | 이메일 계정은 Supabase Dashboard에서 수동 생성 |
| 비밀번호 찾기 없음 | resetPasswordForEmail 미구현 |
| ADMIN_EMAILS 파싱 중복 | 3곳에서 각각 파싱 → lib/admin.ts로 통일 필요 |
| Apple 로그인 | 모든 환경 노출 (iOS 제한 없음) |
