# PRD: 결제/구독 시스템

## 1. 개요

| 항목 | 내용 |
|------|------|
| PG사 | TossPayments |
| 결제 방식 | 일반결제 (크레딧) + 빌링키 자동결제 (구독) |
| DB | Supabase: users_subscription, credit_orders |
| 마지막 갱신 | 2026-02-28 |
| 가격 기준표 | → [PRD_가격표_요금제.md](./PRD_가격표_요금제.md) 참고 |

> **가격 변경 시**: PRD_가격표_요금제.md를 먼저 수정하고, 거기 적힌 "코드 반영 위치"를 모두 수정하세요.

## 2. 요금제 구조

### 2.1 회차권 (크레딧)

| 패키지 | package_type | 가격 | 크레딧 | 비고 |
|--------|-------------|------|--------|------|
| 무료 | - | 0원 | 1회 | 회원가입 시 자동 지급 |
| 1회권 | credit_1 | 2,900원 | 1회 | - |
| 5회권 | credit_5 | 7,900원 | 5회 | 회당 1,580원 |
| 10회권 | credit_10 | 12,900원 | 10회 | 회당 1,290원 |

### 2.2 무제한 구독

| 플랜 | 가격 | 분석 횟수 | 프로젝트 | Claude 모델 | 기간 |
|------|------|-----------|----------|-------------|------|
| monthly | 13,900원/월 | 무제한 | 무제한 | Sonnet | 1개월 |
| three_month | 39,000원 | 무제한 | 무제한 | Opus | 3개월 |
### 2.3 게임캔버스 할인
- 대상: monthly 플랜만
- 할인가: 5,900원/월
- 검증: `GAMECANVAS_DISCOUNT_CODES` 환경변수의 코드와 비교
- 주문명: "디자이닛 월 구독 (게임캔버스)"

## 3. 크레딧 결제 흐름

```
1. 사용자가 크레딧 패키지 선택 (1회/5회/10회)
2. createCreditOrder(packageType) 호출:
   a. 서버에서 CREDIT_PRICES로 금액 결정 (클라이언트 값 무시)
   b. credit_orders 테이블에 주문 생성 (pending 상태)
   c. orderId + amount 반환
3. TossPayments 일반결제 위젯 표시
4. 결제 완료 → /payment/credits/success로 리다이렉트
5. confirmCreditPayment(paymentKey, orderId, amount) 호출:
   a. credit_orders에서 주문 조회 + 금액 검증
   b. TossPayments 결제 확인 API 호출
   c. credit_orders 상태 → paid 업데이트
   d. users_subscription.analysis_credits 증가
```

## 4. 구독 결제 흐름

```
1. 사용자가 요금제 선택 → 카드 등록 위젯 표시
2. 카드 등록 완료 → authKey 발급
3. processSubscriptionPayment() 호출:
   a. issueBillingKey(authKey, customerKey) → 빌링키 발급
   b. 할인코드 검증 (있으면)
   c. approveBillingPayment() → 첫 결제 승인
   d. DB 구독 활성화 (upsert)
4. 만료일 계산:
   - 테스터 계정: 항상 +1개월
   - 기존 활성 구독: 만료일에서 +1개월 연장
   - 신규/만료: 현재부터 1개월 or 3개월
```

## 5. 구독 해지 흐름

```
cancelSubscription():
1. 구독 정보 조회
2. 무료 플랜이면 거부
3. 이미 해지됐으면 거부
4. 빌링키 있으면 TossPayments에서 삭제
5. DB 업데이트: status="cancelled", billing_key=null
```

## 6. 할당량 체크

### 6.1 분석 할당량 (`checkAnalysisAllowance`)
| 조건 | 결과 |
|------|------|
| 활성 구독 (monthly/three_month, 미만료) | 무제한 허용 |
| 크레딧 1개 이상 | 허용 (분석 후 1개 차감) |
| 크레딧 0개 + 구독 없음 | 차단 → 크레딧 구매 또는 구독 안내 |

### 6.2 프로젝트 할당량 (`checkProjectAllowance`)
| 조건 | 결과 |
|------|------|
| 활성 구독 | 무제한 |
| 크레딧 1개 이상 | 허용 |
| 크레딧 0개 + 구독 없음 | 1개 제한 |

### 6.3 크레딧 차감 (`deductCredit`)
- 분석 완료 후 호출
- 활성 구독자: 차감 없이 통과 (무제한)
- 비구독자: `analysis_credits -= 1`

## 7. DB 테이블

### 7.1 users_subscription

| 컬럼 | 타입 | 설명 |
|------|------|------|
| user_id | UUID (PK, FK) | 사용자 ID |
| plan | text | free/monthly/three_month |
| status | text | active/cancelled/expired |
| analysis_credits | integer (DEFAULT 1) | 남은 분석 크레딧 |
| billing_key | text | TossPayments 빌링키 |
| customer_key | text | 고객 키 |
| payment_id | text | 결제 키 |
| started_at | timestamptz | 구독 시작일 |
| expires_at | timestamptz | 만료일 |
| cancelled_at | timestamptz | 해지일 |

### 7.2 credit_orders

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 주문 ID |
| user_id | UUID (FK) | 사용자 ID |
| order_id | text (unique) | CREDIT_{type}_{uid}_{timestamp} |
| package_type | text | credit_1 / credit_5 / credit_10 |
| credits | integer | 지급 크레딧 수 |
| amount | integer | 결제 금액 |
| payment_key | text | TossPayments 결제 키 |
| payment_status | text | pending / paid |
| paid_at | timestamptz | 결제 확인 시각 |

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `app/actions/payment.ts` | TossPayments API: 구독결제, 크레딧결제, 할인코드 |
| `app/actions/subscription.ts` | 구독 CRUD, 할당량 체크, 크레딧 차감 |
| `app/payment/credits/page.tsx` | 크레딧 결제 페이지 |
| `app/payment/credits/success/page.tsx` | 크레딧 결제 성공 페이지 |
| `app/payment/billing/page.tsx` | 구독 결제 페이지 |
| `components/pricing-modal.tsx` | 요금제 선택 모달 |
| `components/pricing-section.tsx` | 랜딩페이지 가격표 |

## 9. 환경변수

| 변수명 | 용도 |
|--------|------|
| `TOSS_SECRET_KEY` | TossPayments 시크릿 키 (Basic 인증) |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | TossPayments 클라이언트 키 |
| `GAMECANVAS_DISCOUNT_CODES` | 할인 코드 목록 (쉼표 구분) |

## 10. 보안

| 항목 | 구현 |
|------|------|
| 빌링키 보호 | 서버에서만 접근, DB에 저장 |
| 금액 변조 방지 | 서버에서 CREDIT_PRICES/SUBSCRIPTION_PRICES 기준으로 금액 결정 |
| 인증 | 모든 결제 액션에서 getUser() 확인 |
| RLS | Supabase RLS로 user_id 기반 접근 제한 |

## 11. 알려진 이슈

| 항목 | 설명 |
|------|------|
| 자동갱신 미구현 | 빌링키는 저장하지만 만료 시 자동 결제하는 cron 없음 |
| expired 자동 처리 없음 | expires_at 지났어도 DB status가 active 유지 |
| subscription.ts 혼재 | 구독 + 프로젝트 + 분석이력이 한 파일에 → 분리 필요 |
