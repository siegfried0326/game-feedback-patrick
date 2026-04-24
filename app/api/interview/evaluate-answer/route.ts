/**
 * 면접 답변 AI 평가 API (/api/interview/evaluate-answer)
 *
 * Gemini 2.5-flash로 면접 답변을 4개 기준(전문성/논리성/구체성/창의성)으로 평가.
 *
 * 보안: 관리자 전용 테스트 단계 (출시 전 검증용).
 *      archive187 크레딧 시스템 통합 후 공개 예정.
 */
import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"

export async function POST(req: Request) {
  try {
    // 관리자 권한 체크 (테스트 단계)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !isAdminEmail(user.email)) {
      return Response.json({ error: "FORBIDDEN", message: "관리자만 접근 가능합니다." }, { status: 403 })
    }

    const { question, answer, difficulty } = await req.json()

    if (!question || !answer) {
      return Response.json({ error: "질문과 답변이 필요합니다." }, { status: 400 })
    }

    // GEMINI_API_KEY 또는 기존 GOOGLE_GENERATIVE_AI_API_KEY 중 사용 가능한 키
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return Response.json(
        { error: "SERVICE_UNAVAILABLE", message: "AI 서비스 설정이 필요합니다." },
        { status: 503 },
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `당신은 게임 회사 면접관입니다. 다음 면접 질문에 대한 지원자의 답변을 평가해주세요.

질문: ${question}
난이도: ${difficulty}
답변: ${answer}

다음 기준으로 평가해주세요:
1. 전문성 (10점): 게임 기획 지식과 업계 이해도
2. 논리성 (10점): 답변의 구조와 논리적 흐름
3. 구체성 (10점): 실제 사례와 구체적인 설명
4. 창의성 (10점): 독창적인 아이디어와 관점

평가 결과를 다음 형식으로 작성해주세요:
- 총점: X/40점
- 전문성: X/10점 - 평가 내용
- 논리성: X/10점 - 평가 내용
- 구체성: X/10점 - 평가 내용
- 창의성: X/10점 - 평가 내용
- 종합 의견: 답변의 강점과 개선점
- 추천 답변: 더 나은 답변 예시`

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // 관리자는 무제한 — remaining은 표시용 더미 값
    return Response.json({ evaluation: text, remaining: 999 })
  } catch (error: unknown) {
    console.error("[interview-evaluate] 평가 오류:", error)
    const errObj = error as { status?: number; message?: string }

    if (errObj?.status === 429 || errObj?.message?.includes("429") || errObj?.message?.includes("quota") || errObj?.message?.includes("RESOURCE_EXHAUSTED")) {
      return Response.json(
        {
          error: "API_QUOTA_EXCEEDED",
          message: "Google Gemini의 무료 할당량이 초과되었습니다.\n📊 무료 한도: 하루 1,500회\n⏰ 초기화 시간: 한국 시간 오후 5시",
        },
        { status: 429 },
      )
    }

    if (errObj?.status === 403 || errObj?.message?.includes("API_KEY_INVALID")) {
      return Response.json({ error: "API_KEY_INVALID", message: "AI 서비스 설정에 문제가 있습니다." }, { status: 403 })
    }

    if (errObj?.status && errObj.status >= 500) {
      return Response.json({ error: "SERVER_ERROR", message: "AI 시스템에 일시적인 문제가 발생했습니다." }, { status: 500 })
    }

    return Response.json({ error: "UNKNOWN_ERROR", message: "평가 중 오류가 발생했습니다." }, { status: 500 })
  }
}
