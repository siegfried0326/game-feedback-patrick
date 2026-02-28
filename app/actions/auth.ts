/**
 * 인증 관련 서버 액션
 *
 * - getUser(): 현재 로그인된 사용자 정보 조회
 * - signOut(): 로그아웃 (세션 삭제 + 홈 이동)
 * - ensureSubscription(): 첫 로그인 시 무료(free) 구독 레코드 자동 생성
 *
 * ensureSubscription은 auth/callback/route.ts에서 OAuth 콜백 시 호출됨.
 * 이메일 로그인은 콜백을 거치지 않으므로, subscription.ts의 getSubscription()에서
 * 레코드 미존재 시 fallback으로 생성하는 별도 로직이 있음.
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

/** 현재 로그인된 사용자 정보 반환 (미로그인 시 null) */
export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/** 로그아웃 — 세션 삭제 후 홈(/) 으로 리다이렉트 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}

/**
 * 첫 로그인 시 무료(free) 구독 레코드 자동 생성
 * auth/callback/route.ts에서 OAuth 콜백 처리 시 호출됨.
 *
 * @param userId - 사용자 UUID (auth.users.id)
 */
export async function ensureSubscription(userId: string) {
  const supabase = await createClient()

  // 이미 구독 레코드가 있는지 확인
  const { data: existing } = await supabase
    .from("users_subscription")
    .select("id")
    .eq("user_id", userId)
    .single()

  // 없으면 free 플랜 레코드 삽입
  if (!existing) {
    await supabase.from("users_subscription").insert({
      user_id: userId,
      plan: "free",
      status: "active",
    })
  }
}
