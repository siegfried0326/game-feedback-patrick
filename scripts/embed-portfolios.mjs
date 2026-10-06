// 합격 포트폴리오 원문 기준 재임베딩 (로컬 실행용)
//
// 사용: node --env-file=.env.local scripts/embed-portfolios.mjs [--only-missing]
//
// - portfolios.content_text(원문, 개인정보 제거됨)를 1,800자/200자 겹침으로 청킹
// - OpenAI text-embedding-3-small(1536d)로 임베딩 → portfolio_chunks에 저장
// - 포트폴리오마다 기존 청크를 지우고 새로 넣는다 (lib/vector-search.ts embedAndStorePortfolio와 같은 동작)
// - duplicate_of가 있는 사본은 건너뛴다 (원본만 임베딩 → 같은 발췌가 두 번 나오지 않게)
// - 관리자 페이지 '임베딩 생성'과 같은 결과지만 Vercel 타임아웃 없이 한 번에 처리
//
// 필요: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const openaiKey = process.env.OPENAI_API_KEY
const ONLY_MISSING = process.argv.includes("--only-missing")

if (!url || !key || !openaiKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / OPENAI_API_KEY 중 빠진 것이 있습니다.")
  process.exit(1)
}

const headers = {
  apikey: key,
  ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
  "Content-Type": "application/json",
}

// lib/vector-search.ts chunkText와 동일 규칙
const CHUNK_SIZE = 1800
const CHUNK_OVERLAP = 200
function chunkText(text) {
  if (!text) return []
  if (text.length <= CHUNK_SIZE) return [text]
  const chunks = []
  let start = 0
  while (start < text.length) {
    let end = start + CHUNK_SIZE
    if (end < text.length) {
      const searchStart = Math.max(end - 50, start)
      const area = text.slice(searchStart, Math.min(end + 50, text.length))
      for (const bp of ["\n\n", "\n", ". ", "。", "! ", "? "]) {
        const i = area.lastIndexOf(bp)
        if (i !== -1) { end = searchStart + i + bp.length; break }
      }
    }
    end = Math.min(end, text.length)
    const chunk = text.slice(start, end).trim()
    if (chunk.length > 50) chunks.push(chunk)
    if (end >= text.length) break
    start = end - CHUNK_OVERLAP
  }
  return chunks
}

async function embed(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts, dimensions: 1536 }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return { vectors: data.data.map(d => d.embedding), tokens: data.usage?.total_tokens ?? 0 }
}

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path.split("?")[0]} ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json().catch(() => null)
}

const portfolios = await rest("portfolios?select=id,file_name,companies,content_text,duplicate_of&limit=1000")
let existing = new Set()
if (ONLY_MISSING) {
  const rows = await rest("portfolio_chunks?select=portfolio_id&limit=100000")
  existing = new Set(rows.map(r => r.portfolio_id))
}

let done = 0, skipped = 0, failed = 0, chunksTotal = 0, tokensTotal = 0
for (const p of portfolios) {
  if (p.duplicate_of) {
    // 사본: 청크가 남아 있으면 지운다 (원본 청크만 검색되도록)
    await rest(`portfolio_chunks?portfolio_id=eq.${p.id}`, { method: "DELETE" })
    skipped++
    continue
  }
  if (ONLY_MISSING && existing.has(p.id)) { skipped++; continue }
  const chunks = chunkText(p.content_text ?? "")
  if (chunks.length === 0) { skipped++; continue }
  try {
    await rest(`portfolio_chunks?portfolio_id=eq.${p.id}`, { method: "DELETE" })
    for (let i = 0; i < chunks.length; i += 64) {
      const batch = chunks.slice(i, i + 64)
      const { vectors, tokens } = await embed(batch)
      tokensTotal += tokens
      const rows = batch.map((chunk, j) => ({
        portfolio_id: p.id,
        chunk_index: i + j,
        chunk_text: chunk,
        embedding: JSON.stringify(vectors[j]),
        metadata: { companies: p.companies, source: "original_2026-10" },
      }))
      await rest("portfolio_chunks", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(rows) })
    }
    chunksTotal += chunks.length
    done++
    process.stdout.write(`\r임베딩 ${done}건 / 청크 ${chunksTotal}개`)
  } catch (e) {
    failed++
    console.error(`\n❌ ${p.file_name}: ${e.message}`)
  }
}
const usd = (tokensTotal / 1_000_000) * 0.02
console.log(`\n완료: 임베딩 ${done}건, 건너뜀 ${skipped}건(사본·빈 문서), 실패 ${failed}건 | 청크 ${chunksTotal}개 | 토큰 ${tokensTotal.toLocaleString()} ≈ $${usd.toFixed(4)}`)
