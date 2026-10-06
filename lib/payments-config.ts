/**
 * 결제 기능 전역 토글
 *
 * ── BM 개편 (2026-08-05): 과외 중심 모델 ──
 * - 크레딧 단건 판매: 열림 (PAYMENTS_ENABLED)
 * - 구독(월/3개월) 판매: 영구 종료 (SUBSCRIPTION_SALES_ENABLED)
 *   → "무제한 × 종량 원가" 구조가 적자 위험이라 폐지. 반복 이용자는 과외 수강생 혜택으로 흡수.
 * - 과외생: 관리자가 매월 크레딧 직접 지급 (/admin/students)
 * - 과외비 결제: 사이트 밖(계좌이체 등) — PG 미사용
 *
 * 환불(refundCreditOrder)은 두 플래그와 무관하게 항상 동작한다.
 */

/** 크레딧 단건 결제 (구매+승인) 허용 여부 */
export const PAYMENTS_ENABLED = true

/** 구독(월/3개월) 신규 판매 + 자동 갱신 허용 여부 — BM 개편으로 영구 종료 */
export const SUBSCRIPTION_SALES_ENABLED = false

/** 결제 차단 시 사용자에게 보여줄 메시지 */
export const PAYMENTS_DISABLED_MESSAGE =
  "현재 결제 서비스를 일시 중단했습니다. 더 나은 모습으로 곧 다시 찾아뵙겠습니다."

/** 구독 판매 종료 안내 메시지 */
export const SUBSCRIPTION_ENDED_MESSAGE =
  "구독 상품 판매가 종료되었습니다. 크레딧 구매 또는 1:1 과외 수강생 혜택을 이용해 주세요."

// ────────────────────────────────────────────
// 크레딧 가격표 — 단일 기준값 (docs/PRD_가격표_요금제.md가 원본)
// 2026-10-06 개편: 모델 세대 교체(Opus 5.5 정밀 분석 도입)에 맞춰 단가 조정.
// 서버(payment.ts)와 모든 UI가 이 상수만 참조한다. 가격을 바꿀 땐 PRD 먼저, 그다음 여기만 수정.
// ────────────────────────────────────────────

export type CreditPackageKey = "credit_1" | "credit_5" | "credit_10"

export interface CreditPackage {
  key: CreditPackageKey
  name: string
  credits: number
  /** 결제 금액 (원) */
  price: number
  /** 크레딧당 단가 (원, 반올림) */
  perCredit: number
  /** 1크레딧 정가 대비 할인율 뱃지. 없으면 null */
  badge: string | null
}

/** 1크레딧 정가 — 부분 환불 시 사용분 차감 단가로도 쓰인다 */
export const CREDIT_UNIT_PRICE = 3900

export const CREDIT_PACKAGES: readonly CreditPackage[] = [
  { key: "credit_1", name: "1크레딧", credits: 1, price: 3900, perCredit: 3900, badge: null },
  { key: "credit_5", name: "5크레딧", credits: 5, price: 12900, perCredit: 2580, badge: "34% 할인" },
  { key: "credit_10", name: "10크레딧", credits: 10, price: 19900, perCredit: 1990, badge: "49% 할인" },
] as const

export function getCreditPackage(key: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find(p => p.key === key)
}

/**
 * 2026-10-06 개편 이전 가격으로 산 주문의 사용분 차감 단가.
 * 옛 가격(2,900 / 7,900 / 12,900원)으로 결제한 주문을 새 정가 3,900원으로 차감하면
 * 환불액이 부당하게 줄어들므로, 결제 당시 정가(2,900원)를 적용한다.
 */
const LEGACY_PACKAGE_AMOUNTS = new Set([2900, 7900, 12900])
const LEGACY_UNIT_PRICE = 2900

export function unitPriceForOrder(order: { amount: number; credits: number }): number {
  if (LEGACY_PACKAGE_AMOUNTS.has(order.amount) && order.amount / order.credits < CREDIT_UNIT_PRICE) {
    return LEGACY_UNIT_PRICE
  }
  return CREDIT_UNIT_PRICE
}

export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`
}
