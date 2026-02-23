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
 * 상담 코드 검증
 */
export async function validateTutoringCode(code: string) {
  if (!code || !code.trim()) {
    return { valid: false, error: "코드를 입력해 주세요." }
  }

  const trimmedCode = code.trim().toUpperCase()

  // 환경변수에서 유효한 코드 목록 가져오기
  const validCodes = (process.env.TUTORING_ACCESS_CODES || "GAMEFB,WELCOME")
    .split(",")
    .map(c => c.trim().toUpperCase())

  if (validCodes.includes(trimmedCode)) {
    return { valid: true }
  }

  return { valid: false, error: "유효하지 않은 코드입니다. 상담을 통해 코드를 받아주세요." }
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
