# 태스크 리스트 — 학습데이터 + 결제/환불 시스템 개선

> 작성일: 2026-03-06
> 최종 수정: 2026-04-17
> 상태: 태스크 2, 3, 4 완료 / 태스크 1 대기

---

## 개요

결제 시스템(NICEPayments) 연동 완료 후, 서비스 출시 전 필요한 개선 작업.
크게 두 축으로 진행한다.

| 구분 | 태스크 | 상태 |
|------|--------|------|
| 1 | 학습데이터 관련 문제개선 | 미정 (테스트 후 확정) |
| 2-1 | 환불 규정에 크레딧 추가 | ✅ 완료 |
| 2-2 | 마이페이지 게이지 UI | ✅ 완료 |
| 2-3 | 크레딧 우선 소모 로직 변경 | ✅ 완료 |
| 2-4 | 안내 문구 추가 | ✅ 완료 |
| 2-5 | 크레딧 셀프 환불 기능 | ✅ 완료 |
| 3 | 자동갱신(빌링키) 구독 결제 | ✅ 완료 (Supabase SQL 실행 필요) |
| 4 | 간편결제(네이버페이·카카오페이) 추가 | ✅ 완료 (`f1e259d`) |

---

## 태스크 1: 학습데이터 관련 문제개선

**상태**: 미정 — 사용자 테스트 후 확정

- 관련 파일: `app/actions/admin.ts`, `app/admin/training/page.tsx`
- 관련 DB: `portfolios`, `portfolio_chunks`, `portfolio_analysis`, `success_patterns`
- 사용자가 업로드/분석/공통점 추출 등을 테스트 후 구체적 이슈 공유 예정
- 이슈 확정 시 이 문서에 상세 내용 추가

---

## 태스크 2: 결제 페이지 수정 및 환불 안내 수정

### 2-1. 환불 규정에 크레딧 추가 ✅

**상태**: 완료 (커밋 `3e11ca6`)
**파일**: `app/refund-policy/page.tsx`

#### 변경 완료 내용
1. **제1조** — "크레딧 결제" 문구 추가
2. **제2조** — 크레딧 패키지 목록 추가 (1/5/10크레딧)
3. **제5조 (신규)** — 크레딧 환불 기준 (7일 이내, 미사용 전액, 부분 사용 정가 차감)
4. **환불 요약 표** — 크레딧 행 추가

---

### 2-2. 마이페이지 게이지 UI ✅

**상태**: 완료 (커밋 `3e11ca6`)
**파일**: `app/mypage/page.tsx`

#### 변경 완료 내용
- 크레딧 게이지: 파란색(`#5B8DEF`), Progress 바 + 숫자 표시
- 구독 게이지: 초록색(`emerald-400`), D-day + 기간 표시
- 크레딧+구독 동시: 두 게이지 + 안내 문구
- `Subscription` 타입에 `analysis_credits`, `started_at` 추가

---

### 2-3. 크레딧 우선 소모 로직 ✅

**상태**: 완료 (커밋 `3e11ca6`)
**파일**: `app/actions/subscription.ts`

#### 변경 완료 내용
- `checkAnalysisAllowance()`: 크레딧 > 0 먼저 확인 → 활성 구독 → 차단
- `deductCredit()`: 크레딧 먼저 차감 → 구독 → 에러
- 두 함수 모두 `source` 필드 반환 ("credit" | "subscription")

---

### 2-4. 안내 문구 추가 ✅

**상태**: 완료 (커밋 `3e11ca6`)

| 파일 | 위치 | 안내 내용 | 상태 |
|------|------|----------|------|
| `app/mypage/page.tsx` | 게이지 아래 | "보유 크레딧(N회)를 먼저 소모한 뒤 구독이 적용됩니다" | ✅ |
| `app/pricing/page.tsx` | 구독 플랜 하단 | "* 크레딧을 보유한 상태에서 구독 시, 보유 크레딧을 먼저 소모한 뒤 구독이 적용됩니다." | ✅ |
| `app/payment/billing/page.tsx` | 결제 요약 위 | 크레딧 보유 시 안내 배너 (현재 N회 보유 중) | ✅ |

---

### 2-5. 크레딧 셀프 환불 기능 ✅ (추가 태스크)

**상태**: 완료 (커밋 `9200dc5`)
**배경**: 원래 카카오톡 문의로 환불 처리 → 마이페이지에서 직접 환불로 변경

#### 변경 완료 내용

| 파일 | 변경 내용 |
|------|----------|
| `lib/toss-api.ts` | `cancelPayment()` 함수 추가 (토스 결제 취소 API) |
| `app/actions/payment.ts` | `getCreditOrders()` — 환불 가능 주문 목록 조회 |
| | `refundCreditOrder()` — 환불 실행 (토스 API → DB → 크레딧 차감) |
| `app/mypage/page.tsx` | 크레딧 구매 내역 섹션 + 환불하기 버튼 + 확인 다이얼로그 |
| `app/refund-policy/page.tsx` | 제6조 환불절차를 "마이페이지 직접 환불"로 변경 |
| `scripts/014_add_refund_columns.sql` | `credit_orders`에 `refunded_at`, `refund_amount` 컬럼 추가 |

#### 환불 로직
- 결제일로부터 **7일 이내**만 환불 가능
- 미사용 시 **전액 환불**
- 부분 사용 시 **정가(2,900원/회) 차감** 후 환불
- 마이페이지에서 즉시 처리 (카카오톡 문의 불필요)

