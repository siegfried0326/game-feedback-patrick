/**
 * 관리자 — 수강생 크레딧 지급 서버 액션
 *
 * BM 개편(2026-08-05): 과외 수강생에게 관리자가 매월 크레딧을 직접 지급한다.
 * - searchUsers(): 이메일로 사용자 검색 (구독/크레딧/수강생 여부 포함)
 * - grantCredits(): 크레딧 지급(+)/회수(-) + credit_grants 이력 기록 + is_student 자동 지정
 * - setStudentStatus(): 수강생 플래그만 토글
 * - getRecentGrants(): 최근 지급 이력
 *
 * 보안: 모든 함수가 isAdminEmail() 검증. 다른 사용자의 row를 수정해야 하므로
 * RLS를 우회하는 서비스롤 클라이언트를 사용한다 (SUPABASE_SERVICE_ROLE_KEY).
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { isAdminEmail } from "@/lib/admin"

type AdminCheck = { ok: true; adminEmail: string } | { ok: false; error: string }

async function requireAdmin(): Promise<AdminCheck> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return { ok: false, error: "관리자 권한이 필요합니다." }
  }
  return { ok: true, adminEmail: user.email! }
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

export type StudentUserRow = {
  userId: string
  email: string
  createdAt: string
  plan: string
  credits: number
  isStudent: boolean
  lastGrantAt: string | null
}

/** 이메일 부분 일치로 사용자 검색 (빈 검색어 = 수강생 전체) */
export async function searchUsers(query: string): Promise<{ users?: StudentUserRow[]; error?: string }> {
  const admin = await requireAdmin()
  if (!admin.ok) return { error: admin.error }

  const service = getServiceClient()
  if (!service) return { error: "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다." }

  const q = query.trim().toLowerCase()

  // auth.users 목록 (사용자 규모가 작아 페이지 순회로 충분)
  const emails = new Map<string, { email: string; createdAt: string }>()
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return { error: `사용자 목록 조회 실패: ${error.message}` }
    for (const u of data.users) {
      if (u.email) emails.set(u.id, { email: u.email, createdAt: u.created_at })
    }
    if (data.users.length < 200) break
  }

  // 구독/크레딧/수강생 정보
  const { data: subs, error: subError } = await service
    .from("users_subscription")
    .select("user_id, plan, analysis_credits, is_student")
  if (subError) return { error: `구독 정보 조회 실패: ${subError.message}` }
  const subMap = new Map((subs || []).map(s => [s.user_id, s]))

  // 최근 지급일
  const { data: grants } = await service
    .from("credit_grants")
    .select("user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(500)
  const lastGrantMap = new Map<string, string>()
  for (const g of grants || []) {
    if (!lastGrantMap.has(g.user_id)) lastGrantMap.set(g.user_id, g.created_at)
  }

  const rows: StudentUserRow[] = []
  for (const [userId, info] of emails) {
    const sub = subMap.get(userId)
    const row: StudentUserRow = {
      userId,
      email: info.email,
      createdAt: info.createdAt,
      plan: sub?.plan || "free",
      credits: sub?.analysis_credits ?? 0,
      isStudent: sub?.is_student ?? false,
      lastGrantAt: lastGrantMap.get(userId) || null,
    }
    if (q ? row.email.toLowerCase().includes(q) : row.isStudent) {
      rows.push(row)
    }
  }

  rows.sort((a, b) => (b.isStudent ? 1 : 0) - (a.isStudent ? 1 : 0) || a.email.localeCompare(b.email))
  return { users: rows.slice(0, 50) }
}

/** 크레딧 지급(양수)/회수(음수) + 이력 기록. 지급 시 is_student 자동 지정 */
export async function grantCredits(userId: string, credits: number, note?: string) {
  const admin = await requireAdmin()
  if (!admin.ok) return { error: admin.error }

  const service = getServiceClient()
  if (!service) return { error: "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다." }

  if (!Number.isInteger(credits) || credits === 0 || Math.abs(credits) > 500) {
    return { error: "지급량은 ±500 이내의 0이 아닌 정수여야 합니다." }
  }

  // 현재 크레딧 조회 (row 없으면 생성)
  const { data: sub } = await service
    .from("users_subscription")
    .select("analysis_credits")
    .eq("user_id", userId)
    .maybeSingle()

  const current = sub?.analysis_credits ?? 0
  const next = Math.max(0, current + credits)

  const { error: upsertError } = await service
    .from("users_subscription")
    .upsert({
      user_id: userId,
      ...(sub ? {} : { plan: "free", status: "active" }),
      analysis_credits: next,
      is_student: credits > 0 ? true : undefined,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

  if (upsertError) return { error: `크레딧 지급 실패: ${upsertError.message}` }

  // 이력 기록 (실패해도 지급 자체는 유효 — 로그만)
  const { error: grantError } = await service
    .from("credit_grants")
    .insert({ user_id: userId, granted_by: admin.adminEmail, credits, note: note || null })
  if (grantError) console.error("[student-admin] 지급 이력 기록 실패:", grantError.message)

  return { success: true, credits: next }
}

/** 수강생 플래그 토글 (지급 없이 상태만 변경) */
export async function setStudentStatus(userId: string, isStudent: boolean) {
  const admin = await requireAdmin()
  if (!admin.ok) return { error: admin.error }

  const service = getServiceClient()
  if (!service) return { error: "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다." }

  const { error } = await service
    .from("users_subscription")
    .upsert({
      user_id: userId,
      is_student: isStudent,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

  if (error) return { error: `수강생 상태 변경 실패: ${error.message}` }
  return { success: true }
}

export type GrantHistoryRow = {
  id: string
  email: string
  credits: number
  note: string | null
  grantedBy: string
  createdAt: string
}

/** 최근 지급 이력 50건 */
export async function getRecentGrants(): Promise<{ grants?: GrantHistoryRow[]; error?: string }> {
  const admin = await requireAdmin()
  if (!admin.ok) return { error: admin.error }

  const service = getServiceClient()
  if (!service) return { error: "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다." }

  const { data: grants, error } = await service
    .from("credit_grants")
    .select("id, user_id, credits, note, granted_by, created_at")
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) return { error: `이력 조회 실패: ${error.message}` }
  if (!grants || grants.length === 0) return { grants: [] }

  // 이메일 매핑
  const userIds = [...new Set(grants.map(g => g.user_id))]
  const emailMap = new Map<string, string>()
  for (const id of userIds) {
    const { data } = await service.auth.admin.getUserById(id)
    if (data.user?.email) emailMap.set(id, data.user.email)
  }

  return {
    grants: grants.map(g => ({
      id: g.id,
      email: emailMap.get(g.user_id) || g.user_id.slice(0, 8),
      credits: g.credits,
      note: g.note,
      grantedBy: g.granted_by,
      createdAt: g.created_at,
    })),
  }
}
