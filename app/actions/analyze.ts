"use server"

import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"
import { v4 as uuidv4 } from "uuid"
import { checkAnalysisAllowance, saveAnalysisHistory } from "./subscription"

// 분석 전 인증 + 구독 확인
export async function checkBeforeAnalysis() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { allowed: false, reason: "login_required" as const }
  }

  const allowance = await checkAnalysisAllowance()
  if (!allowance.allowed) {
    if (allowance.expired) {
      return { allowed: false, reason: "expired" as const, plan: allowance.plan }
    }
    return { allowed: false, reason: "limit_reached" as const, plan: allowance.plan }
  }

  return { allowed: true, plan: allowance.plan, unlimited: allowance.unlimited, remaining: allowance.remaining }
}

// Supabase Storage에 파일 업로드
export async function uploadFileToStorage(formData: FormData) {
  try {
    const file = formData.get("file") as File
    if (!file) {
      return { error: "파일이 없습니다." }
    }

    // 파일 크기 체크 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return { error: "파일 크기는 50MB를 초과할 수 없습니다." }
    }

    const supabase = await createClient()

    // 고유한 파일명 생성
    const fileExt = file.name.split(".").pop()
    const uniqueFileName = `${uuidv4()}.${fileExt}`
    const filePath = `uploads/${uniqueFileName}`

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Supabase Storage에 업로드
    const { error } = await supabase.storage
      .from("resumes")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error("Upload error:", error)
      return { error: "파일 업로드에 실패했습니다." }
    }

    // Public URL 생성
    const { data: urlData } = supabase.storage
      .from("resumes")
      .getPublicUrl(filePath)

    return {
      data: {
        fileName: file.name,
        filePath: filePath,
        fileUrl: urlData.publicUrl,
        mimeType: file.type,
        size: file.size,
      }
    }
  } catch (error) {
    console.error("Upload error:", error)
    return { error: "파일 업로드 중 오류가 발생했습니다." }
  }
}

// Storage에서 파일 삭제
export async function deleteFileFromStorage(filePath: string) {
  try {
    const supabase = await createClient()
    await supabase.storage.from("resumes").remove([filePath])
    return { success: true }
  } catch (error) {
    console.error("Delete error:", error)
    return { error: "파일 삭제에 실패했습니다." }
  }
}

