/**
 * 분석 모델 티어 정의
 *
 * - basic:     Sonnet 5.5 — 기본 분석, 1크레딧
 * - precision: Opus 5.5 (effort high) — 정밀 분석, 2크레딧
 * - classifier: Haiku 4.5 — 1단계 문서 스캔(직군·키워드), 크레딧 소모 없음
 *
 * 모델 ID는 환경변수로 덮어쓸 수 있다 (골든셋 비교 실험용):
 *   ANALYSIS_MODEL_BASIC / ANALYSIS_MODEL_PRECISION / ANALYSIS_MODEL_CLASSIFIER
 *
 * 클라이언트·서버 공용 (환경변수 읽기는 서버에서만 의미 있음 — 클라이언트 번들에서는 기본값).
 */

export type ModelTier = "basic" | "precision"

export interface ModelTierInfo {
  tier: ModelTier
  label: string
  description: string
  /** 분석 1회에 차감되는 크레딧 수 */
  creditCost: number
  /** 기본 모델 ID (환경변수로 덮어쓰기 가능) */
  defaultModel: string
  /** output_config.effort — Opus 5.5 기본값은 medium이라 명시적으로 지정한다 */
  effort: "low" | "medium" | "high"
}

export const MODEL_TIERS: Record<ModelTier, ModelTierInfo> = {
  basic: {
    tier: "basic",
    label: "기본 분석",
    description: "15개 항목 점수·강점/보완점·회사별 비교",
    creditCost: 1,
    defaultModel: "claude-sonnet-5-5",
    effort: "medium",
  },
  precision: {
    tier: "precision",
    label: "정밀 분석",
    description: "상위 모델이 더 깊게 읽고 근거를 더 촘촘히 제시",
    creditCost: 2,
    defaultModel: "claude-opus-5-5",
    effort: "high",
  },
}

export const CLASSIFIER_DEFAULT_MODEL = "claude-haiku-4-5"

export const DEFAULT_TIER: ModelTier = "basic"

export function isModelTier(value: unknown): value is ModelTier {
  return value === "basic" || value === "precision"
}

/** 서버 전용: 환경변수 오버라이드를 반영한 실제 모델 ID */
export function resolveModelId(tier: ModelTier): string {
  const env = tier === "basic" ? process.env.ANALYSIS_MODEL_BASIC : process.env.ANALYSIS_MODEL_PRECISION
  return env && env.trim().length > 0 ? env.trim() : MODEL_TIERS[tier].defaultModel
}

export function resolveClassifierModelId(): string {
  const env = process.env.ANALYSIS_MODEL_CLASSIFIER
  return env && env.trim().length > 0 ? env.trim() : CLASSIFIER_DEFAULT_MODEL
}
