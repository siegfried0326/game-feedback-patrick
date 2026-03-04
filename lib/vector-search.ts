/**
 * 벡터 서치 유틸리티 (서버 전용)
 *
 * 포트폴리오 텍스트를 청크로 나누고, OpenAI 임베딩을 생성하여 Supabase에 저장.
 * 사용자 문서 분석 시 유사한 포트폴리오 내용을 검색하여
 * AI에게 실제 합격 포트폴리오 내용을 제공.
 *
 * 주요 함수:
 * - chunkText(): 텍스트를 겹치는 청크로 분할 (1800자 단위, 200자 겹침)
 * - embedAndStorePortfolio(): 포트폴리오 텍스트 → 청크 → 임베딩 → DB 저장
 * - embedAllPortfolios(): 기존 포트폴리오 일괄 임베딩 (관리자 배치 작업)
 * - searchSimilarContent(): 사용자 문서 텍스트로 유사 포트폴리오 검색
 * - deletePortfolioChunks(): 포트폴리오 삭제 시 청크도 삭제
 *
 * 의존성: lib/openai-embedding.ts, lib/supabase/server.ts
 */

import { generateEmbedding, generateEmbeddings } from "./openai-embedding"
import { createClient } from "./supabase/server"

// ========== 설정값 ==========
// 청크 크기: 1800자 (~450토큰, 게임기획 문서의 문맥 보존에 유리)
const CHUNK_SIZE = 1800
// 청크 겹침: 200자 (문장이 청크 경계에서 잘리는 문제 방지)
const CHUNK_OVERLAP = 200
// 배치 임베딩 크기: 한 번에 최대 20개 처리 (OpenAI API 안정성)
const BATCH_SIZE = 20

// ========== 타입 정의 ==========

/** 벡터 검색 결과 */
export interface SimilarChunk {
  id: string
  portfolioId: string
  chunkText: string
  similarity: number
  fileName?: string
  companies?: string[]
}

// ========== 텍스트 청킹 ==========

/**
 * 텍스트를 겹치는 청크로 분할
 *
 * 긴 문서를 벡터 검색 가능한 크기(1800자, ~450토큰)로 나눔.
 * 문장 경계(줄바꿈, 마침표)에서 자르기를 시도하여 의미 단위 유지.
 *
 * @param text - 원본 텍스트
 * @param chunkSize - 각 청크의 목표 크기 (기본 1800자)
 * @param overlap - 청크 간 겹치는 부분 (기본 200자)
 * @returns 청크 텍스트 배열
 */
export function chunkText(
  text: string,
  chunkSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP,
): string[] {
  if (!text || text.length === 0) return []
  if (text.length <= chunkSize) return [text]

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + chunkSize

    // 문장/문단 경계에서 자르기 (±50자 범위에서 탐색)
    if (end < text.length) {
      const searchStart = Math.max(end - 50, start)
      const searchEnd = Math.min(end + 50, text.length)
      const searchArea = text.slice(searchStart, searchEnd)

      // 우선순위: 빈 줄 > 줄바꿈 > 마침표 > 물음표/느낌표
      const breakPoints = ["\n\n", "\n", ". ", "。", "! ", "? "]
      for (const bp of breakPoints) {
        const idx = searchArea.lastIndexOf(bp)
        if (idx !== -1) {
          end = searchStart + idx + bp.length
          break
        }
      }
    }

    end = Math.min(end, text.length)
    const chunk = text.slice(start, end).trim()

    // 너무 짧은 청크 제외 (의미 없는 조각 방지)
    if (chunk.length > 50) {
      chunks.push(chunk)
    }

    // 텍스트 끝에 도달했으면 종료 (무한 루프 방지)
    // 800~900자 텍스트에서 end가 항상 text.length로 고정되어
    // start = end - overlap이 같은 값을 반복하는 버그 수정
    if (end >= text.length) break

    // 다음 청크 시작점 (겹침 적용)
    start = end - overlap
    if (start >= text.length) break
  }

  return chunks
}

// ========== 임베딩 저장 ==========

/**
 * 단일 포트폴리오를 청크로 나누고 임베딩 생성 후 DB에 저장
 *
 * 관리자가 포트폴리오 업로드 시, 또는 기존 포트폴리오 일괄 처리 시 호출.
 * 이미 저장된 청크가 있으면 삭제 후 재생성 (재임베딩).
 *
 * @param portfolioId - portfolios 테이블의 UUID
 * @param text - 포트폴리오 텍스트 (content_text 또는 메타데이터 조합)
 * @param metadata - 추가 정보 (회사명, 문서유형, 파일명)
 * @returns 성공 여부 + 저장된 청크 수
 */
