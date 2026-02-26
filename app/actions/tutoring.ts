"use server"

import { createClient } from "@/lib/supabase/server"
import { confirmPayment } from "./payment"

/**
 * 컨설팅 접근 권한 확인 (로그인만 체크)
 */
export async function checkTutoringAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { allowed: false, error: "로그인이 필요합니다." }

  return { allowed: true }
}

/**
 * 컨설팅 주문 생성
 */
export async function createTutoringOrder(packageType: string, amount: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  const orderId = `TUT_${packageType}_${user.id.slice(0, 8)}_${Date.now()}`

  const { data, error } = await supabase
    .from("tutoring_orders")
    .insert({
      user_id: user.id,
      package_type: packageType,
      amount,
      order_id: orderId,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data, orderId }
}

/**
 * 컨설팅 결제 확인 (토스페이먼츠 결제 승인)
 */
export async function confirmTutoringPayment(paymentKey: string, orderId: string, amount: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  // 서버에서 주문 금액 확인 (클라이언트 값 신뢰하지 않음)
  const { data: order } = await supabase
    .from("tutoring_orders")
    .select("amount")
    .eq("order_id", orderId)
    .eq("user_id", user.id)
    .single()

  if (!order) return { error: "주문 정보를 찾을 수 없습니다." }
  if (order.amount !== amount) return { error: "결제 금액이 일치하지 않습니다." }

  // 토스페이먼츠 결제 확인
  const result = await confirmPayment(paymentKey, orderId, amount)
  if (result.error) return { error: result.error }

  // DB 업데이트
  const { error } = await supabase
    .from("tutoring_orders")
    .update({
      payment_key: paymentKey,
      payment_status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("order_id", orderId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  // 과외 수강생에게 1개월 구독(무제한 분석) 부여
  const now = new Date()
  const { data: existing } = await supabase
    .from("users_subscription")
    .select("*")
    .eq("user_id", user.id)
    .single()

  let expiresAt: Date
  if (existing && existing.plan !== "free" && existing.expires_at && new Date(existing.expires_at) > now) {
    // 기존 구독이 남아있으면 만료일에서 +1개월
    expiresAt = new Date(existing.expires_at)
  } else {
    expiresAt = new Date(now)
  }
  expiresAt.setMonth(expiresAt.getMonth() + 1)

  await supabase.from("users_subscription").upsert({
    user_id: user.id,
    plan: "tutoring",
    status: "active",
    started_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: "user_id" })

  return { success: true }
}
