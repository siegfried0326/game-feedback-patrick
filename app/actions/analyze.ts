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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: "로그인이 필요합니다." }
    }

    const file = formData.get("file") as File
    if (!file) {
      return { error: "파일이 없습니다." }
    }

    // 허용된 파일 타입만
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return { error: "PDF, JPG, PNG, WebP 파일만 업로드할 수 있습니다." }
    }

    // 파일 크기 체크 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return { error: "파일 크기는 50MB를 초과할 수 없습니다." }
    }

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: "로그인이 필요합니다." }
    }
    await supabase.storage.from("resumes").remove([filePath])
    return { success: true }
  } catch (error) {
    console.error("Delete error:", error)
    return { error: "파일 삭제에 실패했습니다." }
  }
}

// 사용자 구독 플랜에 따라 Claude 모델 선택
async function getModelForUser(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return "claude-sonnet-4-20250514"

    const { data: subscription } = await supabase
      .from("users_subscription")
      .select("plan, status, expires_at")
      .eq("user_id", user.id)
      .single()

    // 3개월 패스 (active, 미만료) → Claude Opus
    if (
      subscription?.plan === "three_month" &&
      subscription.status === "active" &&
      (!subscription.expires_at || new Date(subscription.expires_at) > new Date())
    ) {
      return "claude-opus-4-20250514"
    }
  } catch {
    // fallback to sonnet
  }

  // free, monthly → Claude Sonnet
  return "claude-sonnet-4-20250514"
}

// URL이 내부 네트워크를 가리키는지 검사 (SSRF 방어)
function isInternalUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    const hostname = url.hostname.toLowerCase()
    // 내부 IP / localhost 차단
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      hostname.startsWith("192.168.") ||
      hostname.endsWith(".local") ||
      hostname === "[::1]" ||
      url.protocol === "file:"
    ) {
      return true
    }
    return false
  } catch {
    return true // 파싱 실패 시 차단
  }
}

