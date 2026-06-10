/**
 * library_documents → library_chunks 임베딩 일괄 생성
 *
 * 실행:
 *   1. scripts/seed-library-db.mjs 먼저 (문서 적재)
 *   2. node scripts/embed-library.mjs [--force] [--limit=N] [--type=principle]
 *
 * 처음 실행 시 1243개 문서 = 비용 추산: text-embedding-3-small (~$0.02/1M tokens)
 *   평균 본문 ~1500자 × 1243 ≈ 47만 토큰 → 약 $0.01. 거의 무료.
 *
 * 환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 */

import { createClient } from "@supabase/supabase-js"

// 실행: node --env-file=.env.local scripts/embed-library.mjs [--force] [--limit=N] [--type=principle]

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_API_KEY) {
  console.error("[embed-library] 필수 환경변수 부족: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / OPENAI_API_KEY")
  process.exit(1)
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=")
      return [k, v ?? true]
    }
    return [a, true]
  })
)
const FORCE = !!args.force
const LIMIT = args.limit ? Number(args.limit) : Infinity
const TYPE_FILTER = args.type || null

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const CHUNK_SIZE = 1800
const CHUNK_OVERLAP = 200
const BATCH_SIZE = 20

function chunkText(text) {
  if (!text || text.length === 0) return []
  if (text.length <= CHUNK_SIZE) return [text]
  const chunks = []
  let start = 0
  while (start < text.length) {
    let end = start + CHUNK_SIZE
    if (end < text.length) {
      const searchStart = Math.max(end - 50, start)
      const searchEnd = Math.min(end + 50, text.length)
      const area = text.slice(searchStart, searchEnd)
      const breakPoints = ["\n\n", "\n", ". ", "。", "! ", "? "]
      for (const bp of breakPoints) {
        const idx = area.lastIndexOf(bp)
        if (idx !== -1) {
          end = searchStart + idx + bp.length
          break
        }
      }
    }
    end = Math.min(end, text.length)
    const chunk = text.slice(start, end).trim()
    if (chunk.length > 50) chunks.push(chunk)
    if (end >= text.length) break
    start = end - CHUNK_OVERLAP
    if (start >= text.length) break
  }
  return chunks
}

async function embedBatch(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 200)}`)
  }
  const json = await res.json()
  return json.data.map((d) => d.embedding)
}

async function main() {
  console.log(`[embed-library] force=${FORCE} limit=${LIMIT} type=${TYPE_FILTER || "(all)"}`)

  // 1. 문서 목록 (본문이 있어야 임베딩)
  let q = supabase
    .from("library_documents")
    .select("id, type, domain, title, body, body_length")
    .order("body_length", { ascending: false })
  if (TYPE_FILTER) q = q.eq("type", TYPE_FILTER)
  const { data: docs, error: err1 } = await q
  if (err1) {
    console.error("[embed-library] 문서 조회 실패:", err1.message)
    process.exit(1)
  }

  // 2. 이미 임베딩된 문서 ID
  let already = new Set()
  if (!FORCE) {
    const { data: existing } = await supabase
      .from("library_chunks")
      .select("library_document_id")
    if (existing) already = new Set(existing.map((c) => c.library_document_id))
  }

  const toProcess = docs.filter((d) => {
    if (!d.body || d.body.length < 100) return false
    if (!FORCE && already.has(d.id)) return false
    return true
  }).slice(0, LIMIT)

  console.log(`[embed-library] 전체 ${docs.length}, 이미 ${already.size}, 처리 ${toProcess.length}`)

  let processed = 0
  let failed = 0
  for (const doc of toProcess) {
    try {
      const chunks = chunkText(doc.body)
      if (chunks.length === 0) continue

      // 기존 청크 제거
      if (FORCE) {
        await supabase.from("library_chunks").delete().eq("library_document_id", doc.id)
      }

      let stored = 0
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE)
        const embeddings = await embedBatch(batch)
        const rows = batch.map((chunk, idx) => ({
          library_document_id: doc.id,
          chunk_index: i + idx,
          chunk_text: chunk,
          embedding: JSON.stringify(embeddings[idx]),
          metadata: { title: doc.title, type: doc.type, domain: doc.domain },
        }))
        const { error } = await supabase.from("library_chunks").insert(rows)
        if (error) {
          console.error(`  - ${doc.id} batch ${i} 실패: ${error.message}`)
          continue
        }
        stored += batch.length
      }
      processed += 1
      console.log(`[${processed}/${toProcess.length}] ${doc.id} → ${stored} chunks`)
      await new Promise((r) => setTimeout(r, 200)) // rate 보호
    } catch (e) {
      failed += 1
      console.error(`[embed-library] ${doc.id} 실패:`, e.message)
    }
  }

  console.log(`\n[embed-library] 완료: 처리 ${processed} / 실패 ${failed} / 건너뜀 ${already.size}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
