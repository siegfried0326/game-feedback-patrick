/**
 * 분석 1회 토큰 사용량 → 원가 추정 (서버 전용)
 *
 * 왜: REF_운영비용.md의 "건당 $0.01~0.05"와 PRD의 "400~500원"이 10배 차이 난다.
 * 실제 usage를 기록해야 가격표를 실측 기반으로 조정할 수 있다.
 * analysis_history.token_usage(jsonb)에 저장되고 서버 로그에도 남는다.
 *
 * 단가는 2026-09 기준 Anthropic 공시가 (USD / 100만 토큰). 캐시 쓰기는 입력가의 1.25배.
 */

export interface TokenUsage {
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  /** 추정 원가 (USD) */
  estimated_usd: number
  /** 추정 원가 (KRW, 1달러 = 1,400원 가정) */
  estimated_krw: number
  elapsed_ms?: number
}

interface Price { input: number; output: number; cacheRead: number }

const PRICES: Array<[RegExp, Price]> = [
  [/fable-5/, { input: 10, output: 50, cacheRead: 0.25 }],
  [/opus-5-5/, { input: 4, output: 20, cacheRead: 0.2 }],
  [/opus-5|opus-4-[6-8]|opus-4-7/, { input: 5, output: 25, cacheRead: 0.5 }],
  [/sonnet-5/, { input: 2, output: 10, cacheRead: 0.2 }],
  [/sonnet-4-6/, { input: 3, output: 15, cacheRead: 0.3 }],
  [/sonnet-4/, { input: 3, output: 15, cacheRead: 0.3 }],
  [/haiku-4-5/, { input: 1, output: 5, cacheRead: 0.1 }],
]
const DEFAULT_PRICE: Price = { input: 3, output: 15, cacheRead: 0.3 }
const USD_TO_KRW = 1400

export function priceFor(model: string): Price {
  for (const [rx, p] of PRICES) if (rx.test(model)) return p
  return DEFAULT_PRICE
}

export function summarizeUsage(model: string, usage: {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}, elapsedMs?: number): TokenUsage {
  const p = priceFor(model)
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const cacheWrite = usage.cache_creation_input_tokens ?? 0
  const usd =
    (usage.input_tokens * p.input +
      cacheRead * p.cacheRead +
      cacheWrite * p.input * 1.25 +
      usage.output_tokens * p.output) / 1_000_000
  return {
    model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_input_tokens: cacheRead,
    cache_creation_input_tokens: cacheWrite,
    estimated_usd: Math.round(usd * 10000) / 10000,
    estimated_krw: Math.round(usd * USD_TO_KRW),
    elapsed_ms: elapsedMs,
  }
}

export function logUsage(tag: string, u: TokenUsage): void {
  console.log(
    `[${tag}] model=${u.model} in=${u.input_tokens} cacheRead=${u.cache_read_input_tokens} cacheWrite=${u.cache_creation_input_tokens} out=${u.output_tokens}` +
    ` ≈ $${u.estimated_usd} (약 ${u.estimated_krw.toLocaleString()}원)${u.elapsed_ms ? ` ${Math.round(u.elapsed_ms / 1000)}s` : ""}`
  )
}