// URL 웹페이지 크롤링 → Claude 분석
export async function analyzeUrlDirect(input: {
  projectId: string
  url: string
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." }
  }

  // URL 검증
  if (isInternalUrl(input.url)) {
    return { error: "허용되지 않는 URL입니다." }
  }

  try {
    const supabase = await createClient()

    // 웹페이지 HTML 가져오기
    let pageContent = ""
    try {
      const response = await fetch(input.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; GameFeedbackBot/1.0)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        return { error: `웹 페이지를 가져올 수 없습니다. (HTTP ${response.status})` }
      }

      const html = await response.text()

      // HTML에서 텍스트 추출 (간단한 태그 제거)
      pageContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim()

      // 너무 짧으면 오류
      if (pageContent.length < 100) {
        return { error: "페이지에서 충분한 텍스트를 추출할 수 없습니다. 공개 접근이 가능한 URL인지 확인해 주세요." }
      }

      // 너무 길면 잘라내기 (Claude 컨텍스트 제한)
      if (pageContent.length > 100000) {
        pageContent = pageContent.substring(0, 100000)
      }
    } catch (fetchError: unknown) {
      if (fetchError instanceof Error && fetchError.name === "TimeoutError") {
        return { error: "웹 페이지 응답 시간이 초과되었습니다. URL을 다시 확인해 주세요." }
      }
      return { error: "웹 페이지를 가져올 수 없습니다. URL이 올바르고 공개 접근이 가능한지 확인해 주세요." }
    }

    // 이하 분석 로직은 analyzeDocumentDirect와 동일한 패턴
    const { data: portfolios, error: portfolioError } = await supabase
      .from("portfolios")
      .select("file_name, tags, overall_score, logic_score, specificity_score, readability_score, technical_score, creativity_score, companies, strengths, weaknesses, summary, document_type")
      .order("overall_score", { ascending: false })
      .limit(50)

    if (portfolioError) {
      console.error("Portfolio fetch error:", portfolioError.message, portfolioError.code, portfolioError.details)
    }
    console.log("Portfolio query result:", {
      hasData: !!portfolios,
      count: portfolios?.length ?? 0,
      error: portfolioError?.message ?? null,
      firstItem: portfolios?.[0] ? { file_name: portfolios[0].file_name, companies: portfolios[0].companies } : null,
    })

    let referenceStats = ""
    const companyStats: Record<string, { total: number; count: number }> = {}

    let avgScores = {
      overall: 85, logic: 85, specificity: 85, readability: 85, technical: 85, creativity: 85,
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
3. **강점과 보완점이 모순되면 안 됩니다!** 강점에서 "수치 데이터 제시가 좋다"고 하고 보완점에서 "수치 데이터 부족"이라고 하면 안 됩니다. 하나의 주제는 강점 또는 보완점 중 하나에만 넣으세요.
4. **"합격 사례 1번", "합격 사례 3번"처럼 특정 번호를 절대 언급하지 마세요.** 사용자는 학습 데이터를 볼 수 없습니다.
4-1. **companyFeedback에서 "~사례처럼", "~처럼" 표현 절대 금지.** 사용자는 합격자 포트폴리오를 볼 수 없습니다. "넥슨 합격자들은 ~한 특징이 있습니다"처럼 합격자 특징을 주어로 서술하세요.
5. **점수에 후하게 주지 마세요.** 부족한 부분은 확실히 낮은 점수를 주세요. 대부분의 문서는 60~80점대입니다.
6. 강점/보완점은 반드시 **문서에서 실제로 확인된 구체적 내용**을 근거로 작성하세요.
7. **강점 6개, 보완점 6개**를 반드시 작성하세요. 각각 서로 다른 관점이어야 합니다.
8. **이 문서는 웹 페이지(URL)에서 추출된 텍스트입니다.** 원본은 웹 페이지이므로 시각적 요소(이미지, 레이아웃)는 평가할 수 없습니다. 텍스트 내용 중심으로 평가하세요.

## 📋 평가 방법
합격 사례들의 공통 패턴과 비교하여 현재 문서를 평가하세요:
1. **문서 구조**: 합격 문서들은 체계적 구조를 가짐. 현재 문서는?
2. **수치/데이터**: 합격 문서들은 구체적 KPI, 수치 목표가 있음. 현재 문서는?
3. **비교 분석**: 합격 문서들은 레퍼런스 분석, 경쟁 타이틀 비교가 있음. 현재 문서는?
4. **기술적 깊이**: 합격 문서들은 기술 구현 방안, 제약사항을 다룸. 현재 문서는?
5. **콘텐츠 깊이**: 내용의 전문성과 깊이가 합격 수준인지?

## 평가 항목 (각 0-100점, 엄격하게!)

### 기본 역량 (5개)
1. **논리력**: 문제 정의 → 가설 → 해결 → 결과의 논리적 흐름.
2. **구체성**: 수치, 데이터, KPI 포함 여부.
3. **가독성**: 문서 구조, 정리 상태.
4. **기술이해**: 게임 개발 기술, 용어, 파이프라인에 대한 이해도.
5. **창의성**: 독창적인 아이디어, 차별화 요소.

### 게임 디자인 역량 (10개)
6. **핵심 반복 구조**: 플레이어가 게임에서 가장 자주 반복하는 행동의 흐름(예: 이동→전투→보상→강화→다시 이동)이 명확하게 정의되어 있는가. 버튼을 누르면 무슨 일이 일어나고, 그 결과가 플레이어에게 어떻게 전달되는지 구체적인가.
7. **콘텐츠 분류 체계**: 게임의 모든 요소(캐릭터, 스킬, 아이템, 몬스터 등)가 겹치지 않고 빠짐없이 나뉘어 정리되었는가. 큰 분류에서 작은 분류로 체계적으로 나누는 구조가 있는가.
8. **재화 흐름 설계**: 게임 안에서 돈이나 자원이 어디서 생기고, 어디에 쓰이고, 어디서 사라지는지가 설계되었는가. 자원이 한없이 쌓이기만 하는 문제를 막는 구조가 있는가.
9. **플레이 경험 목표**: 이 게임을 하면서 플레이어가 느꼈으면 하는 감정이나 경험(예: 도전감, 탐험의 재미, 이야기 몰입, 친구와 함께하는 즐거움 등)이 명확하고, 그 경험을 만들기 위해 어떤 게임 규칙을 넣었는지 연결이 되는가.
10. **수치 데이터 정리**: 게임에 들어가는 숫자 데이터(캐릭터 능력치, 아이템 수치, 몬스터 정보 등)가 표 형태로 정리되어 있는가. 예시 데이터가 포함되어 있고, 각 표끼리 어떻게 연결되는지 설명이 있는가.
11. **기능 간 연결 관계**: 게임의 가장 핵심 기능이 무엇이고, 거기에 붙는 추가 기능들(아이템, 스킬, 장비 등)이 어떤 순서로 연결되는지 그림이나 도표로 표현되었는가. 무엇을 먼저 만들고 나중에 확장할지 순서가 있는가.
12. **동기 부여 설계**: 게임을 왜 계속하고 싶게 만드는지가 설계되었는가. 오늘 접속하면 뭘 하고(단기), 이번 주에 뭘 목표로 하고(중기), 몇 달 뒤에 뭘 달성하는지(장기) 단계별로 나뉘어 있는가.
13. **난이도 균형**: 게임이 너무 쉽지도 어렵지도 않게 조절하는 설계가 있는가. 초반부터 후반까지 난이도가 어떻게 올라가는지, 잘하는 사람이 너무 강해지는 걸 막는 장치가 있는지 고려되었는가.
14. **화면 및 조작 설계**: 게임 화면 구성(메뉴, 버튼 배치 등)의 밑그림이 포함되었는가. 모든 메뉴에서 조작 방법이 통일되어 있으면서도, 전투/탐험/퍼즐 등 다양한 플레이 경험을 제공하는가.
15. **개발 일정 및 산출물**: 개발을 어떤 단계로 나눠서 진행하는지(기획→첫 버전→테스트→출시) 계획이 있는가. 기능 목록, 테스트 항목, 수치 조정표 같은 실무에서 쓰는 문서가 포함되었는가.

## 점수 기준 (합격자 평균: ${avgScores.overall}점)
- 90-100점: 즉시 합격 수준
- 80-89점: 합격 가능 수준
- 70-79점: 보완 필요
- 60-69점: 상당한 보완 필요
- 60점 미만: 전면 재작성 권장

**게임 디자인 역량 채점 주의**: 문서가 게임 기획서가 아닌 일반 포트폴리오인 경우, 해당 항목들은 관련 내용이 전혀 없으면 0점, 간접적으로라도 언급이 있으면 그 수준에 맞게 채점하세요.

**게임 디자인 역량 feedback 작성 규칙**: 각 항목의 feedback은 반드시 3줄 이상 작성하세요. 합격자 자료와 비교하여 [강점]과 [보완]을 구분해서 작성하세요.
- [강점]으로 시작하는 줄: 이 문서에서 해당 항목이 잘 된 부분
- [보완]으로 시작하는 줄: 합격자들과 비교했을 때 부족한 부분과 구체적 개선 방향
- 해당 항목이 전혀 없으면 [보완]만 작성하되, 합격자들은 어떻게 하는지 설명

## 응답 형식 (반드시 JSON만 출력, 다른 텍스트 없이)
{
  "score": 72,
  "categories": [
    { "subject": "논리력", "value": 75, "fullMark": 100, "feedback": "[강점] 잘 된 부분 설명.\\n[보완] 합격자들과 비교하여 부족한 점과 개선 방향. 3줄 이상 작성." },
    { "subject": "구체성", "value": 65, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 합격자 비교 부족한 점. 3줄 이상." },
    { "subject": "가독성", "value": 78, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "기술이해", "value": 70, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "창의성", "value": 68, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "핵심반복구조", "value": 60, "fullMark": 100, "feedback": "[강점] 이동→전투→보상의 기본 순환이 정의됨.\\n[보완] 합격자들은 각 단계별 소요 시간과 보상 비율까지 구체적으로 설계합니다. 이 문서는 흐름만 있고 수치가 없어 실무 적용이 어렵습니다." },
    { "subject": "콘텐츠분류", "value": 55, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 합격자 비교 부족한 점. 3줄 이상." },
    { "subject": "재화흐름", "value": 40, "fullMark": 100, "feedback": "[보완] 합격자들은 재화 획득/소비/소멸 경로를 도표로 정리합니다. 이 문서에는 재화 흐름 관련 내용이 없습니다." },
    { "subject": "플레이경험", "value": 65, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "수치데이터", "value": 30, "fullMark": 100, "feedback": "[보완] 합격자들은 캐릭터/아이템/몬스터 수치를 표로 정리합니다. 이 문서에는 수치 테이블이 없습니다." },
    { "subject": "기능연결", "value": 50, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "동기부여", "value": 45, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "난이도균형", "value": 35, "fullMark": 100, "feedback": "[보완] 부족한 점. 3줄 이상." },
    { "subject": "화면조작", "value": 55, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "개발일정", "value": 40, "fullMark": 100, "feedback": "[보완] 부족한 점. 3줄 이상." }
  ],
  "strengths": ["강점1", "강점2", "강점3", "강점4", "강점5", "강점6"],
  "weaknesses": ["보완점1", "보완점2", "보완점3", "보완점4", "보완점5", "보완점6"],
  "companyFeedback": "회사별 합격자 특징을 주어로 시작하여 비교. 예: '넥슨 합격자들은 수치 기반 시스템 설계가 탄탄하고, 크래프톤 합격자들은 전투 경험 목표가 구체적입니다. 이 문서는 ~가 부족하여 합격 수준에 도달하려면 ~를 보완해야 합니다.' 3~4문장으로. 절대 '~사례처럼', '~처럼' 표현 금지. 사용자는 합격자 포트폴리오를 볼 수 없으므로 '합격자들은 ~한 특징이 있다'는 식으로 서술."
}`

    const anthropic = new Anthropic({ apiKey })
    const selectedModel = await getModelForUser()

    const message = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `아래는 웹 페이지(${input.url})에서 추출한 텍스트 내용입니다. 이 내용을 게임 기획 포트폴리오로서 분석해주세요. 시스템 프롬프트의 평가 기준과 합격 사례들을 참고하여 JSON 형식으로만 응답해주세요. 반드시 15개 categories와 companyFeedback을 모두 포함해야 합니다.\n\n---\n\n${pageContent}`,
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

    // 랭킹 계산
    const DISPLAY_TOTAL = 187
    const actualTotal = portfolios?.length || 0
    let percentile = 50
    let rank = Math.round(DISPLAY_TOTAL / 2)
    if (actualTotal > 0) {
      const betterThan = portfolios!.filter(p => (p.overall_score || 0) < analysis.score).length
      percentile = Math.round((betterThan / actualTotal) * 100)
      rank = Math.max(1, Math.min(DISPLAY_TOTAL, DISPLAY_TOTAL - Math.round((percentile / 100) * DISPLAY_TOTAL)))
    }

    // 회사별 비교 데이터 - 모든 회사 항상 표시 (데이터 없으면 전체 평균 사용)
    const companyComparison: { company: string; avgScore: number; userScore: number; sampleCount: number }[] = []
    const targetCompanies = ["넥슨", "넷마블", "웹젠", "크래프톤", "스마일게이트", "네오위즈", "펄어비스", "엔씨소프트"]
    targetCompanies.forEach(company => {
      const matchedEntry = Object.entries(companyStats).find(([key]) =>
        key.includes(company) || company.includes(key)
      )
      if (matchedEntry && matchedEntry[1].count > 0) {
        companyComparison.push({
          company,
          avgScore: Math.round(matchedEntry[1].total / matchedEntry[1].count),
          userScore: analysis.score,
          sampleCount: matchedEntry[1].count,
        })
      } else {
        companyComparison.push({
          company,
          avgScore: avgScores.overall,
          userScore: analysis.score,
          sampleCount: 0,
        })
      }
    })
    companyComparison.push({
      company: "전체 합격자",
      avgScore: avgScores.overall,
      userScore: analysis.score,
      sampleCount: portfolios?.length || 0,
    })

    const analysisData = {
      score: analysis.score,
      categories: analysis.categories,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      companyFeedback: analysis.companyFeedback || "",
      analysisSource: "url" as const,
      ranking: {
        total: DISPLAY_TOTAL,
        percentile,
        rank,
        companyComparison,
      }
    }

    // 분석 이력 저장
    saveAnalysisHistory({
      projectId: input.projectId,
      fileName: input.url,
      score: analysis.score,
      categories: analysis.categories,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      ranking: analysisData.ranking,
      companyFeedback: analysis.companyFeedback || "",
      analysisSource: "url",
    }).catch(() => {})

    return { data: analysisData }
  } catch (error) {
    console.error("URL Analysis error:", error)
    return { error: "URL 분석 중 오류가 발생했습니다. 다시 시도해 주세요." }
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
    const { data: portfolios, error: portfolioError } = await supabase
      .from("portfolios")
      .select("file_name, tags, overall_score, logic_score, specificity_score, readability_score, technical_score, creativity_score, companies, strengths, weaknesses, summary, document_type")
      .order("overall_score", { ascending: false })
      .limit(50)

    if (portfolioError) {
      console.error("Portfolio fetch error:", portfolioError.message, portfolioError.code, portfolioError.details)
    }
    console.log("Portfolio query result (document):", {
      hasData: !!portfolios,
      count: portfolios?.length ?? 0,
      error: portfolioError?.message ?? null,
      firstItem: portfolios?.[0] ? { file_name: portfolios[0].file_name, companies: portfolios[0].companies } : null,
    })

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
4-1. **companyFeedback에서 "~사례처럼", "~처럼" 표현 절대 금지.** 사용자는 합격자 포트폴리오를 볼 수 없습니다. "넥슨 합격자들은 ~한 특징이 있습니다"처럼 합격자 특징을 주어로 서술하세요.
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

### 기본 역량 (5개)
1. **논리력**: 문제 정의 → 가설 → 해결 → 결과의 논리적 흐름. 논리 비약이 있으면 감점.
2. **구체성**: 수치, 데이터, KPI 포함 여부. "좋다", "많다" 같은 모호한 표현은 감점.
3. **가독성**: 문서 구조, 시각적 정리, 다이어그램/표 활용도. 텍스트만 나열하면 감점.
4. **기술이해**: 게임 개발 기술, 용어, 파이프라인에 대한 이해도. 표면적이면 감점.
5. **창의성**: 독창적인 아이디어, 차별화 요소. 일반적인 내용만 있으면 감점.

### 게임 디자인 역량 (10개)
6. **핵심 반복 구조**: 플레이어가 게임에서 가장 자주 반복하는 행동의 흐름(예: 이동→전투→보상→강화→다시 이동)이 명확하게 정의되어 있는가. 버튼을 누르면 무슨 일이 일어나고, 그 결과가 플레이어에게 어떻게 전달되는지 구체적인가.
7. **콘텐츠 분류 체계**: 게임의 모든 요소(캐릭터, 스킬, 아이템, 몬스터 등)가 겹치지 않고 빠짐없이 나뉘어 정리되었는가. 큰 분류에서 작은 분류로 체계적으로 나누는 구조가 있는가.
8. **재화 흐름 설계**: 게임 안에서 돈이나 자원이 어디서 생기고, 어디에 쓰이고, 어디서 사라지는지가 설계되었는가. 자원이 한없이 쌓이기만 하는 문제를 막는 구조가 있는가.
9. **플레이 경험 목표**: 이 게임을 하면서 플레이어가 느꼈으면 하는 감정이나 경험(예: 도전감, 탐험의 재미, 이야기 몰입, 친구와 함께하는 즐거움 등)이 명확하고, 그 경험을 만들기 위해 어떤 게임 규칙을 넣었는지 연결이 되는가.
10. **수치 데이터 정리**: 게임에 들어가는 숫자 데이터(캐릭터 능력치, 아이템 수치, 몬스터 정보 등)가 표 형태로 정리되어 있는가. 예시 데이터가 포함되어 있고, 각 표끼리 어떻게 연결되는지 설명이 있는가.
11. **기능 간 연결 관계**: 게임의 가장 핵심 기능이 무엇이고, 거기에 붙는 추가 기능들(아이템, 스킬, 장비 등)이 어떤 순서로 연결되는지 그림이나 도표로 표현되었는가. 무엇을 먼저 만들고 나중에 확장할지 순서가 있는가.
12. **동기 부여 설계**: 게임을 왜 계속하고 싶게 만드는지가 설계되었는가. 오늘 접속하면 뭘 하고(단기), 이번 주에 뭘 목표로 하고(중기), 몇 달 뒤에 뭘 달성하는지(장기) 단계별로 나뉘어 있는가.
13. **난이도 균형**: 게임이 너무 쉽지도 어렵지도 않게 조절하는 설계가 있는가. 초반부터 후반까지 난이도가 어떻게 올라가는지, 잘하는 사람이 너무 강해지는 걸 막는 장치가 있는지 고려되었는가.
14. **화면 및 조작 설계**: 게임 화면 구성(메뉴, 버튼 배치 등)의 밑그림이 포함되었는가. 모든 메뉴에서 조작 방법이 통일되어 있으면서도, 전투/탐험/퍼즐 등 다양한 플레이 경험을 제공하는가.
15. **개발 일정 및 산출물**: 개발을 어떤 단계로 나눠서 진행하는지(기획→첫 버전→테스트→출시) 계획이 있는가. 기능 목록, 테스트 항목, 수치 조정표 같은 실무에서 쓰는 문서가 포함되었는가.

## 점수 기준 (합격자 평균: ${avgScores.overall}점)
- 90-100점: 즉시 합격 수준 (합격 상위 문서와 동급)
- 80-89점: 합격 가능 수준 (합격자 평균 근처)
- 70-79점: 보완 필요 (합격까지 개선 필요)
- 60-69점: 상당한 보완 필요
- 60점 미만: 전면 재작성 권장

**게임 디자인 역량 채점 주의**: 문서가 게임 기획서가 아닌 일반 포트폴리오인 경우, 해당 항목들은 관련 내용이 전혀 없으면 0점, 간접적으로라도 언급이 있으면 그 수준에 맞게 채점하세요.

**게임 디자인 역량 feedback 작성 규칙**: 각 항목의 feedback은 반드시 3줄 이상 작성하세요. 합격자 자료와 비교하여 [강점]과 [보완]을 구분해서 작성하세요.
- [강점]으로 시작하는 줄: 이 문서에서 해당 항목이 잘 된 부분
- [보완]으로 시작하는 줄: 합격자들과 비교했을 때 부족한 부분과 구체적 개선 방향
- 해당 항목이 전혀 없으면 [보완]만 작성하되, 합격자들은 어떻게 하는지 설명

### 문서 가독성 평가 (10개) - PDF 문서 전용
이 문서는 PDF로 업로드되었으므로, 문서의 시각적 상태를 직접 보고 평가하세요.
16. **글자 크기 구분**: 제목, 소제목, 본문의 글자 크기가 확실히 다른가. 한눈에 무엇이 제목이고 무엇이 본문인지 알 수 있는가.
17. **문단 나누기**: 내용이 적절한 길이로 문단이 나뉘어 있는가. 한 문단이 너무 길지 않은가. 관련 있는 내용끼리 묶여 있는가.
18. **여백 활용**: 글과 글 사이, 그림과 글 사이에 충분한 여백이 있는가. 페이지가 너무 빽빽하지 않은가.
19. **색상 활용**: 색을 써서 중요한 부분을 구분하거나 강조했는가. 배경과 글자의 색 차이가 충분한가.
20. **표와 그림 배치**: 표, 차트, 이미지가 관련 내용 근처에 적절한 크기로 배치되어 있는가. 너무 크거나 작지 않은가.
21. **페이지 구성**: 각 페이지가 깔끔하게 구성되어 있는가. 페이지마다 요소 배치가 일관적인가.
22. **읽는 순서**: 어디서부터 읽어야 하는지 자연스럽게 알 수 있는가. 시선의 흐름이 자연스러운가.
23. **강조 표현**: 중요한 내용을 굵은 글씨, 색상, 박스 등으로 눈에 띄게 했는가. 강조가 일관성 있게 사용되었는가.
24. **목차와 번호**: 목차, 페이지 번호, 섹션 번호가 있어 원하는 내용을 빨리 찾을 수 있는가.
25. **전체 통일감**: 문서 전체에서 글꼴, 색상, 간격이 일관적인가. 처음부터 끝까지 하나의 문서로 느껴지는가.

### 레이아웃 개선 제안 (3곳)
문서에서 가장 개선이 필요한 페이지/섹션 3곳을 골라서 현재 상태와 개선 방향을 설명하세요.
각 제안에는 현재 레이아웃과 개선 후 레이아웃을 좌표로 표현하세요.
좌표: x는 왼쪽에서의 위치(%), y는 위에서의 위치(%), w는 너비(%), h는 높이(%).
색상 팔레트: 제목=#5B8DEF, 본문=#64748b, 표/데이터=#22c55e, 이미지=#f59e0b, 요약/강조=#a855f7, 여백=#1e293b

## 응답 형식 (반드시 JSON만 출력, 다른 텍스트 없이)
{
  "score": 72,
  "categories": [
    { "subject": "논리력", "value": 75, "fullMark": 100, "feedback": "[강점] 잘 된 부분 설명.\\n[보완] 합격자들과 비교하여 부족한 점과 개선 방향. 3줄 이상 작성." },
    { "subject": "구체성", "value": 65, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 합격자 비교 부족한 점. 3줄 이상." },
    { "subject": "가독성", "value": 78, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "기술이해", "value": 70, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "창의성", "value": 68, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "핵심반복구조", "value": 60, "fullMark": 100, "feedback": "[강점] 이동→전투→보상의 기본 순환이 정의됨.\\n[보완] 합격자들은 각 단계별 소요 시간과 보상 비율까지 구체적으로 설계합니다. 이 문서는 흐름만 있고 수치가 없어 실무 적용이 어렵습니다." },
    { "subject": "콘텐츠분류", "value": 55, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 합격자 비교 부족한 점. 3줄 이상." },
    { "subject": "재화흐름", "value": 40, "fullMark": 100, "feedback": "[보완] 합격자들은 재화 획득/소비/소멸 경로를 도표로 정리합니다. 이 문서에는 재화 흐름 관련 내용이 없습니다." },
    { "subject": "플레이경험", "value": 65, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "수치데이터", "value": 30, "fullMark": 100, "feedback": "[보완] 합격자들은 캐릭터/아이템/몬스터 수치를 표로 정리합니다. 이 문서에는 수치 테이블이 없습니다." },
    { "subject": "기능연결", "value": 50, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "동기부여", "value": 45, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "난이도균형", "value": 35, "fullMark": 100, "feedback": "[보완] 부족한 점. 3줄 이상." },
    { "subject": "화면조작", "value": 55, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "개발일정", "value": 40, "fullMark": 100, "feedback": "[보완] 부족한 점. 3줄 이상." }
  ],
  "strengths": ["강점1", "강점2", "강점3", "강점4", "강점5", "강점6"],
  "weaknesses": ["보완점1", "보완점2", "보완점3", "보완점4", "보완점5", "보완점6"],
  "companyFeedback": "회사별 합격자 특징을 주어로 시작하여 비교. 예: '넥슨 합격자들은 수치 기반 시스템 설계가 탄탄하고, 크래프톤 합격자들은 전투 경험 목표가 구체적입니다. 이 문서는 ~가 부족하여 합격 수준에 도달하려면 ~를 보완해야 합니다.' 3~4문장으로. 절대 '~사례처럼', '~처럼' 표현 금지. 사용자는 합격자 포트폴리오를 볼 수 없으므로 '합격자들은 ~한 특징이 있다'는 식으로 서술.",
  "readabilityCategories": [
    { "subject": "글자크기구분", "value": 70, "fullMark": 100, "feedback": "제목과 본문의 크기 차이에 대한 구체적 피드백" },
    { "subject": "문단나누기", "value": 65, "fullMark": 100, "feedback": "문단 구성에 대한 피드백" },
    { "subject": "여백활용", "value": 55, "fullMark": 100, "feedback": "여백 상태에 대한 피드백" },
    { "subject": "색상활용", "value": 72, "fullMark": 100, "feedback": "색상 사용에 대한 피드백" },
    { "subject": "표와그림배치", "value": 60, "fullMark": 100, "feedback": "표/그림 배치에 대한 피드백" },
    { "subject": "페이지구성", "value": 68, "fullMark": 100, "feedback": "페이지 구성에 대한 피드백" },
    { "subject": "읽는순서", "value": 75, "fullMark": 100, "feedback": "읽는 순서에 대한 피드백" },
    { "subject": "강조표현", "value": 50, "fullMark": 100, "feedback": "강조 표현에 대한 피드백" },
    { "subject": "목차와번호", "value": 40, "fullMark": 100, "feedback": "목차/번호에 대한 피드백" },
    { "subject": "전체통일감", "value": 62, "fullMark": 100, "feedback": "전체 통일감에 대한 피드백" }
  ],
  "layoutRecommendations": [
    {
      "pageOrSection": "3페이지 - 시스템 설계",
      "currentDescription": "현재 상태를 2~3문장으로 설명",
      "recommendedDescription": "개선 후 모습을 2~3문장으로 설명",
      "currentLayout": { "sections": [{ "label": "제목", "x": 5, "y": 2, "w": 90, "h": 6, "color": "#5B8DEF" }, { "label": "본문", "x": 5, "y": 10, "w": 90, "h": 85, "color": "#64748b" }] },
      "recommendedLayout": { "sections": [{ "label": "제목", "x": 5, "y": 3, "w": 90, "h": 8, "color": "#5B8DEF" }, { "label": "본문", "x": 5, "y": 14, "w": 42, "h": 50, "color": "#64748b" }, { "label": "표", "x": 52, "y": 14, "w": 43, "h": 50, "color": "#22c55e" }] }
    }
  ]
}

**핵심**: 문서를 꼼꼼히 읽고, 실제로 있는 내용만 강점으로, 실제로 없거나 부족한 내용은 보완점으로 작성하세요. 빈말 칭찬은 사용자에게 해롭습니다. categories의 각 feedback은 반드시 [강점]/[보완]을 구분하여 3줄 이상 작성하세요. readabilityCategories와 layoutRecommendations도 반드시 포함하세요.`

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
      // Claude API 호출 (플랜에 따라 모델 선택)
      const anthropic = new Anthropic({ apiKey })
      const selectedModel = await getModelForUser()

      const message = await anthropic.messages.create({
        model: selectedModel,
        max_tokens: 8192,
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
                text: "위 문서를 분석해주세요. 시스템 프롬프트의 평가 기준과 합격 사례들을 참고하여 JSON 형식으로만 응답해주세요. 반드시 15개 categories, companyFeedback, readabilityCategories(10개), layoutRecommendations(3개)를 모두 포함해야 합니다.",
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

      // 회사별 비교 데이터 - 모든 회사 항상 표시 (데이터 없으면 전체 평균 사용)
      const companyComparison: { company: string; avgScore: number; userScore: number; sampleCount: number }[] = []
      const targetCompanies = ["넥슨", "넷마블", "웹젠", "크래프톤", "스마일게이트", "네오위즈", "펄어비스", "엔씨소프트"]
      targetCompanies.forEach(company => {
        const matchedEntry = Object.entries(companyStats).find(([key]) =>
          key.includes(company) || company.includes(key)
        )
        if (matchedEntry && matchedEntry[1].count > 0) {
          companyComparison.push({
            company,
            avgScore: Math.round(matchedEntry[1].total / matchedEntry[1].count),
            userScore: analysis.score,
            sampleCount: matchedEntry[1].count,
          })
        } else {
          companyComparison.push({
            company,
            avgScore: avgScores.overall,
            userScore: analysis.score,
            sampleCount: 0,
          })
        }
      })
      companyComparison.push({
        company: "전체 합격자",
        avgScore: avgScores.overall,
        userScore: analysis.score,
        sampleCount: portfolios?.length || 0,
      })

      const allCompanyComparison = companyComparison

      const analysisData = {
        score: analysis.score,
        categories: analysis.categories,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        companyFeedback: analysis.companyFeedback || "",
        analysisSource: "pdf" as const,
        readabilityCategories: analysis.readabilityCategories || [],
        layoutRecommendations: analysis.layoutRecommendations || [],
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
        companyFeedback: analysis.companyFeedback || "",
        analysisSource: "pdf",
        readabilityCategories: analysis.readabilityCategories || [],
        layoutRecommendations: analysis.layoutRecommendations || [],
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
