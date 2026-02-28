# PRD: 결제/구독 시스템

## 1. 개요

| 항목 | 내용 |
|------|------|
| PG사 | TossPayments |
| 결제 방식 | 빌링키 기반 자동결제 (구독) + 일반결제 (컨설팅) |
| DB | Supabase: users_subscription, tutoring_orders |
| 마지막 갱신 | 2026-02-27 |

## 2. 요금제 구조

### 2.1 구독 플랜

| 플랜 | 가격 | 분석 횟수 | 프로젝트 | Claude 모델 | 기간 |
|------|------|-----------|----------|-------------|------|
| free | 무료 | 1회 | 1개 | Sonnet | - |
| monthly | 17,900원/월 | 무제한 | 무제한 | Sonnet | 1개월 |
| three_month | 49,000원 | 무제한 | 무제한 | Opus | 3개월 |
| tutoring | 컨설팅 결제 시 | 무제한 | 무제한 | Sonnet | 1개월 |

### 2.2 게임캔버스 할인
- 대상: monthly 플랜만
- 할인가: 5,900원/월
- 검증: `GAMECANVAS_DISCOUNT_CODES` 환경변수의 코드와 비교
- 주문명: "디자이닛 월 구독 (게임캔버스)"

### 2.3 컨설팅 상품
별도 일반결제 → 결제 완료 시 1개월 구독(tutoring 플랜) 자동 부여

## 3. 구독 결제 흐름

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

## 4. 구독 해지 흐름

```
cancelSubscription():
1. 구독 정보 조회
2. 무료 플랜이면 거부
3. 이미 해지됐으면 거부
4. 빌링키 있으면 TossPayments에서 삭제
5. DB 업데이트: status="cancelled", billing_key=null
```

## 5. 컨설팅 결제 흐름

```
1. createTutoringOrder() → DB에 주문 생성 (orderId)
2. TossPayments 일반결제 위젯 표시
3. 결제 완료 → confirmTutoringPayment():
   a. DB에서 주문 금액 재확인 (클라이언트 값 신뢰 X)
   b. confirmPayment() → TossPayments 결제 확인
   c. tutoring_orders DB 업데이트 (paid)
   d. users_subscription을 tutoring 플랜으로 upsert (+1개월)
```

## 6. 할당량 체크

### 6.1 분석 할당량 (`checkAnalysisAllowance`)
| 플랜 | 제한 |
|------|------|
| free | 총 1회 |
| 유료 (active, 미만료) | 무제한 |
| 유료 (만료) | 차단 |

### 6.2 프로젝트 할당량 (`checkProjectAllowance`)
| 플랜 | 제한 |
|------|------|
| free | 1개 |
| 유료 (active, 미만료) | 무제한 |
| 유료 (만료) | 차단 |

## 7. DB 테이블

### 7.1 users_subscription

| 컬럼 | 타입 | 설명 |
|------|------|------|
| user_id | UUID (PK, FK) | 사용자 ID |
| plan | text | free/monthly/three_month/tutoring |
| status | text | active/cancelled/expired |
| billing_key | text | TossPayments 빌링키 |
| customer_key | text | 고객 키 |
| payment_id | text | 결제 키 |
| started_at | timestamptz | 구독 시작일 |
| expires_at | timestamptz | 만료일 |
| cancelled_at | timestamptz | 해지일 |

### 7.2 tutoring_orders

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 주문 ID |
| user_id | UUID (FK) | 사용자 ID |
| order_id | text (unique) | TUT_{type}_{uid}_{timestamp} |
| package_type | text | 상품 타입 |
| amount | integer | 결제 금액 |
| payment_key | text | TossPayments 결제 키 |
| payment_status | text | pending/paid |
| paid_at | timestamptz | 결제 확인 시각 |

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `app/actions/payment.ts` (228줄) | TossPayments API 호출: 빌링키, 결제, 할인코드 |
| `app/actions/subscription.ts` (369줄) | 구독 CRUD, 프로젝트 CRUD, 분석 이력, 할당량 체크 |
| `app/actions/tutoring.ts` (108줄) | 컨설팅 주문/결제/구독 부여 |
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
| 금액 변조 방지 | 컨설팅 결제 시 서버에서 DB 금액 재확인 |
| 인증 | 모든 결제 액션에서 getUser() 확인 |
| RLS | Supabase RLS로 user_id 기반 접근 제한 |

## 11. 알려진 이슈

| 항목 | 설명 |
|------|------|
| 자동갱신 미구현 | 빌링키는 저장하지만 만료 시 자동 결제하는 cron 없음 |
| expired 자동 처리 없음 | expires_at 지났어도 DB status가 active 유지 |
| subscription.ts 혼재 | 구독 + 프로젝트 + 분석이력이 한 파일에 → 분리 필요 |
