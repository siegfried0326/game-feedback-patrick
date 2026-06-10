/**
 * 라이브러리 라우트 헬퍼 — URL 세그먼트 ↔ 타입 변환
 * 클라이언트/서버 양쪽에서 안전 (fs/path 사용 없음).
 */

import { LibraryType, TYPE_ROUTES } from "./types"

const ROUTE_TO_TYPE: Record<string, LibraryType> = Object.fromEntries(
  Object.entries(TYPE_ROUTES).map(([t, r]) => [r, t as LibraryType])
)

export function routeToType(segment: string): LibraryType | null {
  return ROUTE_TO_TYPE[segment] || null
}

export function typeToRoute(type: LibraryType): string {
  return TYPE_ROUTES[type] || "other"
}

export const ALL_TYPE_ROUTES = Object.values(TYPE_ROUTES)

/** 타입 + slug → URL */
export function getDocumentUrl(type: LibraryType, slug: string): string {
  return `/library/${typeToRoute(type)}/${encodeURIComponent(slug)}`
}

/** "type:slug" id → URL */
export function getDocumentUrlById(id: string): string {
  const idx = id.indexOf(":")
  if (idx === -1) return "/library"
  return getDocumentUrl(id.slice(0, idx) as LibraryType, id.slice(idx + 1))
}
