"use server"

/**
 * 면접 질문 관리자 액션
 *   - listInterviewQuestions: 카테고리별 600문항 조회
 *   - deleteInterviewQuestion: 단일 질문 삭제 (관리자만)
 *   - bulkDeleteInterviewQuestions: 여러 질문 일괄 삭제
 */

import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"
import { revalidatePath } from "next/cache"

export interface InterviewQuestionRow {
  id: number
  category: string
  question: string
  difficulty: string
  created_at: string
}

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    throw new Error("관리자 권한이 필요합니다.")
  }
  return supabase
}

export async function listInterviewQuestions(): Promise<{
  byCategory: Record<string, InterviewQuestionRow[]>
  total: number
  error?: string
}> {
  try {
    const supabase = await assertAdmin()
    const { data, error } = await supabase
      .from("interview_questions")
      .select("id, category, question, difficulty, created_at")
      .order("category", { ascending: true })
      .order("id", { ascending: true })

    if (error) return { byCategory: {}, total: 0, error: error.message }
    const rows = (data || []) as InterviewQuestionRow[]
    const byCategory: Record<string, InterviewQuestionRow[]> = {}
    for (const r of rows) {
      if (!byCategory[r.category]) byCategory[r.category] = []
      byCategory[r.category].push(r)
    }
    return { byCategory, total: rows.length }
  } catch (e) {
    return { byCategory: {}, total: 0, error: e instanceof Error ? e.message : "조회 실패" }
  }
}

export async function deleteInterviewQuestion(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await assertAdmin()
    const { error } = await supabase.from("interview_questions").delete().eq("id", id)
    if (error) return { success: false, error: error.message }
    revalidatePath("/admin/interview-questions")
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "삭제 실패" }
  }
}

export async function bulkDeleteInterviewQuestions(ids: number[]): Promise<{
  success: boolean
  deleted: number
  error?: string
}> {
  try {
    if (!ids.length) return { success: true, deleted: 0 }
    const supabase = await assertAdmin()
    const { error } = await supabase.from("interview_questions").delete().in("id", ids)
    if (error) return { success: false, deleted: 0, error: error.message }
    revalidatePath("/admin/interview-questions")
    return { success: true, deleted: ids.length }
  } catch (e) {
    return { success: false, deleted: 0, error: e instanceof Error ? e.message : "삭제 실패" }
  }
}
