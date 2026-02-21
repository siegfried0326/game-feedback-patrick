import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { ensureSubscription } from "@/app/actions/auth"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // 첫 로그인 시 free 구독 생성
      await ensureSubscription(data.user.id)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
