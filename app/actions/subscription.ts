/**
 * 구독/크레딧/프로젝트/분석이력 관리 서버 액션
 *
 * 구독 관련:
 * - getSubscription(): 구독 조회 (없으면 free 자동 생성, 크레딧 포함)
 * - cancelSubscription(): 구독 해지 (빌링키 삭제 + status=cancelled)
 * - checkAnalysisAllowance(): 분석 가능 여부 (구독: 무제한, 비구독: 크레딧 확인)
 * - checkProjectAllowance(): 프로젝트 생성 가능 여부 (구독/크레딧 있으면 무제한)
 * - deductCredit(): 분석 완료 후 크레딧 차감 (구독자는 차감 안 함)
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { deleteBillingKey } from "@/lib/nice-api"
import { isAdminEmail } from "@/lib/admin"

// 보안: DB 에러 메시지를 사용자에게 직접 노출하지 않음
function dbError(msg: string, error: unknown): { error: string } {
  console.error(`[subscription] ${msg}:`, error instanceof Error ? error.message : error)
  return { error: msg }
}

export async function getSubscription() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  const { data, error } = await supabase
    .from("users_subscription")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (error) {
    // 구독 레코드가 없으면 free 플랜 생성
    if (error.code === "PGRST116") {
      const { data: newSub } = await supabase
        .from("users_subscription")
        .insert({ user_id: user.id, plan: "free", status: "active" })
        .select()
        .single()
      return { data: newSub }
    }
    return dbError("구독 정보 조회에 실패했습니다.", error)
  }

  return { data }
}

export async function cancelSubscription() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  const { data: subscription } = await supabase
    .from("users_subscription")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!subscription) return { error: "구독 정보를 찾을 수 없습니다." }
  if (subscription.plan === "free") return { error: "무료 체험은 해지할 수 없습니다." }
  if (subscription.status === "cancelled") return { error: "이미 해지된 구독입니다." }

  // 빌링키가 있으면 나이스페이먼츠에서 삭제
  if (subscription.billing_key) {
    await deleteBillingKey(subscription.billing_key)
  }

  const { error } = await supabase
    .from("users_subscription")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      billing_key: null,
    })
    .eq("user_id", user.id)

  if (error) return dbError("구독 해지 처리에 실패했습니다.", error)
  return { success: true }
}

// ========== 프로젝트 관련 ==========

export async function getProjects() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  // 프로젝트 목록
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) return dbError("프로젝트 목록 조회에 실패했습니다.", error)

  // 각 프로젝트의 분석 통계 가져오기
  const { data: analyses } = await supabase
    .from("analysis_history")
    .select("project_id, overall_score, analyzed_at, file_name")
    .eq("user_id", user.id)
    .order("analyzed_at", { ascending: false })

  const projectsWithStats = (projects || []).map(project => {
    const projectAnalyses = (analyses || []).filter(a => a.project_id === project.id)
    const bestScore = projectAnalyses.length > 0
      ? Math.max(...projectAnalyses.map(a => a.overall_score || 0))
      : null
    const latestAnalysis = projectAnalyses[0] || null

    return {
      ...project,
      analysis_count: projectAnalyses.length,
      best_score: bestScore,
      latest_score: latestAnalysis?.overall_score || null,
      latest_file_name: latestAnalysis?.file_name || null,
      latest_analyzed_at: latestAnalysis?.analyzed_at || null,
    }
  })

  return { data: projectsWithStats }
}

const PROJECT_LIMIT = 50

export async function createProject(name: string, description?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  // 프로젝트는 무료 (구독 시절의 크레딧·플랜 제한 제거, 2026-10-07). 남용 방지 상한만 둔다
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
  if ((count ?? 0) >= PROJECT_LIMIT) {
    return { error: `프로젝트는 ${PROJECT_LIMIT}개까지 만들 수 있어요. 안 쓰는 프로젝트를 정리해 주세요.` }
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name,
      description: description || null,
    })
    .select()
    .single()

  if (error) return dbError("프로젝트 생성에 실패했습니다.", error)
  return { data }
}

/** 프로젝트 생성 가능 여부 — 2026-10-07부터 로그인만 하면 가능 (createProject의 상한은 별도) */
export async function checkProjectAllowance() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { allowed: false, reason: "로그인이 필요합니다." }
  return { allowed: true }
}

