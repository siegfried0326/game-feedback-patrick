/**
 * 면접 연습용 질문 조회 API (/api/interview/questions)
 *
 * 동작:
 * - category 파라미터 없음 → 카테고리 목록 반환
 * - category 있음 → 해당 카테고리에서 count개 랜덤 질문 반환
 *
 * 보안: 현재 관리자 전용 테스트 단계 (출시 전 검증용)
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"

export async function GET(request: Request) {
  // 관리자 권한 체크 (테스트 단계)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "FORBIDDEN", message: "관리자만 접근 가능합니다." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  const count = Math.max(1, Math.min(100, Number.parseInt(searchParams.get("count") || "3")))

  try {
    if (!category) {
      // 카테고리 목록 반환
      const { data, error } = await supabase
        .from("interview_questions")
        .select("category")
      if (error) throw error
      const unique = Array.from(new Set((data || []).map((r: { category: string }) => r.category)))
      return NextResponse.json({ categories: unique })
    }

    // 해당 카테고리 질문 가져오기
    const { data, error } = await supabase
      .from("interview_questions")
      .select("id, question, difficulty")
      .eq("category", category)
    if (error) throw error

    // 셔플 후 count개 선택
    const shuffled = [...(data || [])].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(count, shuffled.length))

    return NextResponse.json({ questions: selected })
  } catch (error: unknown) {
    console.error("[interview-questions] 조회 오류:", error)
    return NextResponse.json(
      { error: "Failed to fetch questions", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
