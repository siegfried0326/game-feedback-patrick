/**
 * 관리자 임베딩 API 라우트
 *
 * 서버 액션 대신 API 라우트를 사용하는 이유:
 * - Vercel에서 서버 액션은 타임아웃이 짧음 (10초)
 * - API 라우트는 maxDuration으로 명시적 타임아웃 설정 가능
 * - 3개씩 배치 처리하여 안정적으로 동작
 *
 * POST /api/admin/embed
 * Body: { force?: boolean }
 * 응답: { success, data: { total, processed, skipped, failed, remaining, errors } }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { embedAllPortfolios } from "@/lib/vector-search"

// Vercel 타임아웃: 최대 60초 (Hobby 플랜 한도)
export const maxDuration = 55

// 관리자 인증 확인
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export async function POST(request: NextRequest) {
  try {
    // 1. 관리자 인증 확인
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")) {
      return NextResponse.json(
        { success: false, error: "관리자 권한이 필요합니다." },
        { status: 403 }
      )
    }

    // 2. 요청 파라미터
    let force = false
    try {
      const body = await request.json()
      force = body.force === true
    } catch {
      // body 파싱 실패해도 기본값(force=false)으로 진행
    }

    // 3. 배치 임베딩 실행 (한 번에 3개만 — 안정적 타임아웃 범위)
    console.log(`[api/embed] 임베딩 시작 (force=${force})`)
    const result = await embedAllPortfolios(force, 3)

    console.log(`[api/embed] 완료:`, {
      processed: result.processed,
      remaining: result.remaining,
      failed: result.failed,
    })

    return NextResponse.json({
      success: true,
      data: {
        total: result.total,
        processed: result.processed,
        skipped: result.skipped,
        failed: result.failed,
        remaining: result.remaining,
        errors: result.errors.slice(0, 5), // 에러 5개까지만
      },
    })
  } catch (error) {
    console.error("[api/embed] 에러:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "임베딩 실패",
      },
      { status: 500 }
    )
  }
}
