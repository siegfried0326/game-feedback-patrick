// Supabase 데이터베이스 타입 정의

export interface Portfolio {
  id: string
  
  // 메타데이터
  file_name: string
  companies: string[]
  year: number | null
  document_type: string | null
  
  // AI 분석 결과
  overall_score: number | null
  logic_score: number | null
  specificity_score: number | null
  readability_score: number | null
  technical_score: number | null
  creativity_score: number | null
  
  // 특징 및 요약
  tags: string[]
  summary: string | null
  strengths: string[]
  weaknesses: string[]
  
  // 원본 데이터
  content_text: string | null
  file_url: string | null
  
  // 타임스탬프
  created_at: string
  updated_at: string
}

export interface PortfolioInsert {
  file_name: string
  companies: string[]
  year?: number
  document_type?: string
  content_text?: string
  file_url?: string
}

export interface PortfolioUpdate {
  overall_score?: number
  logic_score?: number
  specificity_score?: number
  readability_score?: number
  technical_score?: number
  creativity_score?: number
  tags?: string[]
  summary?: string
  strengths?: string[]
  weaknesses?: string[]
  updated_at?: string
}

export interface CompanyStats {
  company: string
  portfolio_count: number
  avg_overall_score: number
  avg_logic_score: number
  avg_specificity_score: number
  avg_readability_score: number
  avg_technical_score: number
  avg_creativity_score: number
}

export interface OverallStats {
  total_portfolios: number
  avg_overall_score: number
  avg_logic_score: number
  avg_specificity_score: number
  avg_readability_score: number
  avg_technical_score: number
  avg_creativity_score: number
  percentile_25: number
  percentile_50: number
  percentile_75: number
}