export async function checkAnalysisAllowance() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { allowed: false, plan: "none" as const, reason: "login_required" as const }

  // 관리자는 크레딧/구독 무관하게 무제한
  if (isAdminEmail(user.email)) {
    return { allowed: true, plan: "admin" as const, unlimited: true, source: "admin" as const }
  }

  // 구독 확인
  const { data: subscription } = await supabase
    .from("users_subscription")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!subscription) {
    return { allowed: false, plan: "free" as const, reason: "limit_reached", remaining: 0 }
  }

  // ① 크레딧이 있으면 무조건 크레딧 우선 (구독 여부 무관)
  const credits = subscription.analysis_credits || 0
  if (credits > 0) {
    return { allowed: true, plan: subscription.plan, remaining: credits, source: "credit" as const }
  }

  // ② 크레딧 없으면 → 유료 구독 확인
  if (subscription.plan !== "free") {
    const isExpired = subscription.expires_at && new Date(subscription.expires_at) < new Date()
    if (isExpired || subscription.status === "expired") {
      return { allowed: false, plan: subscription.plan, expired: true, remaining: 0 }
    }
    return { allowed: true, plan: subscription.plan, unlimited: true, source: "subscription" as const }
  }

  // ③ 크레딧도 구독도 없음
  return { allowed: false, plan: "free" as const, reason: "limit_reached", remaining: 0 }
}

// 분석 완료 후 크레딧 차감 (크레딧 우선 소모 → 크레딧 0이면 구독 사용)
// amount: 기본 분석 1, 정밀 분석 2 (lib/analysis/model.ts MODEL_TIERS[tier].creditCost)
export async function deductCredit(amount: number = 1) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  // 관리자는 크레딧 차감 안 함 (무제한)
  if (isAdminEmail(user.email)) {
    return { success: true, unlimited: true, source: "admin" as const }
  }

  const { data: subscription } = await supabase
    .from("users_subscription")
    .select("plan, expires_at, status, analysis_credits")
    .eq("user_id", user.id)
    .single()

  if (!subscription) return { error: "구독 정보를 찾을 수 없습니다." }

  // ① 크레딧이 있으면 무조건 크레딧부터 차감 (구독 여부 무관)
  const currentCredits = subscription.analysis_credits || 0
  if (currentCredits > 0) {
    const cost = Math.max(1, Math.round(amount))
    const remaining = Math.max(0, currentCredits - cost)
    const { error } = await supabase
      .from("users_subscription")
      .update({ analysis_credits: remaining, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)

    if (error) return dbError("크레딧 차감에 실패했습니다.", error)
    return { success: true, remaining, source: "credit" as const }
  }

  // ② 크레딧 없으면 → 유효한 구독이면 차감 안 함 (무제한)
  if (subscription.plan !== "free") {
    const isExpired = subscription.expires_at && new Date(subscription.expires_at) < new Date()
    if (!isExpired && subscription.status !== "expired") {
      return { success: true, unlimited: true, source: "subscription" as const }
    }
  }

  // ③ 크레딧도 구독도 없음
  return { error: "크레딧이 부족합니다." }
}

export async function getProjectAnalyses(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  const { data, error } = await supabase
    .from("analysis_history")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("analyzed_at", { ascending: false })

  if (error) return dbError("분석 이력 조회에 실패했습니다.", error)
  return { data: data || [] }
}

export async function getAnalysisHistory() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  const { data, error } = await supabase
    .from("analysis_history")
    .select("*")
    .eq("user_id", user.id)
    .order("analyzed_at", { ascending: false })

  if (error) return dbError("분석 이력 조회에 실패했습니다.", error)
  return { data: data || [] }
}

export async function getAnalysisDetail(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  const { data, error } = await supabase
    .from("analysis_history")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error) return { error: "분석 결과를 찾을 수 없습니다." }
  return { data }
}

