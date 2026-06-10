/**
 * 결제 기능 전역 토글
 *
 * 서비스 일시 중단 시 결제(구독 + 크레딧 구매)를 전면 차단한다.
 * 환불(refundCreditOrder)은 이 플래그의 영향을 받지 않는다 — 닫힌 동안에도 환불은 가능해야 함.
 *
 * ⚠️ 다시 결제를 열 때: PAYMENTS_ENABLED 를 true 로 바꾸고 배포.
 *
 * 2026-06-10: 서비스 재정비를 위해 결제 일시 중단.
 */
export const PAYMENTS_ENABLED = false

/** 결제 차단 시 사용자에게 보여줄 메시지 */
export const PAYMENTS_DISABLED_MESSAGE =
  "현재 결제 서비스를 일시 중단했습니다. 더 나은 모습으로 곧 다시 찾아뵙겠습니다."
