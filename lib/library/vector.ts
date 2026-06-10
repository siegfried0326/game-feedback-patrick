/**
 * 라이브러리 벡터 검색 — portfolio_chunks와 동일 패턴
 *
 *  - chunkText: 1800자 단위 청킹 (lib/vector-search.ts와 동일 알고리즘)
 *  - embedAndStoreDocument: 임베딩 생성 → library_chunks 저장
 *  - searchSimilarLibraryContent: 사용자 쿼리 → 유사 라이브러리 청크
 *  - formatLibraryChunksForPrompt: analyze.ts 프롬프트 주입용
 */

import { chunkText } from "../vector-search"
import { generateEmbedding, generateEmbeddings } from "../openai-embedding"
import { createClient } from "../supabase/server"

const BATCH_SIZE = 20

export interface LibrarySimilarChunk {
  id: string
  libraryDocumentId: string
  chunkText: string
  similarity: number
  docTitle: string
  docType: string
  docDomain: string | null
  docSlug: string
  principleId: string | null
  preview: boolean
}

/**
 * 단일 라이브러리 문서를 청크로 나누고 임베딩 생성 후 DB에 저장
 */
export async function embedAndStoreLibraryDocument(
  documentId: string,
  text: string,
  metadata?: { title?: string; type?: string; domain?: string | null }
): Promise<{ success: boolean; chunksStored: number; error?: string }> {
  try {
    const supabase = await createClient()

    await supabase.from("library_chunks").delete().eq("library_document_id", documentId)

    const chunks = chunkText(text)
    if (chunks.length === 0) {
      return { success: false, chunksStored: 0, error: "텍스트가 너무 짧습니다." }
    }

    let stored = 0
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const embeddings = await generateEmbeddings(batch)
      const rows = batch.map((chunk, idx) => ({
        library_document_id: documentId,
        chunk_index: i + idx,
        chunk_text: chunk,
        embedding: JSON.stringify(embeddings[idx]),
        metadata: metadata || {},
      }))
      const { error } = await supabase.from("library_chunks").insert(rows)
      if (error) {
        console.error(`[library-vector] 저장 실패 (batch ${i}):`, error.message)
        continue
      }
      stored += batch.length
    }
    return { success: true, chunksStored: stored }
  } catch (err) {
    return {
      success: false,
      chunksStored: 0,
      error: err instanceof Error ? err.message : "임베딩 저장 실패",
    }
  }
}

/**
 * 사용자 문서 텍스트로 유사한 라이브러리 원칙 검색
 */
export async function searchSimilarLibraryContent(
  queryText: string,
  options: {
    matchCount?: number
    matchThreshold?: number
    types?: string[]
    domains?: string[]
  } = {}
): Promise<{ chunks: LibrarySimilarChunk[]; error?: string }> {
  const {
    matchCount = 5,
    matchThreshold = 0.3,
    types = null,
    domains = null,
  } = options
  try {
    const queryEmbedding = await generateEmbedding(queryText.slice(0, 2000))
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("match_library_chunks", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter_types: types,
      filter_domains: domains,
    })
    if (error) {
      console.error("[library-vector] 검색 실패:", error.message)
      return { chunks: [], error: error.message }
    }
    if (!data) return { chunks: [] }
    return {
      chunks: data.map(
        (r: {
          id: string
          library_document_id: string
          chunk_text: string
          similarity: number
          doc_title: string
          doc_type: string
          doc_domain: string | null
          doc_slug: string
          principle_id: string | null
          preview: boolean
        }) => ({
          id: r.id,
          libraryDocumentId: r.library_document_id,
          chunkText: r.chunk_text,
          similarity: r.similarity,
          docTitle: r.doc_title,
          docType: r.doc_type,
          docDomain: r.doc_domain,
          docSlug: r.doc_slug,
          principleId: r.principle_id,
          preview: r.preview,
        })
      ),
    }
  } catch (err) {
    console.error("[library-vector] searchSimilarLibraryContent 실패:", err)
    return {
      chunks: [],
      error: err instanceof Error ? err.message : "벡터 검색 실패",
    }
  }
}

/**
 * 분석 프롬프트에 주입할 텍스트로 포맷
 *  - 청크들을 문서별로 그룹핑
 *  - Claude가 인용할 수 있도록 `[ID]` 형식 라벨 부착
 */
export function formatLibraryChunksForPrompt(chunks: LibrarySimilarChunk[]): string {
  if (chunks.length === 0) return ""

  const grouped = new Map<
    string,
    {
      title: string
      type: string
      domain: string | null
      principleId: string | null
      texts: string[]
    }
  >()

  for (const c of chunks) {
    if (!grouped.has(c.libraryDocumentId)) {
      grouped.set(c.libraryDocumentId, {
        title: c.docTitle,
        type: c.docType,
        domain: c.docDomain,
        principleId: c.principleId,
        texts: [],
      })
    }
    grouped.get(c.libraryDocumentId)!.texts.push(c.chunkText)
  }

  const sections = Array.from(grouped.entries()).map(([id, g]) => {
    const label = g.principleId || id
    const meta = [g.type, g.domain].filter(Boolean).join(" · ")
    return `### [${label}] ${g.title} (${meta})
${g.texts.join("\n\n---\n\n")}`
  })

  return `
## 🎮 게임 디자인 라이브러리 — 관련 원칙·패턴 발췌

아래는 분석 중인 문서와 의미적으로 가까운 **게임 디자인 라이브러리** 항목들의 발췌다. 187개 합격 포트폴리오 데이터와 별개로, 사쿠라이·팀 케인·미야자키 등 ${Array.from(grouped.values()).length}개 원칙·패턴이 매칭되었다.

피드백 작성 시 가능하면 **대괄호 라벨로 인용**(예: [${chunks[0].principleId || "PRIN-..."}])하여 사용자가 라이브러리로 깊이 들어갈 수 있도록 안내하라.

${sections.join("\n\n")}

---
`
}
