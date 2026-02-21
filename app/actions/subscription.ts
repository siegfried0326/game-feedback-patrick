"use server"

import { createClient } from "@/lib/supabase/server"

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
    return { error: error.message }
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

  const { error } = await supabase
    .from("users_subscription")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)

  if (error) return { error: error.message }
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

  if (error) return { error: error.message }

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

  if (error) return { error: error.message }
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

  // 유료 플랜: 만료 확인
  if (subscription && subscription.plan !== "free") {
    const isExpired = subscription.expires_at && new Date(subscription.expires_at) < new Date()
    if (isExpired || subscription.status === "expired") {
      return { allowed: false, plan: subscription.plan, reason: "구독이 만료되었습니다." }
    }
    return { allowed: true, plan: subscription.plan, unlimited: true }
  }

  // 무료 플랜: 프로젝트 1개 제한
  const { count } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)

  const used = count || 0
  if (used >= 1) {
    return { allowed: false, plan: "free" as const, reason: "무료 플랜은 프로젝트 1개까지 가능합니다." }
  }

  return { allowed: true, plan: "free" as const, remaining: 1 - used }
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

  // 유료 플랜: 만료 확인
  if (subscription && subscription.plan !== "free") {
    const isExpired = subscription.expires_at && new Date(subscription.expires_at) < new Date()
    if (isExpired || subscription.status === "expired") {
      return { allowed: false, plan: subscription.plan, expired: true }
    }
    return { allowed: true, plan: subscription.plan, unlimited: true }
  }

  // 무료 플랜: 프로젝트가 있으면 그 안에서 분석 가능
  // (프로젝트 생성은 checkProjectAllowance에서 제한)
  return { allowed: true, plan: "free" as const }
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

  if (error) return { error: error.message }
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

  if (error) return { error: error.message }
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
    })

  if (error) return { error: error.message }

  // 프로젝트 updated_at 갱신
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", result.projectId)
    .eq("user_id", user.id)

  return { success: true }
}
