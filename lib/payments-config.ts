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
// 2026-10-07 개편: 묶음 1/5/10 → 1/10/30. 5크레딧 판매 종료 (옛 credit_5 주문은 환불 처리만).
// 40쪽 초과 문서의 추가 차감 규칙은 lib/analysis/pages.ts.
// 서버(payment.ts)와 모든 UI가 이 상수만 참조한다. 가격을 바꿀 땐 PRD 먼저, 그다음 여기만 수정.
// ────────────────────────────────────────────

export type CreditPackageKey = "credit_1" | "credit_10" | "credit_30"

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
  { key: "credit_10", name: "10크레딧", credits: 10, price: 19900, perCredit: 1990, badge: "49% 할인" },
  { key: "credit_30", name: "30크레딧", credits: 30, price: 44900, perCredit: 1497, badge: "62% 할인" },
] as const

export function getCreditPackage(key: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find(p => p.key === key)
}

/** 주문 내역 표시용 패키지 이름 — 판매 종료된 옛 패키지(credit_5)도 포함 */
export function packageLabel(packageType: string): string {
  if (packageType === "credit_5") return "5크레딧"
  return getCreditPackage(packageType)?.name ?? packageType
}

/**
 * 2026-10-06 개편 이전 가격으로 산 주문의 사용분 차감 단가.
 * 옛 가격(1회 2,900 / 5회 7,900 / 10회 12,900원)으로 결제한 주문을 새 정가 3,900원으로 차감하면
 * 환불액이 부당하게 줄어들므로, 결제 당시 정가(2,900원)를 적용한다.
 * 12,900원은 10-06~10-07 사이 5크레딧 가격과 겹치므로 금액+크레딧 수로 판별한다.
 */
const LEGACY_PACKAGES = new Set(["2900:1", "7900:5", "12900:10"])
const LEGACY_UNIT_PRICE = 2900

export function unitPriceForOrder(order: { amount: number; credits: number }): number {
  return LEGACY_PACKAGES.has(`${order.amount}:${order.credits}`) ? LEGACY_UNIT_PRICE : CREDIT_UNIT_PRICE
}

export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`
}
