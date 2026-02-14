import { createClient } from './server'
import type { Portfolio, PortfolioInsert, PortfolioUpdate, CompanyStats, OverallStats } from './types'

/**
 * 포트폴리오 데이터베이스 작업을 위한 유틸리티 함수들
 */

// 포트폴리오 생성
export async function createPortfolio(data: PortfolioInsert) {
  const supabase = await createClient()
  
  const { data: portfolio, error } = await supabase
    .from('portfolios')
    .insert(data)
    .select()
    .single()
  
  if (error) throw error
  return portfolio as Portfolio
}

// 포트폴리오 조회 (ID로)
export async function getPortfolio(id: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as Portfolio
}

// 모든 포트폴리오 조회
export async function getAllPortfolios() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as Portfolio[]
}

// 포트폴리오 업데이트
export async function updatePortfolio(id: string, data: PortfolioUpdate) {
  const supabase = await createClient()
  
  const { data: portfolio, error } = await supabase
    .from('portfolios')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return portfolio as Portfolio
}

// 포트폴리오 삭제
export async function deletePortfolio(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('portfolios')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

// 회사별 통계 조회
export async function getCompanyStats(company?: string) {
  const supabase = await createClient()
  
  let query = supabase
    .from('company_stats')
    .select('*')
  
  if (company) {
    query = query.eq('company', company)
  }
  
  const { data, error } = await query.order('portfolio_count', { ascending: false })
  
  if (error) throw error
  return data as CompanyStats[]
}

// 전체 통계 조회
export async function getOverallStats() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('overall_stats')
    .select('*')
    .single()
  
  if (error) throw error
  return data as OverallStats
}

// 특정 회사 합격자 포트폴리오 조회
export async function getPortfoliosByCompany(company: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .contains('companies', [company])
    .order('overall_score', { ascending: false })
  
  if (error) throw error
  return data as Portfolio[]
}

// 파일 업로드 (Storage)
export async function uploadPortfolioFile(file: File, fileName: string) {
  const supabase = await createClient()
  
  const filePath = `${Date.now()}-${fileName}`
  
  const { data, error } = await supabase
    .storage
    .from('portfolios')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })
  
  if (error) throw error
  
  // Public URL 생성
  const { data: urlData } = supabase
    .storage
    .from('portfolios')
    .getPublicUrl(filePath)
  
  return {
    path: data.path,
    url: urlData.publicUrl
  }
}

// 파일 삭제 (Storage)
export async function deletePortfolioFile(filePath: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .storage
    .from('portfolios')
    .remove([filePath])
  
  if (error) throw error
}
