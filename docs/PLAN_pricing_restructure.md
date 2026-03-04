# 가격 구조 개편 계획

## 새 가격표

| 플랜 | 가격 | 분석 횟수 | 비고 |
|------|------|-----------|------|
| 무료 | 0원 | 1회 | 회원가입 시 1크레딧 지급 |
| 1회권 | 3,900원 | 1회 | 건별 결제 |
| 5회권 | 17,900원 | 5회 | 회당 3,580원 (8% 할인) |
| 10회권 | 29,000원 | 10회 | 회당 2,900원 (26% 할인) |
| 월 무제한 | 13,900원/월 | 무제한 | 구독 (자동결제) |
| 3개월 무제한 | 39,000원 | 무제한 | 월 13,000원 수준 |
| GameCanvas 할인 | 월결제에만 적용 | - | 기존 유지 |

※ 컨설팅(tutoring) 기능은 삭제됨

---

## 현재 → 변경 비교

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| 무료 | 1회 (analysis_history 카운트) | 1회 (크레딧 기반) |
| 유료 | 월 17,900 / 3개월 49,000 | 월 13,900 / 3개월 39,000 |
| 회차권 | 없음 | 1/5/10회권 신규 |
| 분석 제한 방식 | plan 타입으로 판단 | **크레딧 시스템** (회차권) + **구독** (무제한) |

---

## 핵심 변경: 크레딧 시스템 도입

### DB 변경

`users_subscription` 테이블에 컬럼 추가:
```sql
ALTER TABLE users_subscription
  ADD COLUMN analysis_credits integer DEFAULT 1;
-- 기존 무료 사용자: 이미 분석 0회면 0, 아직 안 썼으면 1
```

분석 허용 판단 로직:
- **구독 사용자** (monthly/three_month): 기간 내 무제한 → 기존과 동일
- **비구독 사용자** (free): `analysis_credits > 0`이면 허용, 분석 후 -1

### 크레딧 결제 테이블 (신규)

```sql
CREATE TABLE credit_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  package_type text NOT NULL,     -- 'credit_1' | 'credit_5' | 'credit_10'
  credits integer NOT NULL,        -- 1, 5, 10
  amount integer NOT NULL,         -- 3900, 17900, 29000
  order_id text UNIQUE NOT NULL,
  payment_key text,
  payment_status text DEFAULT 'pending', -- 'pending' | 'paid' | 'cancelled'
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);
```

---

## 수정 파일 목록

### 1. DB 마이그레이션 (신규)
- `scripts/010_add_credits_system.sql`
  - `analysis_credits` 컬럼 추가
  - `credit_orders` 테이블 생성
  - 기존 사용자 크레딧 초기화 (무료+분석 안 한 사람 → 1, 이미 쓴 사람 → 0)

### 2. 서버 액션 수정

**`app/actions/subscription.ts`** (크레딧 로직 추가)
- `checkAnalysisAllowance()`: 구독이면 무제한, 아니면 `analysis_credits > 0` 확인
- `deductCredit()` 신규: 분석 완료 후 크레딧 -1 (구독자는 차감 안 함)
- `getSubscription()`: `analysis_credits` 포함해서 반환
- `checkProjectAllowance()`: 크레딧 있으면 프로젝트 생성 허용으로 변경

**`app/actions/payment.ts`** (크레딧 결제 추가)
- `CREDIT_PRICES` 서버 가격표 추가: `{ credit_1: 3900, credit_5: 17900, credit_10: 29000 }`
- `createCreditOrder(packageType)` 신규: 주문 생성
- `confirmCreditPayment(paymentKey, orderId, amount)` 신규: 결제 확인 + 크레딧 지급
- 구독 가격 변경: monthly 17900→13900, three_month 49000→39000

**`app/actions/analyze.ts`** (분석 후 크레딧 차감)
- `analyzeUrlDirect`, `analyzeDocumentDirect` 끝에서 `deductCredit()` 호출

### 3. 결제 페이지

**`app/payment/billing/page.tsx`** (구독 가격 변경)
- monthly: 17,900 → 13,900
- three_month: 49,000 → 39,000

**`app/payment/credits/page.tsx`** (신규 — 크레딧 결제)
- 1/5/10회권 선택 UI
- TossPayments 일반결제 위젯

**`app/payment/credits/success/page.tsx`** (신규 — 결제 완료)
- `confirmCreditPayment()` 호출
- 마이페이지로 리다이렉트

### 4. UI 페이지

**`app/pricing/page.tsx`** (가격표 페이지 전면 수정)
- 6개 플랜 카드: 무료 / 1회 / 5회 / 10회 / 월무제한 / 3개월
- 회차권 → 크레딧 결제 페이지로 이동
- 구독 → 기존 billing 페이지로 이동

**`components/pricing-section.tsx`** (랜딩 가격 카드 수정)
- 새 가격표 반영

**`components/pricing-modal.tsx`** (모달 수정)
- 새 가격표 반영

**`app/mypage/` 관련** (남은 크레딧 표시)
- "남은 분석 횟수: N회" 표시 추가
- 크레딧 추가 구매 버튼

### 5. PRD 문서 업데이트
- `docs/PRD_pricing.md` — 새 가격 구조 반영

---

## 분석 허용 판단 흐름 (변경 후)

```
분석 요청
  ↓
로그인 확인
  ↓
구독 확인 (monthly/three_month?)
  ├─ YES + 기간 내 → 무제한 허용
  └─ NO ↓
크레딧 확인 (analysis_credits > 0?)
  ├─ YES → 허용 → 분석 완료 후 크레딧 -1
  └─ NO → "크레딧이 없습니다" → 가격표 페이지로 안내
```

---

## 작업 순서

1. DB 마이그레이션 스크립트 작성
2. subscription.ts 크레딧 로직 추가
3. payment.ts 크레딧 결제 함수 추가 + 가격 변경
4. analyze.ts 크레딧 차감 연동
5. 크레딧 결제 페이지 생성 (payment/credits)
6. pricing 페이지 + 컴포넌트 UI 수정
7. 마이페이지 크레딧 표시
8. Supabase SQL 실행 (사용자가 직접)
9. 커밋 + 푸시

---

## 주의사항

- 기존 구독자(monthly/three_month)는 영향 없음 — 만료까지 무제한 유지
- 기존 무료 사용자 중 분석 1회 이미 쓴 사람 → credits 0으로 세팅
- 기존 무료 사용자 중 아직 안 쓴 사람 → credits 1 유지
- 컨설팅(tutoring) 기능은 삭제됨
- GameCanvas 할인코드: 월결제에만 적용 (기존과 동일)
