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
import { deleteBillingKey } from "@/lib/toss-api"

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

  // 빌링키가 있으면 토스페이먼츠에서 삭제
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

export async function createProject(name: string, description?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  // 프로젝트 생성 가능 여부 확인
  const allowance = await checkProjectAllowance()
  if (!allowance.allowed) {
    return { error: allowance.reason || "프로젝트를 더 생성할 수 없습니다." }
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

export async function checkProjectAllowance() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { allowed: false, reason: "로그인이 필요합니다." }

  // 구독 확인
  const { data: subscription } = await supabase
    .from("users_subscription")
    .select("*")
    .eq("user_id", user.id)
    .single()

  // 유료 구독 활성 상태: 무제한
  if (subscription && subscription.plan !== "free") {
    const isExpired = subscription.expires_at && new Date(subscription.expires_at) < new Date()
    if (!isExpired && subscription.status !== "expired") {
      return { allowed: true, plan: subscription.plan, unlimited: true }
    }
  }

  // 크레딧이 있으면 프로젝트 생성 허용
  if (subscription && (subscription.analysis_credits || 0) > 0) {
    return { allowed: true, plan: subscription?.plan || "free" }
  }

  // 크레딧도 구독도 없음
  return { allowed: false, plan: "free" as const, reason: "분석 크레딧이 없습니다. 크레딧을 구매하거나 구독해 주세요." }
}

export async function checkAnalysisAllowance() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { allowed: false, plan: "none" as const }

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
export async function deductCredit() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  const { data: subscription } = await supabase
    .from("users_subscription")
    .select("plan, expires_at, status, analysis_credits")
    .eq("user_id", user.id)
    .single()

  if (!subscription) return { error: "구독 정보를 찾을 수 없습니다." }

  // ① 크레딧이 있으면 무조건 크레딧부터 차감 (구독 여부 무관)
  const currentCredits = subscription.analysis_credits || 0
  if (currentCredits > 0) {
    const { error } = await supabase
      .from("users_subscription")
      .update({ analysis_credits: currentCredits - 1, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)

    if (error) return dbError("크레딧 차감에 실패했습니다.", error)
    return { success: true, remaining: currentCredits - 1, source: "credit" as const }
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
  projectId: string
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
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  const { error } = await supabase
    .from("analysis_history")
    .insert({
      user_id: user.id,
      project_id: result.projectId,
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
    })

  if (error) return dbError("분석 결과 저장에 실패했습니다.", error)

  // 프로젝트 updated_at 갱신
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", result.projectId)
    .eq("user_id", user.id)

  return { success: true }
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