// Claude API로 문서 분석
export async function analyzeDocumentDirect(input: {
  projectId: string
  fileName: string
  fileUrl: string
  mimeType: string
  filePath: string
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." }
  }

  try {
    const supabase = await createClient()

    // 학습된 포트폴리오 데이터 가져오기
    const { data: portfolios } = await supabase
      .from("portfolios")
      .select("file_name, tags, overall_score, logic_score, specificity_score, readability_score, technical_score, creativity_score, companies, strengths, weaknesses, summary, document_type")
      .order("overall_score", { ascending: false })
      .limit(50)

    // 학습 데이터 통계 및 패턴 분석
    let referenceStats = ""
    const companyStats: Record<string, { total: number; count: number }> = {}

    let avgScores = {
      overall: 85,
      logic: 85,
      specificity: 85,
      readability: 85,
      technical: 85,
      creativity: 85,
    }

    if (portfolios && portfolios.length > 0) {
      avgScores = {
        overall: Math.round(portfolios.reduce((a, b) => a + (b.overall_score || 0), 0) / portfolios.length),
        logic: Math.round(portfolios.reduce((a, b) => a + (b.logic_score || 0), 0) / portfolios.length),
        specificity: Math.round(portfolios.reduce((a, b) => a + (b.specificity_score || 0), 0) / portfolios.length),
        readability: Math.round(portfolios.reduce((a, b) => a + (b.readability_score || 0), 0) / portfolios.length),
        technical: Math.round(portfolios.reduce((a, b) => a + (b.technical_score || 0), 0) / portfolios.length),
        creativity: Math.round(portfolios.reduce((a, b) => a + (b.creativity_score || 0), 0) / portfolios.length),
      }

      portfolios.forEach(p => {
        (p.companies as string[] || []).forEach((company: string) => {
          if (!companyStats[company]) {
            companyStats[company] = { total: 0, count: 0 }
          }
          companyStats[company].total += p.overall_score || 0
          companyStats[company].count += 1
        })
      })

      const allTags = portfolios.flatMap(p => p.tags || [])
      const tagCounts = allTags.reduce((acc: Record<string, number>, tag: string) => {
        acc[tag] = (acc[tag] || 0) + 1
        return acc
      }, {})
      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([tag]) => tag)

      const topExamples = portfolios.slice(0, 10).map((p, idx) => {
        const strengthsList = (p.strengths || []).slice(0, 3).map(s => `  · ${s}`).join("\n")
        const weaknessesList = (p.weaknesses || []).slice(0, 2).map(w => `  · ${w}`).join("\n")
        return `
### 합격 사례 ${idx + 1}: ${p.file_name} (${p.overall_score}점)
- 지원사: ${(p.companies || []).join(", ")}
- 문서유형: ${p.document_type || "포트폴리오"}
- 점수: 논리 ${p.logic_score}점 | 구체성 ${p.specificity_score}점 | 가독성 ${p.readability_score}점 | 기술이해 ${p.technical_score}점 | 창의성 ${p.creativity_score}점
- 핵심 강점:
${strengthsList}
${weaknessesList ? `- 개선 필요:
${weaknessesList}` : ""}
- 요약: ${p.summary || "N/A"}
`
      }).join("\n")

      referenceStats = `
## 📊 학습 데이터 기반 비교 분석 (실제 합격 포트폴리오 ${portfolios.length}개)

### 전체 통계
- 전체 평균: ${avgScores.overall}점
- 논리력 평균: ${avgScores.logic}점 | 구체성 평균: ${avgScores.specificity}점
- 가독성 평균: ${avgScores.readability}점 | 기술이해 평균: ${avgScores.technical}점
- 창의성 평균: ${avgScores.creativity}점
- 주요 키워드: ${topTags.join(", ")}

### 회사별 평균 점수
${Object.entries(companyStats).slice(0, 8).map(([company, stat]) =>
  `- ${company}: ${Math.round(stat.total / stat.count)}점 (${stat.count}개 샘플)`
).join("\n")}

---

## 🎯 실제 합격 포트폴리오 패턴 분석
${topExamples}

---

## ⚠️ 평가 시 주의사항
위 합격 사례들의 **공통 패턴**, **강점 요소**, **문서 구조**를 참고하여 현재 문서를 평가하세요.
특히 다음을 확인:
1. 합격 사례들이 공통적으로 가진 강점을 현재 문서도 갖추었는가?
2. 합격 사례들의 평균 점수 대비 현재 문서의 수준은?
3. 같은 회사 지원 사례가 있다면, 그 수준과 비교했을 때?
`
    }

    const systemPrompt = `당신은 게임 업계 11년차 현업 기획자이자 채용 담당자입니다.
${portfolios?.length || 0}개의 **실제 합격 포트폴리오**를 학습했으며, 그 패턴을 기반으로 현재 문서를 **철저히 비교 평가**해야 합니다.

${referenceStats}

---

## 🚨 절대 규칙 (반드시 지켜야 함!)
1. **문서에 실제로 있는 내용만 언급하세요.** 문서에 없는 내용을 있다고 하면 안 됩니다.
2. **거짓 칭찬 금지**: 비교연구가 없으면 "비교연구가 우수하다"고 하지 마세요. 없는 것은 보완점에 넣으세요.
3. **강점과 보완점이 모순되면 안 됩니다!** 강점에서 "수치 데이터 제시가 좋다"고 하고 보완점에서 "수치 데이터 부족"이라고 하면 안 됩니다. 하나의 주제는 강점 또는 보완점 중 하나에만 넣으세요. 해당 주제가 부분적으로 잘 되어있다면, 구체적으로 어떤 부분이 잘 되어있고 어떤 부분이 부족한지 다른 관점으로 나눠서 작성하세요.
4. **"합격 사례 1번", "합격 사례 3번"처럼 특정 번호를 절대 언급하지 마세요.** 사용자는 학습 데이터를 볼 수 없습니다.
5. **점수에 후하게 주지 마세요.** 부족한 부분은 확실히 낮은 점수를 주세요. 대부분의 문서는 60~80점대입니다.
6. 강점/보완점은 반드시 **문서에서 실제로 확인된 구체적 내용**을 근거로 작성하세요.
7. **강점 6개, 보완점 6개**를 반드시 작성하세요. 각각 서로 다른 관점이어야 합니다.

## 📋 평가 방법
합격 사례들의 공통 패턴과 비교하여 현재 문서를 평가하세요:
1. **문서 구조**: 합격 문서들은 체계적 구조(개요→분석→설계→검증)를 가짐. 현재 문서는?
2. **수치/데이터**: 합격 문서들은 구체적 KPI, 수치 목표가 있음. 현재 문서는?
3. **시각 자료**: 합격 문서들은 다이어그램, 플로우차트, 표를 적극 활용함. 현재 문서는?
4. **비교 분석**: 합격 문서들은 레퍼런스 분석, 경쟁 타이틀 비교가 있음. 현재 문서는?
5. **기술적 깊이**: 합격 문서들은 기술 구현 방안, 제약사항을 다룸. 현재 문서는?

## 평가 항목 (각 0-100점, 엄격하게!)
1. **논리력**: 문제 정의 → 가설 → 해결 → 결과의 논리적 흐름. 논리 비약이 있으면 감점.
2. **구체성**: 수치, 데이터, KPI 포함 여부. "좋다", "많다" 같은 모호한 표현은 감점.
3. **가독성**: 문서 구조, 시각적 정리, 다이어그램/표 활용도. 텍스트만 나열하면 감점.
4. **기술이해**: 게임 개발 기술, 용어, 파이프라인에 대한 이해도. 표면적이면 감점.
5. **창의성**: 독창적인 아이디어, 차별화 요소. 일반적인 내용만 있으면 감점.

## 점수 기준 (합격자 평균: ${avgScores.overall}점)
- 90-100점: 즉시 합격 수준 (합격 상위 문서와 동급)
- 80-89점: 합격 가능 수준 (합격자 평균 근처)
- 70-79점: 보완 필요 (합격까지 개선 필요)
- 60-69점: 상당한 보완 필요
- 60점 미만: 전면 재작성 권장

## 응답 형식 (반드시 JSON만 출력, 다른 텍스트 없이)
{
  "score": 72,
  "categories": [
    { "subject": "논리력", "value": 75, "fullMark": 100 },
    { "subject": "구체성", "value": 65, "fullMark": 100 },
    { "subject": "가독성", "value": 78, "fullMark": 100 },
    { "subject": "기술이해", "value": 70, "fullMark": 100 },
    { "subject": "창의성", "value": 68, "fullMark": 100 }
  ],
  "strengths": [
    "강점1 - 구체적 근거 (예: 4가지 구역으로 기능별 분리한 맵 구조가 체계적)",
    "강점2 - 다른 관점 (예: 200m x 200m 등 구체적 수치 명시)",
    "강점3 - 또 다른 관점 (예: 플로우차트로 플레이어 동선을 시각화)",
    "강점4 - 합격자 평균과 비교한 관점",
    "강점5 - 기술적 관점",
    "강점6 - 차별화 요소"
  ],
  "weaknesses": [
    "보완점1 - 구체적 부족 사항 (예: KPI나 성과 목표 수치가 없음)",
    "보완점2 - 다른 관점 (예: 경쟁 타이틀 비교 분석이 없음)",
    "보완점3 - 또 다른 관점 (예: 밸런스 수치 테이블이 빠져있음)",
    "보완점4 - 합격자 평균 대비 부족한 점",
    "보완점5 - 기술적 관점에서 부족한 점",
    "보완점6 - 개선 방향 제시"
  ]
}

**핵심**: 문서를 꼼꼼히 읽고, 실제로 있는 내용만 강점으로, 실제로 없거나 부족한 내용은 보완점으로 작성하세요. 빈말 칭찬은 사용자에게 해롭습니다.`

    // 파일 다운로드하여 base64로 변환
    const response = await fetch(input.fileUrl)
    if (!response.ok) {
      return { error: "파일을 다운로드할 수 없습니다." }
    }
    const fileBuffer = Buffer.from(await response.arrayBuffer())
    const base64Data = fileBuffer.toString("base64")

    // Claude가 지원하는 미디어 타입 매핑
    const supportedMediaTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ]

    let mediaType = input.mimeType as "application/pdf" | "image/jpeg" | "image/png" | "image/gif" | "image/webp"

    // 지원하지 않는 타입이면 PDF로 기본 설정
    if (!supportedMediaTypes.includes(input.mimeType)) {
      mediaType = "application/pdf"
    }

    try {
      // Claude API 호출
      const anthropic = new Anthropic({ apiKey })

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: "위 문서를 분석해주세요. 시스템 프롬프트의 평가 기준과 합격 사례들을 참고하여 JSON 형식으로만 응답해주세요.",
              },
            ],
          },
        ],
        system: systemPrompt,
      })

      // 응답 텍스트 추출
      const responseText = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map(block => block.text)
        .join("")

      // JSON 파싱
      let jsonStr = responseText
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      } else {
        const objectMatch = responseText.match(/\{[\s\S]*\}/)
        if (objectMatch) {
          jsonStr = objectMatch[0]
        }
      }

      const analysis = JSON.parse(jsonStr)

      // 랭킹 계산 - 항상 187개 기준으로 표시
      const DISPLAY_TOTAL = 187
      const actualTotal = portfolios?.length || 0

      // 실제 데이터 기반으로 백분위 계산 후 187개 기준으로 환산
      let percentile = 50
      let rank = Math.round(DISPLAY_TOTAL / 2) // 기본값: 중간
      if (actualTotal > 0) {
        const betterThan = portfolios!.filter(p => (p.overall_score || 0) < analysis.score).length
        percentile = Math.round((betterThan / actualTotal) * 100)
        // 187개 기준 순위 환산 (최소 1, 최대 187)
        rank = Math.max(1, Math.min(DISPLAY_TOTAL, DISPLAY_TOTAL - Math.round((percentile / 100) * DISPLAY_TOTAL)))
      }

      // 회사별 비교 데이터 - 6개 회사 고정 슬롯
      const fixedCompanies = ["넥슨", "넷마블", "크래프톤", "라이온하트스튜디오", "네오위즈", "웹젠"]
      const companyComparison = fixedCompanies.map(company => {
        // 학습 데이터에서 해당 회사 찾기 (부분 매칭)
        const matchedEntry = Object.entries(companyStats).find(([key]) =>
          key.includes(company) || company.includes(key)
        )
        if (matchedEntry) {
          const [matchedName, stat] = matchedEntry
          return {
            company: matchedName,
            avgScore: Math.round(stat.total / stat.count),
            userScore: analysis.score,
            sampleCount: stat.count,
          }
        }
        // 데이터 없으면 null 표시용
        return {
          company,
          avgScore: 0,
          userScore: analysis.score,
          sampleCount: 0,
        }
      })

      // 고정 6개 + 기타 데이터 있는 회사 추가
      const otherCompanies = Object.entries(companyStats)
        .filter(([key]) => !fixedCompanies.some(fc => key.includes(fc) || fc.includes(key)))
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 2)
        .map(([company, stat]) => ({
          company,
          avgScore: Math.round(stat.total / stat.count),
          userScore: analysis.score,
          sampleCount: stat.count,
        }))

      const allCompanyComparison = [...companyComparison, ...otherCompanies]

      const analysisData = {
        score: analysis.score,
        categories: analysis.categories,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        ranking: {
          total: DISPLAY_TOTAL,
          percentile,
          rank,
          companyComparison: allCompanyComparison
        }
      }

      // 분석 이력 저장
      saveAnalysisHistory({
        projectId: input.projectId,
        fileName: input.fileName,
        score: analysis.score,
        categories: analysis.categories,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        ranking: analysisData.ranking,
      }).catch(() => {})

      return { data: analysisData }
    } finally {
      // Supabase Storage에서 파일 삭제
      const supabaseClient = await createClient()
      await supabaseClient.storage.from("resumes").remove([input.filePath]).catch(() => {})
    }
  } catch (error) {
    console.error("Analysis error:", error)
    return { error: "분석 중 오류가 발생했습니다. 다시 시도해 주세요." }
  }
}
