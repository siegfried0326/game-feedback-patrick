/**
 * 꼬리 질문 생성 API (/api/interview/generate-tail-question)
 *
 * 대화 히스토리를 기반으로 Gemini가 follow-up 질문을 생성.
 *
 * 보안: 관리자 전용 테스트 단계.
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

    const { category, conversationHistory } = await req.json()

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return Response.json(
        { error: "SERVICE_UNAVAILABLE", message: "AI 서비스 설정이 필요합니다." },
        { status: 503 },
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const systemPrompt = `당신은 게임 회사 면접관입니다. 지원자의 답변을 듣고 적절한 꼬리물기 질문을 생성하세요.

카테고리: ${category}

질문 생성 가이드라인:
- 지원자의 답변에서 구체적인 부분을 파고들어 질문하세요
- 실무 경험, 의사결정 과정, 문제 해결 능력을 검증하는 질문을 하세요
- 너무 쉽거나 너무 어려운 질문은 피하세요
- 질문은 자연스럽고 대화체로 작성하세요
- 한 문장으로 간결하게 질문하세요

${category === "진행했던 프로젝트" ? "프로젝트의 구체적인 역할, 어려웠던 점, 해결 방법, 결과물에 대해 질문하세요." : ""}
${category === "포트폴리오" ? "포트폴리오의 기획 의도, 데이터 기반 의사결정, 유저 피드백 반영 등을 질문하세요." : ""}
${category === "좋아하는 게임" ? "게임의 구체적인 시스템, 밸런스, UX, 개선점 등을 분석적으로 질문하세요." : ""}`

    const conversationText = (conversationHistory as Array<{ role: string; content: string }>)
      .map((msg) => `${msg.role === "user" ? "지원자" : "면접관"}: ${msg.content}`)
      .join("\n\n")

    const prompt = `${systemPrompt}

대화 내용:
${conversationText}

위 대화를 바탕으로 다음 질문을 생성하세요. 질문만 작성하고 다른 설명은 하지 마세요.`

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    return Response.json({ question: text.trim(), remaining: 999 })
  } catch (error: unknown) {
    console.error("[interview-tail] 질문 생성 오류:", error)
    const errObj = error as { status?: number; message?: string }

    if (errObj?.status === 429 || errObj?.message?.includes("429") || errObj?.message?.includes("quota") || errObj?.message?.includes("RESOURCE_EXHAUSTED")) {
      return Response.json(
        {
          error: "API_QUOTA_EXCEEDED",
          message: "Google Gemini의 무료 할당량이 초과되었습니다.",
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

    return Response.json({ error: "UNKNOWN_ERROR", message: "질문 생성 중 오류가 발생했습니다." }, { status: 500 })
  }
}
