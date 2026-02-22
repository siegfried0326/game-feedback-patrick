import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // 포트폴리오 데이터 전체 조회
    const { data: portfolios, error: portfolioError } = await supabase
      .from('portfolios')
      .select('id, file_name, companies, overall_score, document_type')
      .order('overall_score', { ascending: false })
      .limit(50)

    if (portfolioError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Portfolio query failed',
          details: portfolioError.message,
          code: portfolioError.code,
          hint: portfolioError.hint,
        },
        { status: 500 }
      )
    }

    // 회사별 통계
    const companyStats: Record<string, number> = {}
    portfolios?.forEach(p => {
      const companies = p.companies as string[] | null
      if (companies && Array.isArray(companies)) {
        companies.forEach((c: string) => {
          companyStats[c] = (companyStats[c] || 0) + 1
        })
      }
    })

    return NextResponse.json({
      success: true,
      portfolios: {
        totalCount: portfolios?.length ?? 0,
        items: portfolios?.map(p => ({
          id: p.id,
          fileName: p.file_name,
          companies: p.companies,
          score: p.overall_score,
          type: p.document_type,
        })),
        companyStats,
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unexpected error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
