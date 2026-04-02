# PRD: 마이페이지 — 구독 관리

## 1. 개요

| 항목 | 내용 |
|------|------|
| 라우트 | `/mypage` (상단 구독 상태 영역) |
| 파일 | `app/mypage/page.tsx` 내 구독 관련 부분 |
| 서버 | `app/actions/subscription.ts` → getSubscription, cancelSubscription |
| 관련 PRD | PRD_가격표_요금제.md (가격 기준), PRD_결제_구독.md (결제 흐름) |
| 마지막 갱신 | 2026-03-06 |

마이페이지 상단에 구독/크레딧 상태를 게이지 UI로 표시하고, 구독 해지 + 크레딧 환불 기능을 제공.

---

## 2. 기능 목록

| 기능 | 설명 |
|------|------|
| 크레딧 게이지 | 남은 크레딧 수 + Progress 바 (파란색 #5B8DEF) |
| 구독 게이지 | D-day + 기간 Progress 바 (초록색 emerald-400) |
| 크레딧 우선 소모 안내 | "보유 크레딧(N회)를 먼저 소모한 뒤 구독이 적용됩니다" |
| 구독 해지 | 확인 후 빌링키 삭제 + 상태 변경 |
| 크레딧 구매 내역 | 주문 목록 + 환불하기 버튼 + 환불 금액 표시 |
| 크레딧 환불 | 7일 이내, 미사용 전액 / 부분 사용 정가 차감 후 환불 |
| 업그레이드 안내 | 무료 유저에게 구독 유도 |

---

## 3. 구독 상태 표시

### 3.1 조회 (`getSubscription`)
```
1. user_id로 users_subscription 조회
2. 없으면 → 무료 플랜으로 취급
3. 반환: plan, status, expires_at, cancelled_at, created_at
```

### 3.2 플랜별 표시

| 플랜 | 상태 | 표시 |
|------|------|------|
| free | - | "무료 체험" + 남은 분석 횟수 |
| monthly | active | "월 구독" + 만료일 + 해지 버튼 |
| three_month | active | "3개월 패스 (프리미엄)" + 만료일 + 해지 버튼 |
| 모든 유료 | cancelled | "해지됨" + "만료일까지 이용 가능" |
| 모든 유료 | expired | "만료됨" + 구독 갱신 버튼 |

### 3.3 만료일 표시
- 형식: "2026년 3월 28일까지"
- 남은 일수도 표시: "(D-15)"
- 만료일 지남: "만료됨" 빨강 텍스트

### 3.4 기능 제한 안내
| 구분 | 무료 | 유료 (active) | 만료/해지 |
|------|------|---------------|-----------|
| 분석 | "총 1회 (남은 횟수: N회)" | "무제한" | "구독을 갱신해 주세요" |
| 프로젝트 | "1개" | "무제한" | 차단 |
| AI 모델 | "Claude Sonnet" | Sonnet or Opus | - |

---

## 4. 구독 해지 (`cancelSubscription`)

### 4.1 흐름
```
1. "구독 해지" 버튼 클릭
2. 확인 다이얼로그: "정말 구독을 해지하시겠습니까? 만료일까지는 계속 이용 가능합니다."
3. cancelSubscription() 호출:
   a. 구독 정보 조회
   b. 무료 플랜이면 → 에러 ("무료 플랜은 해지할 수 없습니다")
   c. 이미 해지됐으면 → 에러 ("이미 해지된 구독입니다")
   d. 빌링키 있으면 → TossPayments에서 빌링키 삭제
   e. DB 업데이트: status="cancelled", billing_key=null, cancelled_at=now()
4. 성공 메시지: "구독이 해지되었습니다. 만료일까지 계속 이용 가능합니다."
```

### 4.2 해지 후 상태
- 만료일까지: 모든 기능 정상 사용
- 만료일 이후: 무료 플랜과 동일한 제한
- 재구독: 결제 페이지에서 다시 구독 가능

---

## 5. DB 테이블

### users_subscription

| 컬럼 | 타입 | 설명 |
|------|------|------|
| user_id | UUID (PK, FK) | 사용자 ID |
| plan | text | free/monthly/three_month |
| status | text | active/cancelled/expired |
| billing_key | text | TossPayments 빌링키 |
| customer_key | text | 고객 키 |
| payment_id | text | 결제 키 |
| started_at | timestamptz | 구독 시작일 |
| expires_at | timestamptz | 만료일 |
| cancelled_at | timestamptz | 해지일 |

---

## 6. 관련 파일

| 파일 | 역할 |
|------|------|
| `app/mypage/page.tsx` | 구독 상태 UI, 해지 버튼, 확인 다이얼로그 |
| `app/actions/subscription.ts` | getSubscription, cancelSubscription |
| `app/actions/payment.ts` | 빌링키 삭제 (해지 시) |

---

## 7. 크레딧 환불 기능

### 7.1 환불 UI
- 마이페이지 크레딧 게이지 아래에 "크레딧 구매 내역" 섹션 표시
- 각 주문: 패키지명, 결제일, 환불 가능 금액, [환불하기] 버튼
- AlertDialog로 확인: "N원이 환불됩니다. 진행하시겠습니까?"
- 환불 완료 후 게이지/주문 목록 자동 갱신

### 7.2 환불 기준
- 7일 이내 + 미사용 → 전액 환불
- 7일 이내 + 부분 사용 → 사용분 × 2,900원 차감 후 환불
- 7일 경과 또는 전부 사용 → 환불 불가

### 7.3 관련 함수
- `getCreditOrders()`: 환불 가능 주문 목록 + 환불 금액 계산
- `refundCreditOrder(orderId)`: 토스 API 호출 → DB 업데이트 → 크레딧 차감

---

## 8. 알려진 이슈

| 항목 | 설명 |
|------|------|
| expired 자동 처리 없음 | expires_at 지나도 DB의 status가 active 유지 → 클라이언트에서 날짜 비교로 처리 |
| 자동갱신 미구현 | 빌링키는 저장하지만 만료 시 자동 결제하는 cron/webhook 없음 |
| 구독 변경 미구현 | monthly → three_month 업그레이드 등 플랜 변경 불가 (해지 후 재구독만) |
