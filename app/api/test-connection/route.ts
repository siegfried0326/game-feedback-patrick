import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // 전체 포트폴리오 조회
    const { data: portfolios, error: portfolioError } = await supabase
      .from('portfolios')
      .select('id, file_name, companies')
      .order('created_at', { ascending: false })

    if (portfolioError) {
      return NextResponse.json({ success: false, error: portfolioError.message }, { status: 500 })
    }

    // 회사별 파일 목록
    const companyFiles: Record<string, string[]> = {}
    const noCompanyFiles: string[] = []

    portfolios?.forEach(p => {
      const companies = p.companies as string[] | null
      if (companies && Array.isArray(companies) && companies.length > 0) {
        companies.forEach((c: string) => {
          if (!companyFiles[c]) companyFiles[c] = []
          companyFiles[c].push(p.file_name)
        })
      } else {
        noCompanyFiles.push(p.file_name)
      }
    })

    // 회사별 개수 요약
    const companyCounts: Record<string, number> = {}
    Object.entries(companyFiles).forEach(([company, files]) => {
      companyCounts[company] = files.length
    })

    const response = NextResponse.json({
      success: true,
      total: portfolios?.length ?? 0,
      companyCounts,
      noCompanyCount: noCompanyFiles.length,
      companyFiles,
      noCompanyFiles: noCompanyFiles.slice(0, 50),
    })

    response.headers.set('Content-Type', 'application/json; charset=utf-8')
    return response
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
