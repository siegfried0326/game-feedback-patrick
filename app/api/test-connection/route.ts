import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // 테이블 존재 여부 확인
    const { data: tables, error: tablesError } = await supabase
      .from('portfolios')
      .select('count')
      .limit(1)
    
    if (tablesError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database connection failed',
          details: tablesError.message 
        },
        { status: 500 }
      )
    }

    // Storage 버킷 확인
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets()

    const resumesBucket = buckets?.find(b => b.name === 'resumes')

    return NextResponse.json({
      success: true,
      message: 'Supabase connection successful!',
      database: {
        connected: true,
        portfoliosTable: 'exists'
      },
      storage: {
        connected: !bucketsError,
        resumesBucket: resumesBucket ? 'exists' : 'not found (create "resumes" bucket in dashboard)',
        allBuckets: buckets?.map(b => b.name) || []
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
