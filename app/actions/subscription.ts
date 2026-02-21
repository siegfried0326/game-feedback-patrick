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

  // 무료 플랜: 1회 제한 확인
  const { count } = await supabase
    .from("analysis_history")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)

  const used = count || 0
  return { allowed: used < 1, remaining: 1 - used, plan: "free" as const }
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

export async function saveAnalysisHistory(result: {
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
      file_name: result.fileName,
      overall_score: result.score,
      categories: result.categories,
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      ranking: result.ranking,
    })

  if (error) return { error: error.message }
  return { success: true }
}
