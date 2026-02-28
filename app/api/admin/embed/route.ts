/**
 * 관리자 임베딩 API 라우트
 *
 * 서버 액션 대신 API 라우트를 사용하는 이유:
 * - "use server" 파일은 maxDuration export 불가
 * - API 라우트는 maxDuration을 직접 설정할 수 있음
 * - Vercel Pro: 최대 60초 타임아웃 적용
 *
 * POST /api/admin/embed
 * Body: { force?: boolean }
 * 응답: { success, data: { total, processed, skipped, failed, remaining, errors } }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { chunkText } from "@/lib/vector-search"
import { generateEmbeddings } from "@/lib/openai-embedding"

// Vercel Pro: API 라우트 최대 실행 시간 60초
export const maxDuration = 60

// 관리자 이메일 목록 (환경변수에서 파싱)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export async function POST(request: NextRequest) {
  // 디버그: 어느 단계에서 실패하는지 추적
  let step = "시작"
  try {
    // ── 1단계: 관리자 인증 확인 ──
    step = "관리자 인증"
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")) {
      return NextResponse.json(
        { success: false, error: "관리자 권한이 필요합니다." },
        { status: 403 }
      )
    }

    // ── 2단계: 요청 파라미터 ──
    step = "요청 파싱"
    let force = false
    try {
      const body = await request.json()
      force = body.force === true
    } catch {
      // body 파싱 실패해도 기본값(force=false)으로 진행
    }

    // ── 3단계: OPENAI_API_KEY 확인 ──
    step = "API 키 확인"
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "OPENAI_API_KEY가 Vercel 환경변수에 없습니다."
      })
    }

    // ── 4단계: 전체 수 + 이미 처리된 ID를 동시에 가져옴 (병렬) ──
    step = "DB 조회"
    const [countResult, chunkedResult] = await Promise.all([
      supabase.from("portfolios").select("id", { count: "exact", head: true }),
      supabase.from("portfolio_chunks").select("portfolio_id"),
    ])

    if (countResult.error) {
      return NextResponse.json({
        success: false,
        error: `portfolios 테이블 조회 실패: ${countResult.error.message}`
      })
    }
    if (chunkedResult.error) {
      return NextResponse.json({
        success: false,
        error: `portfolio_chunks 테이블 조회 실패: ${chunkedResult.error.message}. SQL 마이그레이션(011_add_vector_search.sql)을 실행했는지 확인하세요.`
      })
    }

    const totalCount = countResult.count || 0
    const processedIds = [...new Set(
      (chunkedResult.data || []).map((c: { portfolio_id: string }) => c.portfolio_id)
    )]

    // ── 5단계: 처리 안 된 포트폴리오 1개 찾기 ──
    step = "미처리 포트폴리오 검색"
    let query = supabase
      .from("portfolios")
      .select("id, file_name, content_text, summary, strengths, weaknesses, tags, companies, document_type")
      .order("created_at", { ascending: true })
      .limit(1)

    // 이미 처리된 포트폴리오 제외 (force 모드가 아닐 때)
    if (!force && processedIds.length > 0) {
      query = query.not("id", "in", `(${processedIds.join(",")})`)
    }

    const { data: portfolios, error: queryError } = await query

    if (queryError) {
      return NextResponse.json({
        success: false,
        error: `포트폴리오 조회 실패: ${queryError.message}`
      })
    }

    if (!portfolios || portfolios.length === 0) {
      // 더 이상 처리할 포트폴리오 없음 — 완료
      return NextResponse.json({
        success: true,
        data: { total: totalCount, processed: 0, failed: 0, skipped: processedIds.length, remaining: 0, errors: [] }
      })
    }

    const portfolio = portfolios[0]
    const remaining = Math.max(0, totalCount - processedIds.length - 1)

    // ── 6단계: 텍스트 확보 ──
    step = `텍스트 추출 (${portfolio.file_name})`
    let text = portfolio.content_text
    if (!text || text.trim().length < 50) {
      const parts: string[] = []
      if (portfolio.file_name) parts.push(`파일: ${portfolio.file_name}`)
      if (portfolio.document_type) parts.push(`문서유형: ${portfolio.document_type}`)
      if (portfolio.companies?.length) parts.push(`회사: ${portfolio.companies.join(", ")}`)
      if (portfolio.summary) parts.push(`요약: ${portfolio.summary}`)
      if (portfolio.strengths?.length) parts.push(`강점: ${portfolio.strengths.join(". ")}`)
      if (portfolio.weaknesses?.length) parts.push(`약점: ${portfolio.weaknesses.join(". ")}`)
      if (portfolio.tags?.length) parts.push(`키워드: ${portfolio.tags.join(", ")}`)
      text = parts.join("\n\n")
    }

    if (!text || text.trim().length < 30) {
      return NextResponse.json({
        success: true,
        data: { total: totalCount, processed: 0, failed: 0, skipped: processedIds.length + 1, remaining, errors: [`${portfolio.file_name}: 텍스트 부족`] }
      })
    }

    // ── 7단계: 청크 분할 (최대 20개) ──
    step = "청크 분할"
    const chunks = chunkText(text).slice(0, 20)
    if (chunks.length === 0) {
      return NextResponse.json({
        success: true,
        data: { total: totalCount, processed: 0, failed: 0, skipped: processedIds.length + 1, remaining, errors: [`${portfolio.file_name}: 텍스트 부족`] }
      })
    }

    // ── 8단계: force 모드면 기존 청크 삭제 ──
    if (force) {
      step = "기존 청크 삭제"
      await supabase.from("portfolio_chunks").delete().eq("portfolio_id", portfolio.id)
    }

    // ── 9단계: OpenAI 임베딩 생성 ──
    step = `OpenAI 임베딩 (${chunks.length}개 청크)`
    const embeddings = await generateEmbeddings(chunks)

    // ── 10단계: DB에 저장 ──
    step = "DB 저장"
    const rows = chunks.map((chunk, idx) => ({
      portfolio_id: portfolio.id,
      chunk_index: idx,
      chunk_text: chunk,
      embedding: JSON.stringify(embeddings[idx]),
      metadata: {
        companies: portfolio.companies,
        documentType: portfolio.document_type,
        fileName: portfolio.file_name,
      },
    }))

    const { error: insertError } = await supabase.from("portfolio_chunks").insert(rows)

    if (insertError) {
      return NextResponse.json({
        success: true,
        data: { total: totalCount, processed: 0, failed: 1, skipped: processedIds.length, remaining, errors: [`${portfolio.file_name}: DB 저장 실패 — ${insertError.message}`] }
      })
    }

    return NextResponse.json({
      success: true,
      data: { total: totalCount, processed: 1, failed: 0, skipped: processedIds.length, remaining, errors: [] }
    })
  } catch (error) {
    console.error(`[api/embed] [${step}] 에러:`, error)
    return NextResponse.json(
      {
        success: false,
        error: `[${step}] 실패: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}