export async function saveAnalysisHistory(result: {
  /** 없으면 '저장 안 한 분석'으로 남고, 나중에 assignAnalysisToProject로 프로젝트에 넣는다 */
  projectId?: string | null
  /** 프로젝트 안 문서 묶음 이름 (scripts/022). 없으면 화면에서 파일명으로 묶는다 */
  documentName?: string | null
  fileName: string
  score: number
  categories: Record<string, unknown>[]
  strengths: string[]
  weaknesses: string[]
  ranking?: Record<string, unknown>
  companyFeedback?: string
  analysisSource?: string
  readabilityCategories?: Record<string, unknown>[]
  layoutRecommendations?: Record<string, unknown>[]
  // 2026-10 추가 (scripts/020). 마이그레이션 전이면 컬럼 없이 재시도한다.
  designDomain?: string
  modelTier?: string
  tokenUsage?: Record<string, unknown>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  const baseRow = {
    user_id: user.id,
    project_id: result.projectId ?? null,
    file_name: result.fileName,
    overall_score: result.score,
    categories: result.categories,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    ranking: result.ranking,
    company_feedback: result.companyFeedback || "",
    analysis_source: result.analysisSource || "pdf",
    readability_categories: result.readabilityCategories || null,
    layout_recommendations: result.layoutRecommendations || null,
  }
  const extendedRow = {
    ...baseRow,
    ...(result.documentName ? { document_name: result.documentName } : {}),
    design_domain: result.designDomain ?? null,
    model_tier: result.modelTier ?? "basic",
    token_usage: result.tokenUsage ?? null,
  }

  let { data: inserted, error } = await supabase.from("analysis_history").insert(extendedRow).select("id").single()
  if (error && /design_domain|model_tier|token_usage|document_name/.test(error.message)) {
    console.warn("[subscription] analysis_history에 020 컬럼이 없어 기본 컬럼으로만 저장합니다. scripts/020을 실행하세요.")
    ;({ data: inserted, error } = await supabase.from("analysis_history").insert(baseRow).select("id").single())
  }

  if (error) return dbError("분석 결과 저장에 실패했습니다.", error)

  // 프로젝트 updated_at 갱신
  if (result.projectId) {
    await supabase
      .from("projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", result.projectId)
      .eq("user_id", user.id)
  }

  return { success: true, id: (inserted as { id: string } | null)?.id ?? null }
}

/** 저장 안 한 분석을 프로젝트에 넣는다 (분석 결과 화면의 '저장하기') */
export async function assignAnalysisToProject(analysisId: string, projectId: string, documentName?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "로그인이 필요합니다." }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single()
  if (!project) return { error: "프로젝트를 찾을 수 없어요." }

  const name = documentName?.trim().slice(0, 60) || null
  let { error } = await supabase
    .from("analysis_history")
    .update(name ? { project_id: projectId, document_name: name } : { project_id: projectId })
    .eq("id", analysisId)
    .eq("user_id", user.id)
  if (error && /document_name/.test(error.message)) {
    // 022 미적용 — 문서명 없이 저장 (화면은 파일명으로 묶는다)
    ;({ error } = await supabase.from("analysis_history").update({ project_id: projectId }).eq("id", analysisId).eq("user_id", user.id))
  }
  if (error) return dbError("프로젝트에 저장하지 못했어요.", error)

  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", user.id)

  return { success: true }
}

/** 분석 한 건의 문서명 지정 (다른 문서로 옮기기) */
export async function setAnalysisDocument(analysisId: string, documentName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "로그인이 필요합니다." }
  const name = documentName.trim().slice(0, 60)
  if (!name) return { error: "문서명을 입력해 주세요." }
  const { error } = await supabase
    .from("analysis_history")
    .update({ document_name: name })
    .eq("id", analysisId)
    .eq("user_id", user.id)
  if (error) return dbError(/document_name/.test(error.message) ? "문서명 기능을 쓰려면 DB 업데이트(scripts/022)가 필요해요." : "문서명을 바꾸지 못했어요.", error)
  return { success: true }
}

/** 문서 이름 바꾸기 — 그 문서에 묶인 모든 버전을 함께 옮긴다 */
export async function renameDocument(projectId: string, analysisIds: string[], newName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "로그인이 필요합니다." }
  const name = newName.trim().slice(0, 60)
  if (!name) return { error: "문서명을 입력해 주세요." }
  if (analysisIds.length === 0) return { success: true }
  const { error } = await supabase
    .from("analysis_history")
    .update({ document_name: name })
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .in("id", analysisIds)
  if (error) return dbError(/document_name/.test(error.message) ? "문서명 기능을 쓰려면 DB 업데이트(scripts/022)가 필요해요." : "문서명을 바꾸지 못했어요.", error)
  return { success: true }
}

/** 프로젝트에 넣지 않은 분석 목록 (프로젝트 페이지 상단에 노출) */
export async function getUnsavedAnalyses() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "로그인이 필요합니다." }

  const { data, error } = await supabase
    .from("analysis_history")
    .select("id, file_name, overall_score, analyzed_at")
    .eq("user_id", user.id)
    .is("project_id", null)
    .order("analyzed_at", { ascending: false })
    .limit(30)
  if (error) return dbError("분석 목록 조회에 실패했습니다.", error)
  return { data: data ?? [] }
}

// ========== 프로젝트/분석 관리 (삭제, 이름변경) ==========

export async function deleteAnalysis(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  const { error } = await supabase
    .from("analysis_history")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return dbError("분석 삭제에 실패했습니다.", error)
  return { success: true }
}

export async function deleteProject(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  // 하위 분석 먼저 삭제
  const { error: analysisError } = await supabase
    .from("analysis_history")
    .delete()
    .eq("project_id", id)
    .eq("user_id", user.id)

  if (analysisError) return dbError("분석 이력 삭제에 실패했습니다.", analysisError)

  // 프로젝트 삭제
  const { error: projectError } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (projectError) return dbError("프로젝트 삭제에 실패했습니다.", projectError)
  return { success: true }
}

export async function renameProject(id: string, newName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  if (!newName.trim()) return { error: "프로젝트 이름을 입력해 주세요." }

  const { error } = await supabase
    .from("projects")
    .update({ name: newName.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return dbError("이름 변경에 실패했습니다.", error)
  return { success: true }
}
