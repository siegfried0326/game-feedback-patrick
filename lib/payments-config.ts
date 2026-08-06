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
