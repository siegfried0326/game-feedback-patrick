"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}

export async function ensureSubscription(userId: string) {
  const supabase = await createClient()

  // 구독 레코드가 있는지 확인
  const { data: existing } = await supabase
    .from("users_subscription")
    .select("id")
    .eq("user_id", userId)
    .single()

  // 없으면 free 플랜 생성
  if (!existing) {
    await supabase.from("users_subscription").insert({
      user_id: userId,
      plan: "free",
      status: "active",
    })
  }
}