export async function embedAndStorePortfolio(
  portfolioId: string,
  text: string,
  metadata?: { companies?: string[]; documentType?: string; fileName?: string },
): Promise<{ success: boolean; chunksStored: number; error?: string }> {
  try {
    const supabase = await createClient()

    // 기존 청크 삭제 (재임베딩 대비)
    await supabase
      .from("portfolio_chunks")
      .delete()
      .eq("portfolio_id", portfolioId)

    // 텍스트를 청크로 분할
    const chunks = chunkText(text)
    if (chunks.length === 0) {
      return { success: false, chunksStored: 0, error: "텍스트가 너무 짧습니다." }
    }

    let storedCount = 0

    // 배치 단위로 임베딩 생성 + DB 저장
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)

      // OpenAI API로 배치 임베딩 생성
      const embeddings = await generateEmbeddings(batch)

      // DB에 청크 + 임베딩 저장
      const rows = batch.map((chunk, idx) => ({
        portfolio_id: portfolioId,
        chunk_index: i + idx,
        chunk_text: chunk,
        // Supabase pgvector는 JSON 배열 문자열로 벡터를 받음
        embedding: JSON.stringify(embeddings[idx]),
        metadata: metadata || {},
      }))

      const { error } = await supabase
        .from("portfolio_chunks")
        .insert(rows)

      if (error) {
        console.error(`[vector-search] 청크 저장 실패 (batch ${i}):`, error.message)
        continue
      }

      storedCount += batch.length
    }

    console.log(`[vector-search] 포트폴리오 ${portfolioId}: ${storedCount}개 청크 저장 완료`)
    return { success: true, chunksStored: storedCount }
  } catch (error) {
    console.error("[vector-search] embedAndStorePortfolio 실패:", error)
    return {
      success: false,
      chunksStored: 0,
      error: error instanceof Error ? error.message : "임베딩 저장 실패",
    }
  }
}

/**
 * 기존 포트폴리오 일괄 임베딩 (관리자 배치 작업)
 *
 * ⚠️ Vercel 타임아웃 방지를 위해 한 번에 최대 10개만 처리.
 * "신규 임베딩 생성" 버튼을 여러 번 클릭하면 전체 완료됨.
 *
 * content_text가 있으면 그것을 사용, 없으면 메타데이터(요약+강점+약점+태그)로 대체.
 * 이미 청크가 있는 포트폴리오는 건너뜀 (force=true로 재처리 가능).
 *
 * @param force - true면 이미 임베딩된 것도 재처리
 * @param batchLimit - 한 번에 처리할 최대 개수 (기본 10, Vercel 타임아웃 방지)
 * @returns 처리 결과 요약 + 남은 개수
 */
