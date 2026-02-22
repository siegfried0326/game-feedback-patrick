"use server"

import { createClient } from "@/lib/supabase/server"
import { confirmPayment } from "./payment"

/**
 * 과외 접근 권한 확인
 */
export async function checkTutoringAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { allowed: false, error: "로그인이 필요합니다." }

  const { data: subscription } = await supabase
    .from("users_subscription")
    .select("tutoring_enabled")
    .eq("user_id", user.id)
    .single()

  if (!subscription?.tutoring_enabled) {
    return { allowed: false, error: "과외 결제 권한이 없습니다. 1:1 상담을 먼저 진행해주세요." }
  }

  return { allowed: true }
}

/**
 * 과외 주문 생성
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
 * 과외 결제 확인 (토스페이먼츠 결제 승인)
 */
export async function confirmTutoringPayment(paymentKey: string, orderId: string, amount: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

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
  return { success: true }
}
