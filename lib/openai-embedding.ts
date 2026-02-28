/**
 * OpenAI 임베딩 생성 유틸리티
 *
 * OpenAI text-embedding-3-small 모델로 텍스트를 1536차원 벡터로 변환.
 * 벡터 서치(유사 포트폴리오 검색)의 핵심 컴포넌트.
 *
 * 사용처:
 * - 관리자 포트폴리오 업로드 시 → 텍스트 청크 임베딩 생성
 * - 사용자 분석 시 → 사용자 문서 임베딩 생성 → 유사 검색
 *
 * 비용: ~$0.02/1M 토큰 (거의 무료 수준)
 * 차원: 1536 (text-embedding-3-small)
 *
 * 환경변수: OPENAI_API_KEY
 */

// OpenAI 임베딩 모델 설정
const EMBEDDING_MODEL = "text-embedding-3-small"
const EMBEDDING_DIMENSIONS = 1536

/** 임베딩 차원 수 — 외부에서 참조용 */
export const VECTOR_DIMENSIONS = EMBEDDING_DIMENSIONS

/**
 * 단일 텍스트를 벡터(임베딩)로 변환
 *
 * @param text - 변환할 텍스트 (최대 ~30,000자까지 처리)
 * @returns 1536차원 숫자 배열
 * @throws OPENAI_API_KEY 미설정 또는 API 오류 시
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.")
  }

  // 텍스트 길이 제한 (8191 토큰 ≈ ~30,000자 한국어 기준)
  const truncatedText = text.slice(0, 30000)

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: truncatedText,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `OpenAI 임베딩 생성 실패: ${error?.error?.message || response.statusText}`
    )
  }

  const data = await response.json()
  return data.data[0].embedding
}

/**
 * 여러 텍스트를 한번에 벡터로 변환 (배치 처리)
 * OpenAI API를 1회만 호출하므로 개별 호출보다 효율적.
 *
 * @param texts - 변환할 텍스트 배열 (각각 최대 ~30,000자)
 * @returns 각 텍스트의 1536차원 벡터 배열
 * @throws OPENAI_API_KEY 미설정 또는 API 오류 시
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.")
  }

  if (texts.length === 0) return []

  // 각 텍스트 길이 제한
  const truncatedTexts = texts.map(t => t.slice(0, 30000))

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: truncatedTexts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `OpenAI 임베딩 배치 생성 실패: ${error?.error?.message || response.statusText}`
    )
  }

  const data = await response.json()

  // index 순서대로 정렬하여 반환 (OpenAI가 순서 보장하지 않을 수 있음)
  return data.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((item: { embedding: number[] }) => item.embedding)
}