#### ⚠️ DB 마이그레이션 필요
`scripts/014_add_refund_columns.sql`을 Supabase SQL Editor에서 실행해야 함

---

---

## 태스크 3: 자동갱신(빌링키) 구독 결제 구현 ✅

**상태**: 완료 (커밋 `a2a9b26`)
**배경**: 토스페이먼츠 팝업 방식은 빌링키 저장이 어려움 → NICEPayments 비인증 빌링키 방식으로 전환

### 구현 내용

| 파일 | 설명 |
|------|------|
| `app/payment/billing/page.tsx` | 카드 직접 입력 폼으로 전면 교체 (카드번호/유효기간/비밀번호앞2자리/생년월일) |
| `app/api/nicepay/billing/register/route.ts` (신규) | AES-128-ECB 암호화 → 빌링키 발급 → 첫 결제 → DB upsert |
| `app/api/cron/renew-subscriptions/route.ts` (신규) | Vercel Cron: 만료 25시간 전 구독 자동 갱신, 3회 실패 시 빌링키 삭제+구독 만료 |
| `vercel.json` (신규) | Cron 스케줄: `0 17 * * *` UTC (= 매일 오전 2시 KST) |
| `scripts/015_add_auto_renewal.sql` (신규) | `auto_renewal`, `renewal_failed_at`, `renewal_fail_count` 컬럼 추가 |

### 자동갱신 로직 요약
1. Vercel Cron이 매일 오전 2시(KST) GET `/api/cron/renew-subscriptions` 호출
2. `expires_at`이 25시간 이내인 `active` + `auto_renewal=true` + `billing_key 있는` 구독 조회
3. 각 구독에 대해 `approveBillingPayment()` 호출 → 성공 시 `expires_at` +1개월/+3개월 연장
4. 실패 시 `renewal_fail_count` +1, 3회 실패 도달 시 `deleteBillingKey()` + `status='expired'` 처리

### ⚠️ 배포 후 필수 작업
- [ ] **Supabase SQL Editor에서 `scripts/015_add_auto_renewal.sql` 실행** (컬럼 추가)
- [ ] **Vercel 환경변수 `CRON_SECRET` 추가** (Cron endpoint 무단 호출 방지)
- [ ] 커스텀 도메인에서 실제 카드 등록 테스트 (빌링키 발급 + 첫 결제 확인)

---

## 태스크 4: 간편결제(네이버페이·카카오페이) 추가 ✅

**상태**: 완료 (커밋 `f1e259d`)
**배경**: 카드사 심사 승인 후, 간편결제 수단 추가 요청

### 변경 완료 내용

| 파일 | 변경 내용 |
|------|----------|
| `app/payment/credits/page.tsx` | `AUTHNICE.requestPay()` method: `"card"` → `"cardAndEasyPay"` |

### 동작 방식
- NICEPay 결제창에 카드 결제와 함께 네이버페이, 카카오페이 등 간편결제 수단이 자동 노출
- 서버 콜백(`/api/nicepay/callback`)은 기존과 동일하게 동작 (결제수단 무관)
- `cardAndEasyPay`는 `cardCode`, `cardQuota`, `shopInterest` 파라미터와 함께 사용 불가 (현재 미사용으로 영향 없음)

---

## 수정 파일 요약

| 파일 | 태스크 | 변경 종류 | 커밋 |
|------|--------|----------|------|
| `app/actions/subscription.ts` | 2-3 | 로직 변경 (deductCredit, checkAnalysisAllowance) | `3e11ca6` |
| `app/refund-policy/page.tsx` | 2-1, 2-5 | 환불 규정 + 셀프 환불 안내 | `3e11ca6`, `9200dc5` |
| `app/mypage/page.tsx` | 2-2, 2-4, 2-5 | 게이지 UI + 안내 문구 + 환불 UI | `3e11ca6`, `9200dc5` |
| `app/pricing/page.tsx` | 2-4 | 안내 문구 | `3e11ca6` |
| `app/payment/billing/page.tsx` | 2-4 | 크레딧 보유 시 안내 배너 | `3e11ca6` |
| `lib/toss-api.ts` | 2-5 | cancelPayment() 추가 | `9200dc5` |
| `app/actions/payment.ts` | 2-5 | getCreditOrders(), refundCreditOrder() | `9200dc5` |
| `scripts/014_add_refund_columns.sql` | 2-5 | DB 마이그레이션 | `9200dc5` |
| `app/payment/credits/page.tsx` | 4 | method: card → cardAndEasyPay | `f1e259d` |

---

## 검증 체크리스트

- [x] `npx next build` 통과
- [x] 마이페이지: 크레딧 사용자 → 크레딧 게이지 + 숫자
- [x] 마이페이지: 구독자 → 구독 기간 게이지 + D-day
- [x] 마이페이지: 크레딧+구독 동시 → 두 게이지 + 안내 문구
- [x] 환불 규정 페이지: 크레딧 환불 기준 표시
- [x] 구독 결제 페이지: 크레딧 보유 시 안내 배너
- [x] 마이페이지: 크레딧 구매 내역 + 환불하기 버튼
- [x] 환불 규정 페이지: 마이페이지 직접 환불 안내
- [ ] 실제 테스트: 크레딧 있으면 크레딧 먼저 차감 (구독 무관)
- [ ] 실제 테스트: 크레딧 0 + 활성 구독 → 무제한
- [ ] 실제 테스트: 환불 실행 → 토스 API 호출 → 크레딧 차감
- [ ] DB 마이그레이션 실행 (`scripts/014_add_refund_columns.sql`)
