/**
 * 라이브러리 데이터 서버 로더
 *
 * content/library/*.json을 메모리 캐시하여 서버 컴포넌트/API에서 사용.
 * 빌드 시점에 import한 정적 JSON이므로 fs.readFile 한 번 + 모듈 캐시.
 */

import fs from "node:fs/promises"
import path from "node:path"
import {
  AliasMap,
  LibraryDocument,
  LibraryGraph,
  LibraryIndex,
  LibrarySummary,
  LibraryType,
} from "./types"
import { getDocumentUrl, getDocumentUrlById } from "./routes"

export { getDocumentUrl, getDocumentUrlById }

const CONTENT_DIR = path.join(process.cwd(), "content", "library")

// 메모리 캐시 (모듈 단위, Node 프로세스 내 공유)
let indexCache: LibraryIndex | null = null
let aliasMapCache: AliasMap | null = null
const byTypeCache = new Map<LibraryType, LibraryDocument[]>()
const bySlugCache = new Map<string, LibraryDocument | null>()
let graphCache: LibraryGraph | null = null

async function readJSON<T>(file: string): Promise<T> {
  const buf = await fs.readFile(path.join(CONTENT_DIR, file), "utf-8")
  return JSON.parse(buf) as T
}

// ─────────────────────────────────────────────────────────────────────────
// Public API

export async function getLibraryIndex(): Promise<LibraryIndex> {
  if (!indexCache) {
    indexCache = await readJSON<LibraryIndex>("index.json")
  }
  return indexCache
}

export async function getLibraryStats() {
  const idx = await getLibraryIndex()
  return idx.stats
}

export async function getAllSummaries(): Promise<LibrarySummary[]> {
  const idx = await getLibraryIndex()
  return idx.documents
}

export async function getAliasMap(): Promise<AliasMap> {
  if (!aliasMapCache) {
    aliasMapCache = await readJSON<AliasMap>("alias-map.json")
  }
  return aliasMapCache
}

export async function getGraph(): Promise<LibraryGraph> {
  if (!graphCache) {
    graphCache = await readJSON<LibraryGraph>("graph.json")
  }
  return graphCache
}

export async function getDocumentsByType(
  type: LibraryType
): Promise<LibraryDocument[]> {
  if (byTypeCache.has(type)) return byTypeCache.get(type)!
  try {
    const docs = await readJSON<LibraryDocument[]>(`by-type/${type}.json`)
    byTypeCache.set(type, docs)
    return docs
  } catch {
    byTypeCache.set(type, [])
    return []
  }
}

export async function getDocument(
  type: LibraryType,
  slug: string
): Promise<LibraryDocument | null> {
  const key = `${type}:${slug}`
  if (bySlugCache.has(key)) return bySlugCache.get(key) ?? null
  const docs = await getDocumentsByType(type)
  const doc = docs.find((d) => d.slug === slug) || null
  bySlugCache.set(key, doc)
  return doc
}

export async function getDocumentById(
  id: string
): Promise<LibraryDocument | null> {
  // id 형식: "type:slug"
  const [type, ...rest] = id.split(":")
  if (!type || rest.length === 0) return null
  return getDocument(type as LibraryType, rest.join(":"))
}

/**
 * 해당 문서로 들어오는 위키링크 백링크 — 문서 페이지 사이드바용
 */
export async function getBacklinks(id: string): Promise<LibrarySummary[]> {
  const graph = await getGraph()
  const summaries = await getAllSummaries()
  const summaryById = new Map(summaries.map((s) => [s.id, s]))
  const incoming = graph.links
    .filter((l) => l.target === id)
    .map((l) => summaryById.get(l.source))
    .filter((s): s is LibrarySummary => Boolean(s))
  // 중복 제거 (같은 source가 여러 kind로 연결될 수 있음)
  const seen = new Set<string>()
  return incoming.filter((s) => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })
}

/**
 * 해당 문서가 가리키는 위키링크 정방향 — 본문 외에 메타로 보여줄 때
 */
export async function getOutlinks(id: string): Promise<LibrarySummary[]> {
  const graph = await getGraph()
  const summaries = await getAllSummaries()
  const summaryById = new Map(summaries.map((s) => [s.id, s]))
  const outgoing = graph.links
    .filter((l) => l.source === id)
    .map((l) => summaryById.get(l.target))
    .filter((s): s is LibrarySummary => Boolean(s))
  const seen = new Set<string>()
  return outgoing.filter((s) => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })
}

/**
 * 위키링크 target 텍스트를 문서 ID로 해석
 */
export async function resolveWikilink(
  target: string
): Promise<{ id: string; url: string } | null> {
  const aliasMap = await getAliasMap()
  const id = aliasMap[target] || aliasMap[target.trim()]
  if (!id) return null
  return { id, url: getDocumentUrlById(id) }
}