export async function embedAllPortfolios(
  force: boolean = false,
  batchLimit: number = 10,
): Promise<{
  total: number
  processed: number
  skipped: number
  failed: number
  remaining: number
  errors: string[]
}> {
  // ========== 1단계: 사전 체크 ==========

  // OPENAI_API_KEY 확인
  if (!process.env.OPENAI_API_KEY) {
    return {
      total: 0, processed: 0, skipped: 0, failed: 0, remaining: 0,
      errors: ["OPENAI_API_KEY가 설정되지 않았습니다. Vercel 환경변수에 추가해주세요."],
    }
  }

  const supabase = await createClient()

  // portfolio_chunks 테이블 존재 여부 확인
  const { error: tableCheckError } = await supabase
    .from("portfolio_chunks")
    .select("id")
    .limit(1)

  if (tableCheckError) {
    return {
      total: 0, processed: 0, skipped: 0, failed: 0, remaining: 0,
      errors: [`portfolio_chunks 테이블이 없습니다. Supabase SQL Editor에서 011_add_vector_search.sql을 실행해주세요. (${tableCheckError.message})`],
    }
  }

  // ========== 2단계: 포트폴리오 조회 ==========

  const { data: portfolios, error } = await supabase
    .from("portfolios")
    .select("id, file_name, companies, document_type, content_text, summary, strengths, weaknesses, tags")
    .order("created_at", { ascending: true })

  if (error || !portfolios) {
    return { total: 0, processed: 0, skipped: 0, failed: 0, remaining: 0, errors: [error?.message || "조회 실패"] }
  }

  // 이미 임베딩된 포트폴리오 ID 목록 (force가 아닐 때 스킵용)
  let existingPortfolioIds = new Set<string>()
  if (!force) {
    const { data: existingChunks } = await supabase
      .from("portfolio_chunks")
      .select("portfolio_id")
    if (existingChunks) {
      existingPortfolioIds = new Set(existingChunks.map(c => c.portfolio_id))
    }
  }

  // ========== 3단계: 처리 대상 필터링 ==========

  const toProcess: typeof portfolios = []
  let textSkipped = 0

  for (const portfolio of portfolios) {
    // 이미 임베딩되어 있으면 스킵
    if (!force && existingPortfolioIds.has(portfolio.id)) {
      continue
    }

    // 텍스트 확보 가능한지 확인
    let text = portfolio.content_text
    if (!text || text.trim().length < 50) {
      const parts: string[] = []
      if (portfolio.file_name) parts.push(`파일: ${portfolio.file_name}`)
      if (portfolio.document_type) parts.push(`문서유형: ${portfolio.document_type}`)
      if (portfolio.companies?.length) parts.push(`회사: ${portfolio.companies.join(", ")}`)
      if (portfolio.summary) parts.push(`요약: ${portfolio.summary}`)
      if (portfolio.strengths?.length) parts.push(`강점: ${portfolio.strengths.join(". ")}`)
      if (portfolio.weaknesses?.length) parts.push(`약점: ${portfolio.weaknesses.join(". ")}`)
      if (portfolio.tags?.length) parts.push(`키워드: ${portfolio.tags.join(", ")}`)
      text = parts.join("\n\n")
    }

    if (!text || text.trim().length < 30) {
      textSkipped++
      continue
    }

    toProcess.push(portfolio)
  }

  // ========== 4단계: 배치 처리 (최대 batchLimit개) ==========

  const batch = toProcess.slice(0, batchLimit)
  const remaining = toProcess.length - batch.length

  const result = {
    total: portfolios.length,
    processed: 0,
    skipped: existingPortfolioIds.size + textSkipped,
    failed: 0,
    remaining,
    errors: [] as string[],
  }

  for (const portfolio of batch) {
    // 텍스트 확보
    let text = portfolio.content_text
    if (!text || text.trim().length < 50) {
      const parts: string[] = []
      if (portfolio.file_name) parts.push(`파일: ${portfolio.file_name}`)
      if (portfolio.document_type) parts.push(`문서유형: ${portfolio.document_type}`)
      if (portfolio.companies?.length) parts.push(`회사: ${portfolio.companies.join(", ")}`)
      if (portfolio.summary) parts.push(`요약: ${portfolio.summary}`)
      if (portfolio.strengths?.length) parts.push(`강점: ${portfolio.strengths.join(". ")}`)
      if (portfolio.weaknesses?.length) parts.push(`약점: ${portfolio.weaknesses.join(". ")}`)
      if (portfolio.tags?.length) parts.push(`키워드: ${portfolio.tags.join(", ")}`)
      text = parts.join("\n\n")
    }

    try {
      const embedResult = await embedAndStorePortfolio(
        portfolio.id,
        text!,
        {
          companies: portfolio.companies,
          documentType: portfolio.document_type,
          fileName: portfolio.file_name,
        },
      )

      if (embedResult.success) {
        result.processed++
      } else {
        result.failed++
        result.errors.push(`${portfolio.file_name}: ${embedResult.error}`)
      }

      // API 속도 제한 방지 — 포트폴리오 간 500ms 대기
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (err) {
      result.failed++
      result.errors.push(`${portfolio.file_name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`[vector-search] 배치 임베딩 완료: 처리 ${result.processed}, 남은 ${result.remaining}개`)
  return result
}

// ========== 유사도 검색 ==========

/**
 * 사용자 문서 텍스트로 유사한 포트폴리오 내용 검색
 *
 * 사용자의 문서 텍스트 일부(~2000자)를 임베딩으로 변환하고,
 * Supabase pgvector에서 코사인 유사도 기반으로 가장 유사한 청크를 찾음.
 *
 * @param queryText - 사용자 문서 텍스트 (처음 ~2000자 사용)
 * @param matchCount - 반환할 최대 결과 수 (기본 5)
 * @param matchThreshold - 최소 유사도 (0~1, 기본 0.3 — 낮을수록 더 많은 결과)
 * @returns 유사한 포트폴리오 청크 배열
 */
export async function searchSimilarContent(
  queryText: string,
  matchCount: number = 5,
  matchThreshold: number = 0.3,
): Promise<{ chunks: SimilarChunk[]; error?: string }> {
  try {
    // 쿼리 텍스트 앞부분으로 임베딩 생성 (비용 절감)
    const querySnippet = queryText.slice(0, 2000)
    const queryEmbedding = await generateEmbedding(querySnippet)

    // Supabase RPC로 유사도 검색
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("match_portfolio_chunks", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: matchThreshold,
      match_count: matchCount,
    })

    if (error) {
      console.error("[vector-search] 유사도 검색 실패:", error.message)
      return { chunks: [], error: error.message }
    }

    if (!data || data.length === 0) {
      return { chunks: [] }
    }

    // 결과에 포트폴리오 메타데이터 추가 (파일명, 회사명)
    const portfolioIds = [...new Set(data.map((r: { portfolio_id: string }) => r.portfolio_id))]
    const { data: portfolioMeta } = await supabase
      .from("portfolios")
      .select("id, file_name, companies")
      .in("id", portfolioIds)

    const metaMap = new Map(
      (portfolioMeta || []).map(p => [p.id, { fileName: p.file_name, companies: p.companies }])
    )

    return {
      chunks: data.map((row: { id: string; portfolio_id: string; chunk_text: string; similarity: number }) => {
        const meta = metaMap.get(row.portfolio_id)
        return {
          id: row.id,
          portfolioId: row.portfolio_id,
          chunkText: row.chunk_text,
          similarity: row.similarity,
          fileName: meta?.fileName,
          companies: meta?.companies,
        }
      }),
    }
  } catch (error) {
    // OPENAI_API_KEY 없거나 pgvector 미설정 시 — 에러 로그만 남기고 빈 결과 반환
    // 벡터 검색 실패해도 기존 분석은 정상 진행되어야 함
    console.error("[vector-search] searchSimilarContent 실패:", error)
    return {
      chunks: [],
      error: error instanceof Error ? error.message : "벡터 검색 실패",
    }
  }
}

/**
 * 포트폴리오 삭제 시 관련 청크도 삭제
 *
 * portfolio_chunks 테이블에 ON DELETE CASCADE 설정이 있어 자동 삭제되지만,
 * 명시적 삭제가 필요한 경우 사용.
 *
 * @param portfolioId - 삭제할 포트폴리오 ID
 */
export async function deletePortfolioChunks(portfolioId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from("portfolio_chunks")
    .delete()
    .eq("portfolio_id", portfolioId)
}

/**
 * 벡터 검색 결과를 AI 프롬프트용 텍스트로 포맷
 *
 * 검색된 유사 청크들을 시스템 프롬프트에 삽입 가능한 형태로 변환.
 * 중복 포트폴리오의 청크는 합쳐서 보여줌.
 *
 * @param chunks - searchSimilarContent() 결과
 * @returns 프롬프트에 삽입할 텍스트
 */
export function formatChunksForPrompt(chunks: SimilarChunk[]): string {
  if (chunks.length === 0) return ""

  // 포트폴리오별로 그룹화
  const grouped = new Map<string, { fileName: string; companies: string[]; texts: string[] }>()

  for (const chunk of chunks) {
    const key = chunk.portfolioId
    if (!grouped.has(key)) {
      grouped.set(key, {
        fileName: chunk.fileName || "알 수 없는 파일",
        companies: chunk.companies || [],
        texts: [],
      })
    }
    grouped.get(key)!.texts.push(chunk.chunkText)
  }

  // 프롬프트 텍스트 생성
  const sections = Array.from(grouped.entries()).map(([, group], idx) => {
    const companiesStr = group.companies.length > 0
      ? ` (${group.companies.join(", ")} 합격)`
      : ""
    return `### 유사 사례 ${idx + 1}: ${group.fileName}${companiesStr}
${group.texts.join("\n\n---\n\n")}`
  })

  return `
## 📝 유사 합격 포트폴리오 실제 내용 발췌
아래는 현재 분석 중인 문서와 **내용이 가장 유사한** 합격 포트폴리오의 실제 텍스트입니다.
이 내용을 직접 참고하여 현재 문서와 비교 분석하세요.

${sections.join("\n\n")}

---
위 유사 사례의 **실제 작성 방식, 구조, 표현**을 참고하여 현재 문서를 비교 평가하세요.
`
}
