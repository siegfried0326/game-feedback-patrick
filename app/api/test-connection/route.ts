import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // 전체 포트폴리오 조회 (limit 없이)
    const { data: portfolios, error: portfolioError } = await supabase
      .from('portfolios')
      .select('id, file_name, companies')
      .order('created_at', { ascending: false })

    if (portfolioError) {
      return NextResponse.json({ success: false, error: portfolioError.message }, { status: 500 })
    }

    // 회사별 통계 (DB에 저장된 그대로)
    const rawCompanyStats: Record<string, number> = {}
    const noCompany: string[] = []

    portfolios?.forEach(p => {
      const companies = p.companies as string[] | null
      if (companies && Array.isArray(companies) && companies.length > 0) {
        companies.forEach((c: string) => {
          rawCompanyStats[c] = (rawCompanyStats[c] || 0) + 1
        })
      } else {
        noCompany.push(p.file_name)
      }
    })

    return NextResponse.json({
      success: true,
      total: portfolios?.length ?? 0,
      rawCompanyStats,
      noCompanyCount: noCompany.length,
      noCompanyFiles: noCompany.slice(0, 30),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
