/**
 * content/library/documents.json → Supabase library_documents 테이블 적재
 *
 * 실행:
 *   1. scripts/018_create_library.sql 을 Supabase SQL Editor에서 실행
 *   2. node scripts/seed-library-db.mjs
 *
 * 환경변수 필요:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (또는 SUPABASE_SERVICE_KEY)
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

// 실행: node --env-file=.env.local scripts/seed-library-db.mjs

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, "..")

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[library-seed] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 필요")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const docsPath = path.join(PROJECT_ROOT, "content", "library", "documents.json")
  if (!fs.existsSync(docsPath)) {
    console.error(`[library-seed] ${docsPath} 없음 — node scripts/import-library.mjs 먼저 실행`)
    process.exit(1)
  }
  const docs = JSON.parse(fs.readFileSync(docsPath, "utf-8"))
  console.log(`[library-seed] 문서: ${docs.length}편`)

  // 청크 단위로 upsert
  const BATCH = 100
  let upserted = 0
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH).map((d) => ({
      id: d.id,
      slug: d.slug,
      type: d.type,
      domain: d.domain,
      title: d.title,
      title_en: d.titleEn,
      principle_id: d.principleId,
      status: d.status,
      preview: d.preview === true,
      body: d.body,
      body_length: d.bodyLength || 0,
      frontmatter: {
        aliases: d.aliases,
        sources: d.sources,
        relatedPrinciples: d.relatedPrinciples,
        sourceConfidence: d.sourceConfidence,
        notableWorks: d.notableWorks,
        roles: d.roles,
        domains: d.domains,
        url: d.url,
        sourceType: d.sourceType,
        creator: d.creator,
        language: d.language,
        severity: d.severity,
        year: d.year,
        category: d.category,
        sourceFolder: d.sourceFolder,
      },
      tags: d.tags || [],
      designers: d.designers || [],
      games_referenced: d.gamesReferenced || [],
      aliases: d.aliases || [],
      vault_path: d.filePath,
      vault_created: d.created,
      vault_updated: d.updated,
    }))

    const { error } = await supabase
      .from("library_documents")
      .upsert(batch, { onConflict: "id" })

    if (error) {
      console.error(`[library-seed] 배치 ${i}~${i + batch.length} 실패:`, error.message)
      continue
    }
    upserted += batch.length
    console.log(`[library-seed] ${upserted}/${docs.length}`)
  }

  console.log(`[library-seed] 완료: ${upserted}편 upsert`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
