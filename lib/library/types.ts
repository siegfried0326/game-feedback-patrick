/**
 * 라이브러리 데이터 타입
 * scripts/import-library.mjs 출력 스키마와 동기화
 */

export type LibraryType =
  | "principle"
  | "designer"
  | "pattern"
  | "antipattern"
  | "learning_path"
  | "lineage"
  | "genre_guide"
  | "core_rule"
  | "source"
  | "gdc_talk"
  | "level_design_supplement"
  | "index"
  | "meta"
  | "other"

export type Domain = "전투" | "시스템" | "내러티브" | "레벨" | "프로덕션"

export type Topic =
  | "combat"
  | "ui"
  | "character"
  | "narrative"
  | "enemy_ai"
  | "level"
  | "system"
  | "balance"
  | "live_service"
  | "production"

export interface LibrarySummary {
  id: string
  slug: string
  type: LibraryType
  domain: Domain | null
  topics: Topic[]
  title: string
  titleEn: string | null
  nameKo: string | null
  tags: string[]
  designers: string[]
  gamesReferenced: string[]
  status: string | null
  preview: boolean
  principleId: string | null
  created: string | null
  updated: string | null
  year: string | null
  category: string | null
  sourceFolder: string | null
  bodyLength: number
}

export interface LibraryWikilink {
  target: string
  display: string | null
}

export interface LibraryDocument extends LibrarySummary {
  fileName: string
  filePath: string
  subType: string | null
  body: string
  wikilinks: LibraryWikilink[]
  aliases: string[]
  sources: string[]
  relatedPrinciples: string[]
  sourceConfidence: string | null
  previewMode: unknown
  notableWorks: string[]
  roles: string[]
  domains: string[]
  url: string | null
  sourceType: string | null
  creator: string | null
  language: string | null
  severity: string | null
}

export interface LibraryGraphNode {
  id: string
  slug: string
  type: LibraryType
  domain: Domain | null
  topics: Topic[]
  title: string
  label: string
  color: string
  status: string | null
  preview: boolean
  tagCount: number
  designerCount: number
}

export interface LibraryGraphLink {
  source: string
  target: string
  kind: "wikilink" | "designer" | "source" | "related"
  count: number
}

export interface LibraryGraph {
  nodes: LibraryGraphNode[]
  links: LibraryGraphLink[]
}

export interface LibraryStats {
  totalDocuments: number
  byType: Record<string, number>
  byDomain: Record<string, number>
  byTopic: Record<string, number>
  byDesigner: Record<string, number>
  byStatus: Record<string, number>
  previewTrueCount: number
  totalEdges: number
  totalAliases: number
  importedAt: string
  vaultPath: string
}

export interface LibraryIndex {
  stats: LibraryStats
  documents: LibrarySummary[]
}

export type AliasMap = Record<string, string>

// 타입별 표시명
export const TYPE_LABELS: Record<LibraryType, string> = {
  principle: "원칙",
  designer: "디자이너",
  pattern: "패턴",
  antipattern: "안티패턴",
  learning_path: "학습 경로",
  lineage: "사상 계보",
  genre_guide: "장르 가이드",
  core_rule: "핵심 규칙",
  source: "출처",
  gdc_talk: "GDC 강연",
  level_design_supplement: "레벨 디자인",
  index: "색인",
  meta: "메타",
  other: "기타",
}

// 타입별 URL 세그먼트
export const TYPE_ROUTES: Record<LibraryType, string> = {
  principle: "principles",
  designer: "designers",
  pattern: "patterns",
  antipattern: "antipatterns",
  learning_path: "paths",
  lineage: "lineage",
  genre_guide: "genres",
  core_rule: "core",
  source: "sources",
  gdc_talk: "gdc",
  level_design_supplement: "level-design",
  index: "index",
  meta: "meta",
  other: "other",
}

// 도메인 색상 (그래프/카드 공용)
export const DOMAIN_COLORS: Record<Domain, string> = {
  전투: "#ef4444",
  시스템: "#3b82f6",
  내러티브: "#a855f7",
  레벨: "#10b981",
  프로덕션: "#f59e0b",
}

// 토픽 메타 (주제별 분류)
export const TOPIC_LABELS: Record<Topic, string> = {
  combat: "전투",
  ui: "UI/UX",
  character: "캐릭터",
  narrative: "시나리오",
  enemy_ai: "몬스터/AI",
  level: "레벨디자인",
  system: "시스템",
  balance: "밸런스",
  live_service: "라이브서비스",
  production: "프로덕션",
}

export const TOPIC_COLORS: Record<Topic, string> = {
  combat: "#ef4444",
  ui: "#f59e0b",
  character: "#ec4899",
  narrative: "#a855f7",
  enemy_ai: "#8b5cf6",
  level: "#10b981",
  system: "#3b82f6",
  balance: "#14b8a6",
  live_service: "#f97316",
  production: "#d97706",
}

export const TOPIC_ORDER: Topic[] = [
  "combat", "ui", "character", "narrative", "enemy_ai",
  "level", "system", "balance", "live_service", "production",
]

// 타입 색상
export const TYPE_COLORS: Record<LibraryType, string> = {
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
  level_design_supplement: "#10b981",
  index: "#475569",
  meta: "#334155",
  other: "#64748b",
}
