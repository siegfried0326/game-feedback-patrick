/**
 * GameDesignLibrary (Obsidian Vault) → Archive187 content/library JSON 임포트
 *
 * 입력: GAME_DESIGN_LIBRARY_PATH (기본: ~/Documents/GameDesignLibrary)
 * 출력:
 *   - content/library/index.json       (요약 인덱스)
 *   - content/library/documents.json   (모든 문서 본문 포함)
 *   - content/library/graph.json       (그래프 뷰용 노드/엣지)
 *   - content/library/alias-map.json   (모든 alias → 문서 ID)
 *
 * 실행: node scripts/import-library.mjs
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import os from "node:os"
import matter from "gray-matter"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, "..")

const VAULT_PATH =
  process.env.GAME_DESIGN_LIBRARY_PATH ||
  path.join(os.homedir(), "Documents", "GameDesignLibrary")

const OUT_DIR = path.join(PROJECT_ROOT, "content", "library")

// ─────────────────────────────────────────────────────────────────────────
// 1. 폴더 → 문서 타입 매핑

const TYPE_COLORS = {
  principle: "#5B8DEF",
  designer: "#facc15",
  pattern: "#06b6d4",
  antipattern: "#f87171",
  learning_path: "#ec4899",
  lineage: "#c084fc",
  genre_guide: "#84cc16",
  core_rule: "#14b8a6",
  source: "#94a3b8",
  gdc_talk: "#64748b",
  index: "#475569",
  level_design_supplement: "#10b981",
  meta: "#334155",
  other: "#64748b",
}

const DOMAIN_COLORS = {
  전투: "#ef4444",
  시스템: "#3b82f6",
  내러티브: "#a855f7",
  레벨: "#10b981",
  프로덕션: "#f59e0b",
}

// 폴더명 → 도메인 (02_원칙 하위)
const PRINCIPLE_DOMAINS = ["전투", "시스템", "내러티브", "레벨", "프로덕션"]

// 도메인 → 베이스 토픽
const DOMAIN_TO_TOPIC = {
  전투: "combat",
  레벨: "level",
  내러티브: "narrative",
  시스템: "system",
  프로덕션: "production",
}

// 토픽 키워드 룰
//   - 매칭은 제목 + tags + 본문 첫 200자에 한정 (광범위 본문 매칭 회피)
//   - 키워드는 2글자 이상이거나 구체적 phrase
const TOPIC_RULES = [
  { topic: "combat", keywords: ["전투", "콤보", "히트스톱", "넉백", "보스전", "타격", "스킬", "회피", "방어", "근접", "원거리"] },
  { topic: "ui", keywords: ["UI", "UX", "인터페이스", "HUD", "메뉴", "튜토리얼", "온보딩", "어포던스", "가독성", "사용성", "정보비대칭"] },
  { topic: "character", keywords: ["캐릭터", "주인공", "동반자", "컴패니언", "페르소나", "NPC", "주연", "조연", "롤플레이", "성장"] },
  { topic: "narrative", keywords: ["내러티브", "스토리", "시나리오", "대화", "분기", "엔딩", "환경스토리", "테마", "도덕", "회색지대", "유머", "로어"] },
  { topic: "enemy_ai", keywords: ["몬스터", "보스", "AI 디렉터", "AI 동료", "AI 적", "절차적 NPC", "네메시스", "잠입", "디렉터 시스템", "적 설계"] },
  { topic: "level", keywords: ["레벨디자인", "맵 설계", "공간", "탐험", "지름길", "메트로배니아", "월드", "지도", "랜드마크", "백트래킹", "위니", "사이트라인", "오픈월드"] },
  { topic: "balance", keywords: ["밸런스", "경제", "수도꼭지", "튜닝", "통계", "수치", "성장 곡선", "진행", "난이도", "적응형"] },
  { topic: "live_service", keywords: ["MMO", "라이브 서비스", "라이브이벤트", "이벤트 운영", "구독", "F2P", "P2W", "PvP", "PvE", "메타 회전", "콘텐츠 회전", "라이브서비스"] },
  { topic: "production", keywords: ["프로덕션", "팀", "출시", "크라우드펀딩", "퍼블리셔", "솔로 개발", "포트폴리오", "장기 개발", "프로토타입", "디렉션", "사전 제작"] },
  { topic: "system", keywords: ["시스템", "메카닉", "루프", "시너지", "선택", "결과", "절차적 생성", "메타게임", "진행 시스템"] },
]

// 디스플레이 메타 (slug → 한글, 색상은 lib/library/types에서)
const TOPIC_META = {
  combat:        { label: "전투",        order: 1 },
  ui:            { label: "UI/UX",      order: 2 },
  character:     { label: "캐릭터",      order: 3 },
  narrative:     { label: "시나리오",    order: 4 },
  enemy_ai:      { label: "몬스터/AI",   order: 5 },
  level:         { label: "레벨디자인",  order: 6 },
  system:        { label: "시스템",      order: 7 },
  balance:       { label: "밸런스",      order: 8 },
  live_service:  { label: "라이브서비스", order: 9 },
  production:    { label: "프로덕션",    order: 10 },
}

function assignTopics(doc) {
  const topics = new Set()
  // 1. 도메인 → 베이스
  if (doc.domain && DOMAIN_TO_TOPIC[doc.domain]) topics.add(DOMAIN_TO_TOPIC[doc.domain])
  // 2. 키워드 매칭 (제목 + 태그 + 본문 첫 200자만 — 광범위 매칭 회피)
  const haystack = [
    doc.title || "",
    doc.titleEn || "",
    ...(doc.tags || []),
    (doc.body || "").slice(0, 200),
  ].join(" ").toLowerCase()
  for (const rule of TOPIC_RULES) {
    for (const kw of rule.keywords) {
      if (haystack.includes(kw.toLowerCase())) {
        topics.add(rule.topic)
        break
      }
    }
  }
  // 3. 폴더 보정
  if (doc.filePath?.startsWith("06_핵심규칙/UIUX")) topics.add("ui")
  if (doc.filePath?.startsWith("06_핵심규칙/몬스터")) topics.add("enemy_ai")
  if (doc.filePath?.startsWith("06_핵심규칙/밸런스")) topics.add("balance")
  if (doc.filePath?.startsWith("06_핵심규칙/게임운영")) topics.add("live_service")
  if (doc.filePath?.startsWith("06_핵심규칙/팀업")) topics.add("production")
  if (doc.filePath?.startsWith("07_레벨디자인")) topics.add("level")
  return Array.from(topics).sort(
    (a, b) => (TOPIC_META[a]?.order || 99) - (TOPIC_META[b]?.order || 99)
  )
}

// 제외 패턴 (스캔 대상에서 빠짐)
const EXCLUDE_DIRS = new Set([
  ".obsidian",
  ".trash",
  ".git",
  "node_modules",
  ".DS_Store",
  "AI공부",
  "메타",
  "무제",
  "05_Marketing",
])
const EXCLUDE_FILES = new Set([
  "_template.md",
  "CLAUDE.md",
  "ROADMAP.md",
  "PROJECT_STATUS.md",
  "HOW_TO_USE.md",
  // README.md는 폴더별로 의미가 있으므로 포함
])
const EXCLUDE_ROOT_FILES = new Set([
  "README.md",
  "CLAUDE.md",
  "ROADMAP.md",
  "PROJECT_STATUS.md",
  "HOW_TO_USE.md",
  "2026-04-23.md",
])

// ─────────────────────────────────────────────────────────────────────────
// 2. 재귀 스캔

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue
    if (EXCLUDE_DIRS.has(entry.name)) continue

    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, files)
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      if (EXCLUDE_FILES.has(entry.name)) continue
      // 루트의 인프라 파일 제외
      if (path.dirname(full) === VAULT_PATH && EXCLUDE_ROOT_FILES.has(entry.name)) continue
      files.push(full)
    }
  }
  return files
}

// ─────────────────────────────────────────────────────────────────────────
// 3. 문서 타입·도메인 분류 (경로 기반)

function classify(filePath) {
  const rel = path.relative(VAULT_PATH, filePath)
  const parts = rel.split(path.sep)
  const top = parts[0]
  const fileName = path.basename(filePath, ".md")

  // 루트 떠도는 파일
  if (parts.length === 1) {
    if (fileName.startsWith("PRIN-")) return { type: "principle", domain: detectPrincipleDomain(fileName) }
    if (fileName.startsWith("TC-")) return { type: "source", subType: "episode" }
    if (fileName === "Josh Sawyer") return { type: "designer" }
    return { type: "other" }
  }

  if (top === "00_색인") {
    if (parts[1] === "learning_paths") return { type: "learning_path" }
    if (parts[1] === "lineage") return { type: "lineage" }
    return { type: "index" }
  }
  if (top === "01_디자이너") return { type: "designer" }
  if (top === "02_원칙") {
    const domain = PRINCIPLE_DOMAINS.includes(parts[1]) ? parts[1] : detectPrincipleDomain(fileName)
    return { type: "principle", domain }
  }
  if (top === "03_패턴") return { type: "pattern" }
  if (top === "04_안티패턴") return { type: "antipattern" }
  if (top === "06_핵심규칙") {
    if (fileName.startsWith("장르-")) return { type: "genre_guide" }
    return { type: "core_rule" }
  }
  if (top === "07_레벨디자인") return { type: "level_design_supplement" }
  if (top === "99_출처") return { type: "source", sourceFolder: parts.length > 2 ? parts[1] : null }
  if (top.startsWith("GDC_")) return { type: "gdc_talk", year: top.replace("GDC_", ""), category: parts.length > 2 ? parts[1] : null }

  return { type: "other" }
}

function detectPrincipleDomain(fileName) {
  // "PRIN-CMB-..." or "전투-SK001-..."
  if (fileName.startsWith("PRIN-")) {
    const code = fileName.split("-")[1]
    return { CMB: "전투", SYS: "시스템", NAR: "내러티브", LVL: "레벨", PRD: "프로덕션" }[code] || null
  }
  for (const d of PRINCIPLE_DOMAINS) {
    if (fileName.startsWith(d + "-")) return d
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────
// 4. 위키링크 추출

function extractWikilinks(body) {
  const links = []
  const re = /\[\[([^\]\n]+?)\]\]/g
  let m
  while ((m = re.exec(body)) !== null) {
    const raw = m[1].trim()
    if (!raw) continue
    let target = raw
    let display = null
    if (raw.includes("|")) {
      const [t, d] = raw.split("|", 2)
      target = t.trim()
      display = d.trim()
    }
    // 헤더 앵커 분리 (#)
    if (target.includes("#")) {
      target = target.split("#")[0].trim()
    }
    if (!target) continue
    links.push({ target, display })
  }
  return links
}

// ─────────────────────────────────────────────────────────────────────────
// 5. URL slug 생성

function makeSlug(fileName) {
  // 한글 + 영문 + 숫자 + - _ 허용, 나머지는 -. 공백 그대로 (Next.js가 URL 인코딩 처리)
  return fileName
}

// ─────────────────────────────────────────────────────────────────────────
// 6. 메인 파이프라인

function importVault() {
  console.log(`[library] Vault: ${VAULT_PATH}`)
  if (!fs.existsSync(VAULT_PATH)) {
    throw new Error(`Vault 경로를 찾을 수 없음: ${VAULT_PATH}`)
  }

  const files = walk(VAULT_PATH)
  console.log(`[library] 발견 .md 파일: ${files.length}`)

  const documents = []
  const aliasMap = {} // alias → docId (중복 시 우선순위 처리)

  // 1차 패스: 문서 로드 + aliases 등록
  for (const filePath of files) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8")
      const { data: fm, content: body } = matter(raw)

      const fileName = path.basename(filePath, ".md")
      const cls = classify(filePath)
      const slug = makeSlug(fileName)
      const docId = `${cls.type}:${slug}` // 안정적 ID

      const wikilinks = extractWikilinks(body)

      // 디자이너 prop 정규화
      const designers = Array.isArray(fm.designers)
        ? fm.designers.map((d) => String(d).replace(/^\[\[/, "").replace(/\]\]$/, "").trim())
        : []

      const sources = Array.isArray(fm.sources)
        ? fm.sources.map((s) => String(s).replace(/^\[\[/, "").replace(/\]\]$/, "").trim())
        : []

      const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : []
      const gamesReferenced = Array.isArray(fm.games_referenced) ? fm.games_referenced.map(String) : []
      const aliases = Array.isArray(fm.aliases) ? fm.aliases.map(String) : []
      const relatedPrinciples = Array.isArray(fm.related_principles)
        ? fm.related_principles.map((s) => String(s).replace(/^\[\[/, "").replace(/\]\]$/, "").trim())
        : []

      const title =
        fm.title ||
        fm.title_ko ||
        fm.name_ko ||
        fm.name ||
        fileName

      const doc = {
        id: docId,
        slug,
        fileName,
        filePath: path.relative(VAULT_PATH, filePath),
        type: cls.type,
        domain: cls.domain || null,
        subType: cls.subType || null,
        sourceFolder: cls.sourceFolder || null,
        year: cls.year || null,
        category: cls.category || null,
        title: String(title),
        titleEn: fm.title_en ? String(fm.title_en) : null,
        nameKo: fm.name_ko ? String(fm.name_ko) : null,
        principleId: fm.id ? String(fm.id) : null,
        aliases,
        tags,
        designers,
        gamesReferenced,
        sources,
        relatedPrinciples,
        sourceConfidence: fm.source_confidence || null,
        status: fm.status ? String(fm.status) : null,
        preview: fm.preview === true,
        previewMode: fm.preview, // raw value
        created: fm.created ? String(fm.created) : null,
        updated: fm.updated ? String(fm.updated) : null,
        notableWorks: Array.isArray(fm.notable_works) ? fm.notable_works.map(String) : [],
        roles: Array.isArray(fm.roles) ? fm.roles.map(String) : [],
        domains: Array.isArray(fm.domains) ? fm.domains.map(String) : [],
        url: fm.url ? String(fm.url) : null,
        sourceType: fm.source_type ? String(fm.source_type) : null,
        creator: fm.creator ? String(fm.creator) : null,
        language: fm.language ? String(fm.language) : null,
        severity: fm.severity ? String(fm.severity) : null,
        // 본문
        body: body.trim(),
        wikilinks,
        // 통계
        bodyLength: body.trim().length,
      }

      doc.topics = assignTopics(doc)
      documents.push(doc)

      // aliasMap 등록 (우선순위: principleId > aliases > slug > title > titleEn > nameKo)
      const aliasKeys = [
        doc.principleId,
        ...doc.aliases,
        doc.slug,
        doc.title,
        doc.titleEn,
        doc.nameKo,
      ].filter(Boolean)

      for (const key of aliasKeys) {
        const norm = key.trim()
        if (!norm) continue
        // 이미 등록되어 있고 다른 타입이면 — 충돌 기록, 첫 등록 유지
        if (aliasMap[norm] && aliasMap[norm] !== docId) {
          // 정확 매치 우선순위: principleId/aliases 우선, slug는 동률
          continue
        }
        aliasMap[norm] = docId
      }
    } catch (err) {
      console.error(`[library] 실패: ${filePath}`, err.message)
    }
  }

  console.log(`[library] 임포트 문서: ${documents.length}, alias 키: ${Object.keys(aliasMap).length}`)

  // ─────────────────────────────────────────────────────────────────────
  // 2차 패스: 위키링크 해석 → 그래프 엣지

  const edgesMap = new Map() // "src::tgt::kind" → edge
  function addEdge(source, target, kind) {
    const key = `${source}::${target}::${kind}`
    if (!edgesMap.has(key)) {
      edgesMap.set(key, { source, target, kind, count: 1 })
    } else {
      edgesMap.get(key).count += 1
    }
  }

  let resolvedCount = 0
  let unresolvedCount = 0

  for (const doc of documents) {
    // 위키링크
    for (const link of doc.wikilinks) {
      const resolved = aliasMap[link.target] || aliasMap[link.target.trim()]
      if (resolved && resolved !== doc.id) {
        addEdge(doc.id, resolved, "wikilink")
        resolvedCount += 1
      } else {
        unresolvedCount += 1
      }
    }
    // designers frontmatter (디자이너 ↔ 원칙)
    for (const designer of doc.designers) {
      const resolved = aliasMap[designer]
      if (resolved && resolved !== doc.id) addEdge(doc.id, resolved, "designer")
    }
    // sources frontmatter
    for (const src of doc.sources) {
      const resolved = aliasMap[src]
      if (resolved && resolved !== doc.id) addEdge(doc.id, resolved, "source")
    }
    // related_principles (안티패턴)
    for (const rp of doc.relatedPrinciples) {
      const resolved = aliasMap[rp]
      if (resolved && resolved !== doc.id) addEdge(doc.id, resolved, "related")
    }
  }

  const edges = Array.from(edgesMap.values())
  console.log(`[library] 엣지: ${edges.length} (해결 ${resolvedCount} / 미해결 ${unresolvedCount})`)

  // ─────────────────────────────────────────────────────────────────────
  // 3차 패스: 그래프 노드

  const nodes = documents.map((doc) => {
    const color = doc.type === "principle" && doc.domain
      ? DOMAIN_COLORS[doc.domain] || TYPE_COLORS.principle
      : TYPE_COLORS[doc.type] || TYPE_COLORS.other
    return {
      id: doc.id,
      slug: doc.slug,
      type: doc.type,
      domain: doc.domain || null,
      topics: doc.topics || [],
      title: doc.title,
      label: doc.title.length > 24 ? doc.title.slice(0, 24) + "…" : doc.title,
      color,
      status: doc.status,
      preview: doc.preview,
      tagCount: doc.tags.length,
      designerCount: doc.designers.length,
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // 통계 산출

  const stats = {
    totalDocuments: documents.length,
    byType: {},
    byDomain: {},
    byStatus: {},
    byTopic: {},
    byDesigner: {},
    previewTrueCount: 0,
    totalEdges: edges.length,
    totalAliases: Object.keys(aliasMap).length,
    importedAt: new Date().toISOString(),
    vaultPath: VAULT_PATH,
  }
  for (const doc of documents) {
    stats.byType[doc.type] = (stats.byType[doc.type] || 0) + 1
    if (doc.domain) stats.byDomain[doc.domain] = (stats.byDomain[doc.domain] || 0) + 1
    if (doc.status) stats.byStatus[doc.status] = (stats.byStatus[doc.status] || 0) + 1
    if (doc.preview) stats.previewTrueCount += 1
    for (const t of doc.topics || []) {
      stats.byTopic[t] = (stats.byTopic[t] || 0) + 1
    }
    for (const designer of doc.designers || []) {
      if (designer) stats.byDesigner[designer] = (stats.byDesigner[designer] || 0) + 1
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 인덱스(요약, 본문 없음)

  const summaries = documents.map((doc) => ({
    id: doc.id,
    slug: doc.slug,
    type: doc.type,
    domain: doc.domain,
    topics: doc.topics || [],
    title: doc.title,
    titleEn: doc.titleEn,
    nameKo: doc.nameKo,
    tags: doc.tags,
    designers: doc.designers,
    gamesReferenced: doc.gamesReferenced,
    status: doc.status,
    preview: doc.preview,
    principleId: doc.principleId,
    created: doc.created,
    updated: doc.updated,
    year: doc.year,
    category: doc.category,
    sourceFolder: doc.sourceFolder,
    bodyLength: doc.bodyLength,
  }))

  // ─────────────────────────────────────────────────────────────────────
  // 디렉토리 + 파일 출력

  fs.mkdirSync(OUT_DIR, { recursive: true })

  fs.writeFileSync(
    path.join(OUT_DIR, "index.json"),
    JSON.stringify({ stats, documents: summaries }, null, 2)
  )

  fs.writeFileSync(
    path.join(OUT_DIR, "documents.json"),
    JSON.stringify(documents, null, 2)
  )

  fs.writeFileSync(
    path.join(OUT_DIR, "alias-map.json"),
    JSON.stringify(aliasMap, null, 2)
  )

  fs.writeFileSync(
    path.join(OUT_DIR, "graph.json"),
    JSON.stringify({ nodes, links: edges.map(e => ({ source: e.source, target: e.target, kind: e.kind, count: e.count })) }, null, 2)
  )

  // 타입별 분할 파일 (라우트 빌드 시 부분 로드)
  const byType = {}
  for (const doc of documents) {
    if (!byType[doc.type]) byType[doc.type] = []
    byType[doc.type].push(doc)
  }
  fs.mkdirSync(path.join(OUT_DIR, "by-type"), { recursive: true })
  for (const [type, docs] of Object.entries(byType)) {
    fs.writeFileSync(
      path.join(OUT_DIR, "by-type", `${type}.json`),
      JSON.stringify(docs, null, 2)
    )
  }

  console.log("\n[library] 통계:")
  console.log("  by type:", stats.byType)
  console.log("  by domain:", stats.byDomain)
  console.log("  by topic:", stats.byTopic)
  console.log("  by status:", stats.byStatus)
  console.log(`  designers (unique): ${Object.keys(stats.byDesigner).length}`)
  console.log(`  preview:true: ${stats.previewTrueCount}`)
  console.log(`  edges: ${stats.totalEdges}`)
  console.log(`  alias keys: ${stats.totalAliases}`)
  console.log(`\n[library] 출력 → ${OUT_DIR}`)

  return stats
}

importVault()
