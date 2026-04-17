/**
 * 사용자 포트폴리오 분석 서버 액션
 *
 * 핵심 함수:
 * - checkBeforeAnalysis(): 분석 전 인증 + 구독 확인
 * - uploadFileToStorage(): Supabase Storage에 파일 업로드 (200MB 제한, 30MB 권장)
 * - deleteFileFromStorage(): Storage 파일 삭제
 * - getModelForUser(): 구독 플랜별 Claude 모델 선택 (Sonnet/Opus)
 * - analyzeUrlDirect(): URL 크롤링 또는 추출된 텍스트 → Claude 분석
 * - analyzeDocumentDirect(): 업로드된 파일 → Claude 분석
 *
 * 분석 파이프라인:
 * 1. portfolios 테이블에서 학습 데이터 로드 (상위 50개)
 * 2. 통계 계산 (전체 평균, 회사별 평균, 태그 빈도)
 * 3. 샘플 12개 선택 (회사별 균형 샘플링)
 * 4. [벡터 서치] 사용자 문서와 유사한 포트폴리오 실제 내용 검색
 * 5. [벤치마크] data/company-benchmarks.json에서 9개사×20항목 벤치마크 로드
 * 6. 시스템 프롬프트 구성 (통계 + 샘플 + 유사 내용 + 벤치마크 + 평가 기준)
 * 7. Claude API 호출 (15개 카테고리 + 가독성 + 레이아웃 + 회사별 비교)
 * 8. JSON 파싱 + 랭킹 계산 (187명 기준)
 *
 * 벡터 서치: OpenAI 임베딩 + Supabase pgvector로 유사 포트폴리오 검색
 * URL 분석: 직접 fetch → HTML 텍스트 추출 → SPA는 Jina AI Reader 폴백
 * SSRF 방어: isInternalUrl()로 내부 네트워크 URL 차단
 *
 * TODO: analyzeUrlDirect와 analyzeDocumentDirect의 중복 로직 추출 필요
 *
 * 환경변수: ANTHROPIC_API_KEY, JINA_API_KEY, OPENAI_API_KEY
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"
import { v4 as uuidv4 } from "uuid"
import { checkAnalysisAllowance, saveAnalysisHistory, deductCredit } from "./subscription"
import { searchSimilarContent, formatChunksForPrompt } from "@/lib/vector-search"
// document-categories 삭제됨 — 키워드 기반 매칭으로 전환
import fs from "fs"
import path from "path"

/**
 * 잘린 JSON 복구 유틸리티
 * Claude API 응답이 max_tokens 제한으로 잘리거나,
 * 배열/객체가 닫히지 않은 경우를 복구합니다.
 */
function repairJSON(jsonStr: string): string {
  // 1단계: trailing comma 제거 (배열/객체 끝의 불필요한 쉼표)
  let repaired = jsonStr.replace(/,\s*([\]}])/g, "$1")

  // 2단계: 닫히지 않은 문자열 처리 — 마지막 불완전한 속성/값 제거
  // 잘린 문자열이 있으면 마지막 불완전한 키-값 쌍을 제거
  const lastBrace = Math.max(repaired.lastIndexOf("}"), repaired.lastIndexOf("]"))
  if (lastBrace > 0) {
    // 마지막 유효한 닫는 괄호 이후를 잘라냄
    const afterLast = repaired.substring(lastBrace + 1).trim()
    if (afterLast.length > 0 && !afterLast.match(/^[\s\]},]*$/)) {
      repaired = repaired.substring(0, lastBrace + 1)
    }
  }

  // 3단계: 열린 괄호/중괄호 개수 맞추기
  let openBraces = 0, openBrackets = 0
  let inString = false, escaped = false
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i]
    if (escaped) { escaped = false; continue }
    if (ch === "\\") { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === "{") openBraces++
    else if (ch === "}") openBraces--
    else if (ch === "[") openBrackets++
    else if (ch === "]") openBrackets--
  }

  // 닫히지 않은 문자열이 있으면 닫기
  if (inString) repaired += '"'

  // 마지막에 trailing comma 다시 제거 (문자열 닫기 후 생길 수 있음)
  repaired = repaired.replace(/,\s*$/gm, "")

  // 부족한 닫는 괄호 추가
  while (openBrackets > 0) { repaired += "]"; openBrackets-- }
  while (openBraces > 0) { repaired += "}"; openBraces-- }

  return repaired
}

/**
 * 안전한 JSON 파싱 — 실패 시 복구 시도
 */
function safeParseJSON(jsonStr: string): Record<string, unknown> {
  // 1차: 그대로 파싱
  try {
    return JSON.parse(jsonStr)
  } catch {
    // 2차: 복구 후 파싱
    console.log("[분석] JSON 파싱 실패, 복구 시도 중...")
    try {
      const repaired = repairJSON(jsonStr)
      const result = JSON.parse(repaired)
      console.log("[분석] JSON 복구 성공")
      return result
    } catch (repairError) {
      console.error("[분석] JSON 복구도 실패:", repairError)
      throw new Error("AI 응답을 파싱할 수 없습니다. 다시 시도해 주세요.")
    }
  }
}

/**
 * 회사별 벤치마크 데이터 로드 및 프롬프트 포맷팅
 *
 * data/company-benchmarks.json에서 9개사 × 20항목 데이터를 읽어
 * Claude 시스템 프롬프트에 주입할 텍스트로 변환합니다.
 *
 * - 8개 회사 데이터: 사용자에게 각각 비교 피드백 제공
 * - 일반회사 데이터: "업계 공통" 라벨로 주입, 사용자 미노출 (판단 다각화용)
 */
interface CompanyBenchmark {
  design: Record<string, string>
  readability: Record<string, string>
}

let cachedBenchmarks: Record<string, CompanyBenchmark> | null = null

function loadCompanyBenchmarks(): Record<string, CompanyBenchmark> {
  if (cachedBenchmarks) return cachedBenchmarks
  try {
    const filePath = path.join(process.cwd(), "data", "company-benchmarks.json")
    const raw = fs.readFileSync(filePath, "utf-8")
    cachedBenchmarks = JSON.parse(raw)
    console.log("[벤치마크] 데이터 로드 성공:", Object.keys(cachedBenchmarks!).length, "개사")
    return cachedBenchmarks!
  } catch (err) {
    console.error("[벤치마크] 데이터 로드 실패:", err)
    return {}
  }
}

/**
 * 벤치마크 데이터를 시스템 프롬프트용 텍스트로 변환
 * @param includeReadability readability 벤치마크 포함 여부 (PDF 분석에만 true)
 *
 * 토큰 절약: 각 항목을 BENCHMARK_MAX_CHARS(150자)로 잘라서 주입
 * 전체 벤치마크가 ~72,000자(원본) → ~27,000자(절삭)로 축소
 */
const BENCHMARK_MAX_CHARS = 150 // 항목당 최대 글자수 (조절 가능)

function truncateBenchmark(text: string): string {
  if (text.length <= BENCHMARK_MAX_CHARS) return text
  // 마지막 완전한 문장("." 또는 "다")에서 자름
  const cut = text.substring(0, BENCHMARK_MAX_CHARS)
  const lastPeriod = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("다"))
  if (lastPeriod > BENCHMARK_MAX_CHARS * 0.5) {
    return cut.substring(0, lastPeriod + 1)
  }
  return cut + "…"
}

function formatBenchmarkForPrompt(includeReadability: boolean = true): string {
  const benchmarks = loadCompanyBenchmarks()
  if (Object.keys(benchmarks).length === 0) return ""

  const targetCompanies = ["넥슨", "네오위즈", "넷마블", "엔씨소프트", "크래프톤", "펄어비스", "스마일게이트", "웹젠"]
  const generalData = benchmarks["일반회사"]

  const designItems = ["핵심반복구조", "콘텐츠분류", "재화흐름", "플레이경험", "수치데이터", "기능연결", "동기부여", "난이도균형", "화면조작", "개발일정"]
  const readabilityItems = ["글자크기구분", "문단나누기", "여백활용", "색상활용", "표와그림배치", "페이지구성", "읽는순서", "강조표현", "목차와번호", "전체통일감"]

  let result = `\n---\n\n## 🏢 회사별 합격 포트폴리오 벤치마크 (187개 합격 사례 기반)\n\n`
  result += `### 게임 디자인 역량 — 회사별 합격자 특징\n`
  result += `각 평가 항목의 feedback 작성 시, 아래 벤치마크를 참고하여 "합격자들은 ~하는데, 이 문서는 ~하다"는 비교를 제공하세요.\n`
  result += `"업계 공통"은 특정 회사에 국한되지 않는 전반적인 합격 기준이므로, 8개 회사별 판단과 함께 종합적으로 참고하세요.\n\n`

  for (const item of designItems) {
    result += `[${item}]\n`
    for (const company of targetCompanies) {
      const text = benchmarks[company]?.design?.[item]
      if (text) result += `- ${company}: ${truncateBenchmark(text)}\n`
    }
    if (generalData?.design?.[item]) {
      result += `- 업계 공통: ${truncateBenchmark(generalData.design[item])}\n`
    }
    result += `\n`
  }

  if (includeReadability) {
    result += `### 문서 가독성 — 회사별 합격자 특징\n\n`
    for (const item of readabilityItems) {
      result += `[${item}]\n`
      for (const company of targetCompanies) {
        const text = benchmarks[company]?.readability?.[item]
        if (text) result += `- ${company}: ${truncateBenchmark(text)}\n`
      }
      if (generalData?.readability?.[item]) {
        result += `- 업계 공통: ${truncateBenchmark(generalData.readability[item])}\n`
      }
      result += `\n`
    }
  }

  result += `### companyFeedback 작성 시 벤치마크 활용\n`
  result += `- 8개 회사(넥슨~웹젠)에 대해 각각 위 벤치마크를 근거로 비교 피드백 작성\n`
  result += `- 각 회사 피드백에서 해당 회사 벤치마크 + 업계 공통 벤치마크를 종합 참고\n`
  result += `- "일반회사" 또는 "업계 공통"이라는 명칭은 사용자에게 노출하지 않음\n`

  return result
}

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
    const allowedTypes = [
      "application/pdf",
      "image/jpeg", "image/png", "image/webp",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
      "application/vnd.ms-excel", // xls
      "application/vnd.ms-powerpoint", // ppt
      "text/plain", // txt
    ]
    if (!allowedTypes.includes(file.type)) {
      return { error: "지원하지 않는 파일 형식입니다. (PDF, DOCX, PPTX, XLSX, TXT, 이미지)" }
    }

    // 파일 크기 체크 (200MB, 30MB 권장)
    if (file.size > 200 * 1024 * 1024) {
      return { error: `파일 크기(${(file.size / (1024 * 1024)).toFixed(1)}MB)가 200MB를 초과합니다. 30MB 이하를 권장합니다. 이미지 압축, 불필요한 페이지 제거 등으로 파일을 최적화해 주세요.` }
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

    // 보안: uploads/ 경로만 허용 (다른 경로 삭제 차단)
    if (!filePath.startsWith("uploads/")) {
      return { error: "잘못된 파일 경로입니다." }
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

    // http/https만 허용
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return true
    }

    // 내부 IP / localhost / 클라우드 메타데이터 차단
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") || // 클라우드 메타데이터 (AWS/GCP/Azure)
      hostname.startsWith("fd") ||       // IPv6 private (fd00::/8)
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "[::1]" ||
      hostname === "metadata.google.internal" ||
      hostname.includes("[::ffff:") // IPv4-mapped IPv6
    ) {
      return true
    }
    return false
  } catch {
    return true // 파싱 실패 시 차단
  }
}

// URL 웹페이지 크롤링 또는 추출된 텍스트 → Claude 분석
export async function analyzeUrlDirect(input: {
  projectId: string
  url?: string
  extractedText?: string // 대용량 PDF에서 클라이언트가 추출한 텍스트
  fileName?: string // extractedText 사용 시 파일명
}) {
  // 보안: 로그인 확인 (미인증 사용자의 API 호출 차단)
  const supabaseAuth = await createClient()
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
  if (!authUser) {
    return { error: "로그인이 필요합니다." }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." }
  }

  // URL 모드일 때만 검증
  if (input.url && !input.extractedText) {
    if (isInternalUrl(input.url)) {
      return { error: "허용되지 않는 URL입니다." }
    }
  }

  try {
    const supabase = await createClient()

    // 웹페이지 텍스트 추출 함수
    const extractTextFromHtml = (html: string) => {
      return html
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
    }

    let pageContent = ""

    // 대용량 PDF에서 추출된 텍스트가 있으면 크롤링 스킵
    if (input.extractedText) {
      pageContent = input.extractedText
      if (pageContent.length > 100000) {
        pageContent = pageContent.substring(0, 100000)
      }
      if (pageContent.length < 100) {
        return { error: "PDF에서 충분한 텍스트를 추출할 수 없습니다. 스캔된 이미지로만 구성된 문서일 수 있습니다. 30MB 이하로 압축하여 원본 PDF 분석을 이용해 주세요." }
      }
    } else {

    try {
      // 1차 시도: 직접 fetch
      const response = await fetch(input.url!, {
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
      pageContent = extractTextFromHtml(html)

      // 2차 시도: 텍스트가 부족하면 Jina AI Reader로 재시도 (SPA/자바스크립트 페이지 대응)
      if (pageContent.length < 200) {
        try {
          const jinaResponse = await fetch(`https://r.jina.ai/${input.url}`, {
            headers: {
              "Accept": "text/plain",
              "X-No-Cache": "true",
            },
            signal: AbortSignal.timeout(30000),
          })
          if (jinaResponse.ok) {
            const jinaText = await jinaResponse.text()
            if (jinaText.length > pageContent.length) {
              pageContent = jinaText
            }
          }
        } catch {
          // Jina 실패해도 기존 텍스트로 진행
        }
      }

      // 그래도 부족하면 오류
      if (pageContent.length < 100) {
        return { error: "페이지에서 충분한 텍스트를 추출할 수 없습니다. 자바스크립트로만 동작하는 페이지이거나, 공개 접근이 불가능한 URL일 수 있습니다. 파일 업로드를 이용해 주세요." }
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

    } // extractedText else 블록 끝

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

    // portfolio_analysis에서 15개 카테고리 심층 분석 통계 조회
    const { data: analysisData } = await supabase
      .from("portfolio_analysis")
      .select("portfolio_id, file_name, companies, overall_score, logic_score, specificity_score, readability_score, technical_score, creativity_score, core_loop_score, content_taxonomy_score, economy_score, player_experience_score, data_design_score, feature_connection_score, motivation_score, difficulty_score, ui_ux_score, dev_plan_score, strengths, weaknesses, key_features, summary")

    const hasDeepAnalysis = analysisData && analysisData.length > 0

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

      // 15개 카테고리 심층 통계 (portfolio_analysis 있을 때)
      let deepStatsSection = ""
      if (hasDeepAnalysis) {
        const avg15 = (field: string) => {
          const vals = analysisData.map((a: Record<string, unknown>) => (a[field] as number) || 0)
          return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        }
        deepStatsSection = `
### 15개 카테고리 심층 통계 (${analysisData.length}개 포트폴리오 심층 분석 기준)
- 기본 역량: 논리력 ${avg15("logic_score")} | 구체성 ${avg15("specificity_score")} | 가독성 ${avg15("readability_score")} | 기술이해 ${avg15("technical_score")} | 창의성 ${avg15("creativity_score")}
- 게임디자인: 핵심반복 ${avg15("core_loop_score")} | 콘텐츠분류 ${avg15("content_taxonomy_score")} | 재화설계 ${avg15("economy_score")} | 플레이경험 ${avg15("player_experience_score")} | 수치데이터 ${avg15("data_design_score")}
- 기획역량: 기능연결 ${avg15("feature_connection_score")} | 동기부여 ${avg15("motivation_score")} | 난이도 ${avg15("difficulty_score")} | UI/UX ${avg15("ui_ux_score")} | 개발계획 ${avg15("dev_plan_score")}

### 고득점 포트폴리오(80점+)의 공통 특징
${(() => {
  const topAnalyses = analysisData.filter(a => (a.overall_score || 0) >= 80)
  if (topAnalyses.length === 0) return "- 해당 없음"
  const allKeyFeatures = topAnalyses.flatMap(a => a.key_features || [])
  const featureCounts: Record<string, number> = {}
  allKeyFeatures.forEach(f => { featureCounts[f] = (featureCounts[f] || 0) + 1 })
  return Object.entries(featureCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([feature, count]) => `- ${feature} (${count}개 포트폴리오)`)
    .join("\n")
})()}
`
      }

      // 회사별 균형 잡힌 샘플링: 주요 회사별 최대 2개씩 + 나머지
      const priorityCompanies = ["넥슨", "엔씨소프트", "넷마블", "크래프톤", "스마일게이트", "펄어비스", "네오위즈", "웹젠"]
      const selectedExamples: typeof portfolios = []
      const usedIds = new Set<string>()

      // 1단계: 주요 회사별 상위 2개씩 선택
      for (const company of priorityCompanies) {
        const companyPortfolios = portfolios.filter(p =>
          (p.companies as string[] || []).some((c: string) => c === company) && !usedIds.has(p.file_name)
        )
        for (const p of companyPortfolios.slice(0, 2)) {
          selectedExamples.push(p)
          usedIds.add(p.file_name)
        }
      }

      // 2단계: 나머지 슬롯을 점수 상위로 채움 (최대 20개)
      for (const p of portfolios) {
        if (selectedExamples.length >= 20) break
        if (!usedIds.has(p.file_name)) {
          selectedExamples.push(p)
          usedIds.add(p.file_name)
        }
      }

      const topExamples = selectedExamples.map((p, idx) => {
        const strengthsList = (p.strengths || []).slice(0, 3).map(s => `  · ${s}`).join("\n")
        const weaknessesList = (p.weaknesses || []).slice(0, 2).map(w => `  · ${w}`).join("\n")
        // portfolio_analysis에서 추가 정보 가져오기
        const deepInfo = hasDeepAnalysis
          ? analysisData.find(a => a.file_name === p.file_name)
          : null
        const deepScores = deepInfo
          ? `\n- 게임디자인: 핵심반복 ${deepInfo.core_loop_score} | 콘텐츠분류 ${deepInfo.content_taxonomy_score} | 재화설계 ${deepInfo.economy_score} | 플레이경험 ${deepInfo.player_experience_score} | 수치데이터 ${deepInfo.data_design_score} | 기능연결 ${deepInfo.feature_connection_score} | 동기부여 ${deepInfo.motivation_score} | 난이도 ${deepInfo.difficulty_score} | UI/UX ${deepInfo.ui_ux_score} | 개발계획 ${deepInfo.dev_plan_score}`
          : ""
        return `
### 합격 사례 ${idx + 1}: ${p.file_name} (${p.overall_score}점)
- 지원사: ${(p.companies || []).join(", ")}
- 문서유형: ${p.document_type || "포트폴리오"}
- 기본점수: 논리 ${p.logic_score} | 구체성 ${p.specificity_score} | 가독성 ${p.readability_score} | 기술이해 ${p.technical_score} | 창의성 ${p.creativity_score}${deepScores}
- 핵심 강점:
${strengthsList}
${weaknessesList ? `- 개선 필요:
${weaknessesList}` : ""}
- 요약: ${p.summary || "N/A"}
`
      }).join("\n")

      // 회사별 강점/약점 패턴 요약 (companyFeedback 정확도 향상용)
      const companyPatterns = Object.entries(companyStats)
        .filter(([, stat]) => stat.count >= 2)
        .slice(0, 8)
        .map(([company]) => {
          const companyPortfolios = portfolios.filter(p =>
            (p.companies as string[] || []).some((c: string) => c === company)
          )
          const allStrengths = companyPortfolios.flatMap(p => p.strengths || [])
          const allWeaknesses = companyPortfolios.flatMap(p => p.weaknesses || [])
          const strengthCounts: Record<string, number> = {}
          allStrengths.forEach(s => { strengthCounts[s] = (strengthCounts[s] || 0) + 1 })
          const weaknessCounts: Record<string, number> = {}
          allWeaknesses.forEach(w => { weaknessCounts[w] = (weaknessCounts[w] || 0) + 1 })
          const topStrengths = Object.entries(strengthCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s)
          const topWeaknesses = Object.entries(weaknessCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w)
          const companyTags = companyPortfolios.flatMap(p => p.tags || [])
          const tagCounts2: Record<string, number> = {}
          companyTags.forEach(t => { tagCounts2[t] = (tagCounts2[t] || 0) + 1 })
          const topCompanyTags = Object.entries(tagCounts2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t)
          return `- **${company}** (${companyPortfolios.length}개 샘플, 평균 ${Math.round(companyPortfolios.reduce((a, b) => a + (b.overall_score || 0), 0) / companyPortfolios.length)}점)
  · 공통 강점: ${topStrengths.join(", ") || "데이터 부족"}
  · 공통 약점: ${topWeaknesses.join(", ") || "데이터 부족"}
  · 주요 키워드: ${topCompanyTags.join(", ") || "데이터 부족"}`
        }).join("\n")

      referenceStats = `
## 📊 학습 데이터 기반 비교 분석 (실제 합격 포트폴리오 ${portfolios.length}개)

### 전체 통계
- 전체 평균: ${avgScores.overall}점
- 논리력 평균: ${avgScores.logic}점 | 구체성 평균: ${avgScores.specificity}점
- 가독성 평균: ${avgScores.readability}점 | 기술이해 평균: ${avgScores.technical}점
- 창의성 평균: ${avgScores.creativity}점
- 주요 키워드: ${topTags.join(", ")}
${deepStatsSection}
### 회사별 평균 점수
${Object.entries(companyStats).slice(0, 8).map(([company, stat]) =>
  `- ${company}: ${Math.round(stat.total / stat.count)}점 (${stat.count}개 샘플)`
).join("\n")}

### 회사별 합격자 포트폴리오 공통 패턴
${companyPatterns}

---

## 🎯 실제 합격 포트폴리오 패턴 분석 (회사별 균형 샘플링)
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

    // [벡터 서치] 사용자 문서와 유사한 합격 포트폴리오 내용 검색
    // pageContent가 있을 때만 실행 (URL/텍스트 추출 완료 후)
    let vectorSearchSection = ""
    if (pageContent && pageContent.length >= 100) {
      try {
        const searchResult = await searchSimilarContent(pageContent, 15, 0.4)
        if (searchResult.chunks.length > 0) {
          vectorSearchSection = formatChunksForPrompt(searchResult.chunks)
          console.log(`[벡터 서치] ${searchResult.chunks.length}개 유사 청크 발견`)
        } else {
          console.log("[벡터 서치] 유사 청크 없음 (임베딩 미생성 또는 유사도 부족)")
        }
      } catch (err) {
        // 벡터 서치 실패해도 기존 분석은 정상 진행
        console.error("[벡터 서치] 검색 실패 (무시):", err)
      }
    }

    // [벤치마크] 회사별 합격 포트폴리오 벤치마크 데이터 주입 (URL 분석: design만)
    const benchmarkSection = formatBenchmarkForPrompt(false)

    const systemPrompt = `당신은 게임 업계 11년차 현업 기획자이자 채용 담당자입니다.
${portfolios?.length || 0}개의 **실제 합격 포트폴리오**를 학습했으며, 그 패턴을 기반으로 현재 문서를 **철저히 비교 평가**해야 합니다.

${referenceStats}

${vectorSearchSection}

${benchmarkSection}

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
9. **문서의 주제에 맞게 평가하세요.** 평가 기준의 예시(몬스터, 재화, 캐릭터 등)는 일반적인 예시일 뿐입니다. 캐릭터 기획서에 "몬스터 데이터가 없다"거나, 시스템 기획서에 "캐릭터 설정이 부족하다"처럼 문서 주제와 무관한 내용을 피드백에 넣지 마세요. 해당 항목이 문서 주제와 관련 없으면 "이 문서의 주제(캐릭터/시스템/레벨 등)에서는 해당 항목이 직접적으로 다뤄지지 않았습니다" 정도로 짧게 언급하세요.

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
7. **콘텐츠 분류 체계**: 게임의 주요 요소들이 겹치지 않고 빠짐없이 나뉘어 정리되었는가. 큰 분류에서 작은 분류로 체계적으로 나누는 구조가 있는가.
8. **재화 흐름 설계**: 게임 안에서 돈이나 자원이 어디서 생기고, 어디에 쓰이고, 어디서 사라지는지가 설계되었는가. 자원이 한없이 쌓이기만 하는 문제를 막는 구조가 있는가.
9. **플레이 경험 목표**: 이 게임을 하면서 플레이어가 느꼈으면 하는 감정이나 경험(예: 도전감, 탐험의 재미, 이야기 몰입, 친구와 함께하는 즐거움 등)이 명확하고, 그 경험을 만들기 위해 어떤 게임 규칙을 넣었는지 연결이 되는가.
10. **수치 데이터 정리**: 게임에 들어가는 숫자 데이터가 표 형태로 정리되어 있는가. 이 문서의 주제에 해당하는 수치(예: 캐릭터 문서면 캐릭터 스탯, 시스템 문서면 시스템 수치 등)가 있는가. 예시 데이터가 포함되어 있고, 각 표끼리 어떻게 연결되는지 설명이 있는가.
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

**게임 디자인 역량 feedback 작성 규칙**: 각 항목의 feedback은 반드시 3줄 이상 작성하세요. 위의 '회사별 합격 포트폴리오 벤치마크' 데이터를 참고하여 합격자들의 구체적 특징과 비교하세요. [강점]과 [보완]을 구분해서 작성하세요.
- [강점]으로 시작하는 줄: 이 문서에서 해당 항목이 잘 된 부분
- [보완]으로 시작하는 줄: 합격자들과 비교했을 때 부족한 부분과 구체적 개선 방향. 벤치마크의 합격자 특징을 인용하여 "합격자들은 ~하지만, 이 문서는 ~합니다"로 서술
- 해당 항목이 전혀 없으면 [보완]만 작성하되, 벤치마크를 참고하여 합격자들은 어떻게 하는지 설명

## 응답 형식 (반드시 JSON만 출력, 다른 텍스트 없이)
{
  "score": 72,
  "categories": [
    { "subject": "논리력", "value": 75, "fullMark": 100, "feedback": "[강점] 잘 된 부분 설명.\\n[보완] 벤치마크 기준 합격자들과 비교하여 부족한 점과 개선 방향. 3줄 이상 작성." },
    { "subject": "구체성", "value": 65, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 벤치마크 기준 부족한 점. 3줄 이상." },
    { "subject": "가독성", "value": 78, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "기술이해", "value": 70, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "창의성", "value": 68, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "핵심반복구조", "value": 60, "fullMark": 100, "feedback": "[강점] 이동→전투→보상의 기본 순환이 정의됨.\\n[보완] 벤치마크에 따르면 넥슨 합격자들은 각 단계별 소요 시간과 보상 비율까지 구체적으로 설계합니다. 이 문서는 흐름만 있고 수치가 없어 실무 적용이 어렵습니다." },
    { "subject": "콘텐츠분류", "value": 55, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 벤치마크 기준 부족한 점. 3줄 이상." },
    { "subject": "재화흐름", "value": 40, "fullMark": 100, "feedback": "[보완] 벤치마크에 따르면 합격자들은 재화 획득/소비/소멸 경로를 도표로 정리합니다. 이 문서에는 재화 흐름 관련 내용이 없습니다." },
    { "subject": "플레이경험", "value": 65, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "수치데이터", "value": 30, "fullMark": 100, "feedback": "[보완] 벤치마크에 따르면 합격자들은 주요 게임 요소의 수치를 표로 정리합니다. 이 문서에는 수치 테이블이 없습니다." },
    { "subject": "기능연결", "value": 50, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "동기부여", "value": 45, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "난이도균형", "value": 35, "fullMark": 100, "feedback": "[보완] 부족한 점. 3줄 이상." },
    { "subject": "화면조작", "value": 55, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "개발일정", "value": 40, "fullMark": 100, "feedback": "[보완] 부족한 점. 3줄 이상." }
  ],
  "strengths": ["강점1", "강점2", "강점3", "강점4", "강점5", "강점6"],
  "weaknesses": ["보완점1", "보완점2", "보완점3", "보완점4", "보완점5", "보완점6"],
  "companyFeedback": "위의 '회사별 합격 포트폴리오 벤치마크' 데이터를 반드시 참고하여 작성. **넥슨**, **엔씨소프트**, **넷마블**, **크래프톤**, **스마일게이트**, **펄어비스**, **네오위즈**, **웹젠** 8개 회사 전부 작성. 각 회사별로 2~3문장씩. 형식: **회사명** 합격자들은 ~한 특징이 있습니다. 이 문서는 ~합니다. 회사마다 줄바꿈(\\n\\n)으로 구분. 절대 '~사례처럼' 표현 금지. [필수] 각 회사 벤치마크 데이터에서 해당 회사 합격자들의 핵심 특징(design/readability)을 인용하여 비교하세요. 각 회사 피드백의 '이 문서는 ~' 부분에서 반드시 이 문서에서 실제로 발견한 구체적인 내용을 인용하세요. 문서에 없는 기능이나 내용을 있다고 하면 안 됩니다."
}`

    const anthropic = new Anthropic({ apiKey, maxRetries: 3 })
    const selectedModel = await getModelForUser()

    const message = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 8192,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: input.extractedText
            ? `아래는 "${input.fileName}" 문서에서 추출한 텍스트 내용입니다. 이 내용을 게임 기획 포트폴리오로서 분석해주세요. 시스템 프롬프트의 평가 기준과 합격 사례들을 참고하여 JSON 형식으로만 응답해주세요. 반드시 15개 categories와 companyFeedback을 모두 포함해야 합니다.\n\n---\n\n${pageContent}`
            : `아래는 웹 페이지(${input.url})에서 추출한 텍스트 내용입니다. 이 내용을 게임 기획 포트폴리오로서 분석해주세요. 시스템 프롬프트의 평가 기준과 합격 사례들을 참고하여 JSON 형식으로만 응답해주세요. 반드시 15개 categories와 companyFeedback을 모두 포함해야 합니다.\n\n---\n\n${pageContent}`,
        },
      ],
      system: systemPrompt,
    })

    // stop_reason 체크
    if (message.stop_reason === "max_tokens") {
      console.error("[분석-URL] ⚠️ Claude 응답이 max_tokens에 의해 잘렸습니다. 출력이 불완전할 수 있습니다.")
    }

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

    const analysis = safeParseJSON(jsonStr)

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
    const targetCompanies = ["넥슨", "엔씨소프트", "넷마블", "크래프톤", "웹젠", "스마일게이트", "네오위즈", "펄어비스"]
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

    const analysisResult = {
      score: analysis.score,
      categories: analysis.categories,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      companyFeedback: analysis.companyFeedback || "",
      analysisSource: (input.extractedText ? "pdf" : "url") as "pdf" | "url",
      ranking: {
        total: DISPLAY_TOTAL,
        percentile,
        rank,
        companyComparison,
      }
    }

    // 분석 이력 저장 + 크레딧 차감
    saveAnalysisHistory({
      projectId: input.projectId,
      fileName: input.extractedText ? (input.fileName || "대용량 PDF") : input.url!,
      score: analysis.score,
      categories: analysis.categories,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      ranking: analysisResult.ranking,
      companyFeedback: analysis.companyFeedback || "",
      analysisSource: input.extractedText ? "pdf" : "url",
    }).catch(() => {})

    deductCredit().catch(() => {})

    return { data: analysisResult }
  } catch (error) {
    console.error("URL Analysis error:", error)
    const errMsg = error instanceof Error ? error.message : String(error)
    if (errMsg.includes("credit balance") || errMsg.includes("insufficient_quota") || errMsg.includes("billing")) {
      return { error: "CREDIT_LIMIT_EXCEEDED" }
    }
    if (errMsg.includes("timeout") || errMsg.includes("FUNCTION_INVOCATION_TIMEOUT")) {
      return { error: "분석 시간이 초과되었습니다. 파일 크기가 큰 경우 시간이 오래 걸릴 수 있습니다. 다시 시도해 주세요." }
    }
    if (errMsg.includes("Internal server error") || errMsg.includes("api_error") || errMsg.includes("overloaded") || errMsg.includes("529")) {
      return { error: "AI 서버가 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요." }
    }
    return { error: "URL 분석 중 오류가 발생했습니다. 다시 시도해 주세요." }
  }
}

// 1단계: 문서에서 키워드 추출 (경량 Claude 호출)
export async function extractKeywords(input: {
  extractedText: string
  fileName: string
}): Promise<{ keywords: string[]; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { keywords: [], error: "API 키가 설정되지 않았습니다." }
  }

  try {
    const anthropic = new Anthropic({ apiKey })

    // 텍스트 앞 3000자만 사용 (비용 절감)
    const truncatedText = input.extractedText.slice(0, 3000)

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      temperature: 0,
      system: `당신은 게임 기획 문서 분석 전문가입니다.
주어진 문서에서 핵심 키워드 5~10개를 추출하세요.

키워드 추출 규칙:
1. 문서의 주제/유형을 나타내는 키워드 (예: 시스템기획, 레벨디자인, 역기획, UI/UX 등)
2. 문서에서 다루는 구체적 게임 요소 (예: 전투, 강화, 재화, 캐릭터, 퀘스트, 밸런싱 등)
3. 관련 게임 타이틀명이 있으면 포함 (예: 메이플스토리, 로스트아크 등)
4. 이 키워드들은 합격 포트폴리오 DB의 태그와 매칭하는 용도입니다.

반드시 JSON 배열만 출력하세요. 다른 텍스트 없이.
예시: ["시스템기획", "강화", "재화", "UI/UX", "확률"]`,
      messages: [{
        role: "user",
        content: `파일명: ${input.fileName}\n\n문서 내용:\n${truncatedText}`
      }]
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    // JSON 배열 파싱
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const keywords = JSON.parse(jsonMatch[0]) as string[]
      return { keywords: keywords.filter(k => typeof k === "string" && k.length > 0) }
    }

    return { keywords: [], error: "키워드 추출 실패" }
  } catch (err) {
    console.error("키워드 추출 오류:", err)
    return { keywords: [], error: "키워드 추출 중 오류가 발생했습니다." }
  }
}

// Fisher-Yates 셔플 유틸리티
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// 2단계: Claude API로 문서 분석 (합격작 비교)
export async function analyzeDocumentDirect(input: {
  projectId: string
  fileName: string
  fileUrl: string
  mimeType: string
  filePath: string
  extractedText?: string // 벡터 서치용 텍스트 (클라이언트에서 추출)
  keywords?: string[] // 1단계에서 추출+사용자 확정된 키워드
}) {
  // 보안: 로그인 확인 (미인증 사용자의 API 호출 차단)
  const supabaseAuth = await createClient()
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
  if (!authUser) {
    return { error: "로그인이 필요합니다." }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." }
  }

  try {
    const supabase = await createClient()

    // 학습된 포트폴리오 데이터 가져오기 (키워드 기반 태그 매칭 + 셔플)
    const selectFields = "file_name, tags, overall_score, logic_score, specificity_score, readability_score, technical_score, creativity_score, companies, strengths, weaknesses, summary, document_type"

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let portfolios: any[] | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let portfolioError: any = null

    if (input.keywords && input.keywords.length > 0) {
      // 전체 포트폴리오 로드 (187개 → 작은 데이터셋)
      const allResult = await supabase
        .from("portfolios")
        .select(selectFields)

      if (allResult.data) {
        // 키워드 매칭: 사용자 키워드가 포트폴리오 tags에 포함된 것 필터
        const matched = allResult.data.filter((p: any) => {
          const tags = (p.tags as string[]) || []
          return tags.some((tag: string) =>
            input.keywords!.some((kw: string) =>
              tag.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(tag.toLowerCase())
            )
          )
        })

        // 셔플 (Fisher-Yates) → 매번 다른 합격작 참조
        const shuffled = shuffleArray(matched)

        // 셔플된 결과에서 최대 30개 사용
        portfolios = shuffled.slice(0, 30)
        console.log(`[키워드 매칭] ${input.keywords.join(",")} → ${matched.length}개 매칭, 셔플 후 ${portfolios.length}개 사용`)

        // 매칭 부족 시 전체에서 셔플하여 폴백
        if (portfolios.length < 5) {
          console.log(`[키워드 매칭] 매칭 부족(${portfolios.length}개) → 전체 셔플 폴백`)
          portfolios = shuffleArray(allResult.data).slice(0, 50)
        }
      }
      portfolioError = allResult.error
    } else {
      // 키워드 없으면 기존 로직 (전체 상위 50개)
      const allResult = await supabase
        .from("portfolios")
        .select(selectFields)
        .order("overall_score", { ascending: false })
        .limit(50)
      portfolios = allResult.data
      portfolioError = allResult.error
    }

    if (portfolioError) {
      console.error("Portfolio fetch error:", portfolioError.message, portfolioError.code, portfolioError.details)
    }
    console.log("Portfolio query result (document):", {
      hasData: !!portfolios,
      count: portfolios?.length ?? 0,
      error: portfolioError?.message ?? null,
      keywords: input.keywords?.join(",") ?? "없음",
      firstItem: portfolios?.[0] ? { file_name: portfolios[0].file_name, companies: portfolios[0].companies } : null,
    })

    // portfolio_analysis에서 15개 카테고리 심층 분석 통계 조회
    const { data: analysisData2 } = await supabase
      .from("portfolio_analysis")
      .select("portfolio_id, file_name, companies, overall_score, logic_score, specificity_score, readability_score, technical_score, creativity_score, core_loop_score, content_taxonomy_score, economy_score, player_experience_score, data_design_score, feature_connection_score, motivation_score, difficulty_score, ui_ux_score, dev_plan_score, strengths, weaknesses, key_features, summary")

    const hasDeepAnalysis2 = analysisData2 && analysisData2.length > 0

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

      // 15개 카테고리 심층 통계 (portfolio_analysis 있을 때)
      let deepStatsSection2 = ""
      if (hasDeepAnalysis2) {
        const avg15 = (field: string) => {
          const vals = analysisData2.map((a: Record<string, unknown>) => (a[field] as number) || 0)
          return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        }
        deepStatsSection2 = `
### 15개 카테고리 심층 통계 (${analysisData2.length}개 포트폴리오 심층 분석 기준)
- 기본 역량: 논리력 ${avg15("logic_score")} | 구체성 ${avg15("specificity_score")} | 가독성 ${avg15("readability_score")} | 기술이해 ${avg15("technical_score")} | 창의성 ${avg15("creativity_score")}
- 게임디자인: 핵심반복 ${avg15("core_loop_score")} | 콘텐츠분류 ${avg15("content_taxonomy_score")} | 재화설계 ${avg15("economy_score")} | 플레이경험 ${avg15("player_experience_score")} | 수치데이터 ${avg15("data_design_score")}
- 기획역량: 기능연결 ${avg15("feature_connection_score")} | 동기부여 ${avg15("motivation_score")} | 난이도 ${avg15("difficulty_score")} | UI/UX ${avg15("ui_ux_score")} | 개발계획 ${avg15("dev_plan_score")}

### 고득점 포트폴리오(80점+)의 공통 특징
${(() => {
  const topAnalyses = analysisData2.filter(a => (a.overall_score || 0) >= 80)
  if (topAnalyses.length === 0) return "- 해당 없음"
  const allKeyFeatures = topAnalyses.flatMap(a => a.key_features || [])
  const featureCounts: Record<string, number> = {}
  allKeyFeatures.forEach(f => { featureCounts[f] = (featureCounts[f] || 0) + 1 })
  return Object.entries(featureCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([feature, count]) => `- ${feature} (${count}개 포트폴리오)`)
    .join("\n")
})()}
`
      }

      // 회사별 균형 잡힌 샘플링: 주요 회사별 최대 2개씩 + 나머지
      const priorityCompanies = ["넥슨", "엔씨소프트", "넷마블", "크래프톤", "스마일게이트", "펄어비스", "네오위즈", "웹젠"]
      const selectedExamples: typeof portfolios = []
      const usedIds = new Set<string>()

      // 1단계: 주요 회사별 상위 2개씩 선택
      for (const company of priorityCompanies) {
        const companyPortfolios = portfolios.filter(p =>
          (p.companies as string[] || []).some((c: string) => c === company) && !usedIds.has(p.file_name)
        )
        for (const p of companyPortfolios.slice(0, 2)) {
          selectedExamples.push(p)
          usedIds.add(p.file_name)
        }
      }

      // 2단계: 나머지 슬롯을 점수 상위로 채움 (최대 20개)
      for (const p of portfolios) {
        if (selectedExamples.length >= 20) break
        if (!usedIds.has(p.file_name)) {
          selectedExamples.push(p)
          usedIds.add(p.file_name)
        }
      }

      const topExamples = selectedExamples.map((p, idx) => {
        const strengthsList = (p.strengths || []).slice(0, 3).map(s => `  · ${s}`).join("\n")
        const weaknessesList = (p.weaknesses || []).slice(0, 2).map(w => `  · ${w}`).join("\n")
        const deepInfo = hasDeepAnalysis2
          ? analysisData2.find(a => a.file_name === p.file_name)
          : null
        const deepScores = deepInfo
          ? `\n- 게임디자인: 핵심반복 ${deepInfo.core_loop_score} | 콘텐츠분류 ${deepInfo.content_taxonomy_score} | 재화설계 ${deepInfo.economy_score} | 플레이경험 ${deepInfo.player_experience_score} | 수치데이터 ${deepInfo.data_design_score} | 기능연결 ${deepInfo.feature_connection_score} | 동기부여 ${deepInfo.motivation_score} | 난이도 ${deepInfo.difficulty_score} | UI/UX ${deepInfo.ui_ux_score} | 개발계획 ${deepInfo.dev_plan_score}`
          : ""
        return `
### 합격 사례 ${idx + 1}: ${p.file_name} (${p.overall_score}점)
- 지원사: ${(p.companies || []).join(", ")}
- 문서유형: ${p.document_type || "포트폴리오"}
- 기본점수: 논리 ${p.logic_score} | 구체성 ${p.specificity_score} | 가독성 ${p.readability_score} | 기술이해 ${p.technical_score} | 창의성 ${p.creativity_score}${deepScores}
- 핵심 강점:
${strengthsList}
${weaknessesList ? `- 개선 필요:
${weaknessesList}` : ""}
- 요약: ${p.summary || "N/A"}
`
      }).join("\n")

      // 회사별 강점/약점 패턴 요약 (companyFeedback 정확도 향상용)
      const companyPatterns = Object.entries(companyStats)
        .filter(([, stat]) => stat.count >= 2)
        .slice(0, 8)
        .map(([company]) => {
          const companyPortfolios = portfolios.filter(p =>
            (p.companies as string[] || []).some((c: string) => c === company)
          )
          const allStrengths = companyPortfolios.flatMap(p => p.strengths || [])
          const allWeaknesses = companyPortfolios.flatMap(p => p.weaknesses || [])
          const strengthCounts: Record<string, number> = {}
          allStrengths.forEach(s => { strengthCounts[s] = (strengthCounts[s] || 0) + 1 })
          const weaknessCounts: Record<string, number> = {}
          allWeaknesses.forEach(w => { weaknessCounts[w] = (weaknessCounts[w] || 0) + 1 })
          const topStrengths = Object.entries(strengthCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s)
          const topWeaknesses = Object.entries(weaknessCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w)
          const companyTags = companyPortfolios.flatMap(p => p.tags || [])
          const tagCounts2: Record<string, number> = {}
          companyTags.forEach(t => { tagCounts2[t] = (tagCounts2[t] || 0) + 1 })
          const topCompanyTags = Object.entries(tagCounts2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t)
          return `- **${company}** (${companyPortfolios.length}개 샘플, 평균 ${Math.round(companyPortfolios.reduce((a, b) => a + (b.overall_score || 0), 0) / companyPortfolios.length)}점)
  · 공통 강점: ${topStrengths.join(", ") || "데이터 부족"}
  · 공통 약점: ${topWeaknesses.join(", ") || "데이터 부족"}
  · 주요 키워드: ${topCompanyTags.join(", ") || "데이터 부족"}`
        }).join("\n")

      referenceStats = `
## 📊 학습 데이터 기반 비교 분석 (실제 합격 포트폴리오 ${portfolios.length}개)

### 전체 통계
- 전체 평균: ${avgScores.overall}점
- 논리력 평균: ${avgScores.logic}점 | 구체성 평균: ${avgScores.specificity}점
- 가독성 평균: ${avgScores.readability}점 | 기술이해 평균: ${avgScores.technical}점
- 창의성 평균: ${avgScores.creativity}점
- 주요 키워드: ${topTags.join(", ")}
${deepStatsSection2}
### 회사별 평균 점수
${Object.entries(companyStats).slice(0, 8).map(([company, stat]) =>
  `- ${company}: ${Math.round(stat.total / stat.count)}점 (${stat.count}개 샘플)`
).join("\n")}

### 회사별 합격자 포트폴리오 공통 패턴
${companyPatterns}

---

## 🎯 실제 합격 포트폴리오 패턴 분석 (회사별 균형 샘플링)
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

    // [벡터 서치] 문서 내용 기반 유사 검색 (키워드 추가로 정확도 향상)
    let vectorSearchSection = ""
    const searchPrefix = (input.keywords && input.keywords.length > 0) ? `${input.keywords.slice(0, 3).join(" ")} ` : ""
    if (input.extractedText && input.extractedText.length >= 100) {
      // 추출된 텍스트가 있으면 실제 문서 내용으로 벡터 서치 (정확도 높음)
      try {
        const searchResult = await searchSimilarContent(searchPrefix + input.extractedText, 15, 0.4)
        if (searchResult.chunks.length > 0) {
          vectorSearchSection = formatChunksForPrompt(searchResult.chunks)
          console.log(`[벡터 서치-문서] 텍스트 기반 ${searchResult.chunks.length}개 유사 청크 발견`)
        } else {
          console.log("[벡터 서치-문서] 유사 청크 없음 (텍스트 기반)")
        }
      } catch (err) {
        console.error("[벡터 서치-문서] 텍스트 기반 검색 실패 (무시):", err)
      }
    } else {
      // 텍스트가 없으면 파일명 기반 폴백 (정확도 낮음)
      try {
        const searchQuery = `게임 기획 포트폴리오 ${input.fileName}`
        const searchResult = await searchSimilarContent(searchQuery, 15, 0.35)
        if (searchResult.chunks.length > 0) {
          vectorSearchSection = formatChunksForPrompt(searchResult.chunks)
          console.log(`[벡터 서치-문서] 파일명 기반 ${searchResult.chunks.length}개 유사 청크 발견 (정확도 낮음)`)
        }
      } catch (err) {
        console.error("[벡터 서치-문서] 파일명 기반 검색 실패 (무시):", err)
      }
    }

    // [벤치마크] 회사별 합격 포트폴리오 벤치마크 데이터 주입 (문서 분석: design + readability 모두)
    const benchmarkSection = formatBenchmarkForPrompt(true)

    // [키워드 기반 맞춤 평가] 사용자가 확정한 키워드에 따른 추가 프롬프트
    const keywordSection = (input.keywords && input.keywords.length > 0)
      ? `
## 📌 사용자 확정 키워드: ${input.keywords.join(", ")}
이 키워드와 관련된 합격 포트폴리오 ${portfolios?.length || 0}개를 기반으로 평가합니다.
문서의 주제에 맞게 평가하세요. 관련 없는 항목에 대해 "~가 없다"고 불필요하게 지적하지 마세요.
해당 항목이 문서 주제와 관련 없으면 짧게 언급하세요.

---
`
      : ""

    const systemPrompt = `당신은 게임 업계 11년차 현업 기획자이자 채용 담당자입니다.
${keywordSection}
${portfolios?.length || 0}개의 **실제 합격 포트폴리오**를 학습했으며, 그 패턴을 기반으로 현재 문서를 **철저히 비교 평가**해야 합니다.

${referenceStats}

${vectorSearchSection}

${benchmarkSection}

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
8. **문서의 주제에 맞게 평가하세요.** 평가 기준의 예시(몬스터, 재화, 캐릭터 등)는 일반적인 예시일 뿐입니다. 캐릭터 기획서에 "몬스터 데이터가 없다"거나, 시스템 기획서에 "캐릭터 설정이 부족하다"처럼 문서 주제와 무관한 내용을 피드백에 넣지 마세요. 해당 항목이 문서 주제와 관련 없으면 "이 문서의 주제(캐릭터/시스템/레벨 등)에서는 해당 항목이 직접적으로 다뤄지지 않았습니다" 정도로 짧게 언급하세요.

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
7. **콘텐츠 분류 체계**: 게임의 주요 요소들이 겹치지 않고 빠짐없이 나뉘어 정리되었는가. 큰 분류에서 작은 분류로 체계적으로 나누는 구조가 있는가.
8. **재화 흐름 설계**: 게임 안에서 돈이나 자원이 어디서 생기고, 어디에 쓰이고, 어디서 사라지는지가 설계되었는가. 자원이 한없이 쌓이기만 하는 문제를 막는 구조가 있는가.
9. **플레이 경험 목표**: 이 게임을 하면서 플레이어가 느꼈으면 하는 감정이나 경험(예: 도전감, 탐험의 재미, 이야기 몰입, 친구와 함께하는 즐거움 등)이 명확하고, 그 경험을 만들기 위해 어떤 게임 규칙을 넣었는지 연결이 되는가.
10. **수치 데이터 정리**: 게임에 들어가는 숫자 데이터가 표 형태로 정리되어 있는가. 이 문서의 주제에 해당하는 수치(예: 캐릭터 문서면 캐릭터 스탯, 시스템 문서면 시스템 수치 등)가 있는가. 예시 데이터가 포함되어 있고, 각 표끼리 어떻게 연결되는지 설명이 있는가.
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

**게임 디자인 역량 feedback 작성 규칙**: 각 항목의 feedback은 반드시 3줄 이상 작성하세요. 위의 '회사별 합격 포트폴리오 벤치마크' 데이터를 참고하여 합격자들의 구체적 특징과 비교하세요. [강점]과 [보완]을 구분해서 작성하세요.
- [강점]으로 시작하는 줄: 이 문서에서 해당 항목이 잘 된 부분
- [보완]으로 시작하는 줄: 합격자들과 비교했을 때 부족한 부분과 구체적 개선 방향. 벤치마크의 합격자 특징을 인용하여 "합격자들은 ~하지만, 이 문서는 ~합니다"로 서술
- 해당 항목이 전혀 없으면 [보완]만 작성하되, 벤치마크를 참고하여 합격자들은 어떻게 하는지 설명

### 문서 가독성 평가 (10개) - PDF 문서 전용
위의 '문서 가독성 — 회사별 합격자 특징' 벤치마크를 참고하여 각 항목의 feedback을 작성하세요.
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
좌표 규칙 (반드시 준수):
- x는 왼쪽에서의 위치(%), y는 위에서의 위치(%), w는 너비(%), h는 높이(%)
- **절대 겹치지 않게 배치**: 각 섹션의 영역(x~x+w, y~y+h)이 다른 섹션과 겹쳐서는 안 됨
- **영역 안에 유지**: x+w ≤ 100, y+h ≤ 100 (섹션이 페이지 밖으로 나가면 안 됨)
- 최소 여백 2% 이상 확보 (섹션 사이에 간격 두기)
- 섹션은 2~5개 사이로 구성
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
    { "subject": "수치데이터", "value": 30, "fullMark": 100, "feedback": "[보완] 합격자들은 주요 게임 요소의 수치를 표로 정리합니다. 이 문서에는 수치 테이블이 없습니다." },
    { "subject": "기능연결", "value": 50, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "동기부여", "value": 45, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "난이도균형", "value": 35, "fullMark": 100, "feedback": "[보완] 부족한 점. 3줄 이상." },
    { "subject": "화면조작", "value": 55, "fullMark": 100, "feedback": "[강점] 잘 된 부분.\\n[보완] 부족한 점. 3줄 이상." },
    { "subject": "개발일정", "value": 40, "fullMark": 100, "feedback": "[보완] 부족한 점. 3줄 이상." }
  ],
  "strengths": ["강점1", "강점2", "강점3", "강점4", "강점5", "강점6"],
  "weaknesses": ["보완점1", "보완점2", "보완점3", "보완점4", "보완점5", "보완점6"],
  "companyFeedback": "위의 '회사별 합격 포트폴리오 벤치마크' 데이터를 반드시 참고하여 작성. **넥슨**, **엔씨소프트**, **넷마블**, **크래프톤**, **스마일게이트**, **펄어비스**, **네오위즈**, **웹젠** 8개 회사 전부 작성. 각 회사별로 2~3문장씩. 형식: **회사명** 합격자들은 ~한 특징이 있습니다. 이 문서는 ~합니다. 회사마다 줄바꿈(\\n\\n)으로 구분. 절대 '~사례처럼' 표현 금지. [필수] 각 회사 벤치마크 데이터에서 해당 회사 합격자들의 핵심 특징(design/readability)을 인용하여 비교하세요. 각 회사 피드백의 '이 문서는 ~' 부분에서 반드시 이 문서에서 실제로 발견한 구체적인 내용을 인용하세요. 문서에 없는 기능이나 내용을 있다고 하면 안 됩니다.",
  "readabilityCategories": [
    { "subject": "글자크기구분", "value": 70, "fullMark": 100, "feedback": "벤치마크 참고하여 합격자 대비 제목/본문 크기 구분에 대한 구체적 피드백" },
    { "subject": "문단나누기", "value": 65, "fullMark": 100, "feedback": "벤치마크 참고하여 합격자 대비 문단 구성 피드백" },
    { "subject": "여백활용", "value": 55, "fullMark": 100, "feedback": "벤치마크 참고하여 합격자 대비 여백 상태 피드백" },
    { "subject": "색상활용", "value": 72, "fullMark": 100, "feedback": "벤치마크 참고하여 합격자 대비 색상 사용 피드백" },
    { "subject": "표와그림배치", "value": 60, "fullMark": 100, "feedback": "벤치마크 참고하여 합격자 대비 표/그림 배치 피드백" },
    { "subject": "페이지구성", "value": 68, "fullMark": 100, "feedback": "벤치마크 참고하여 합격자 대비 페이지 구성 피드백" },
    { "subject": "읽는순서", "value": 75, "fullMark": 100, "feedback": "벤치마크 참고하여 합격자 대비 읽는 순서 피드백" },
    { "subject": "강조표현", "value": 50, "fullMark": 100, "feedback": "벤치마크 참고하여 합격자 대비 강조 표현 피드백" },
    { "subject": "목차와번호", "value": 40, "fullMark": 100, "feedback": "벤치마크 참고하여 합격자 대비 목차/번호 피드백" },
    { "subject": "전체통일감", "value": 62, "fullMark": 100, "feedback": "벤치마크 참고하여 합격자 대비 전체 통일감 피드백" }
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
    const fileSizeMB = fileBuffer.length / (1024 * 1024)

    // Anthropic API PDF 제한: base64 변환 시 ~33% 증가
    // 25MB 이상은 텍스트 폴백, API 에러 시에도 자동 폴백
    const MAX_FILE_SIZE_MB = 25
    // Claude API 문서 블록은 PDF/이미지만 지원 — PPTX, DOCX 등은 텍스트 폴백
    const supportedDocTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ]
    const isDocTypeSupported = supportedDocTypes.includes(input.mimeType)
    const useTextFallback = fileSizeMB > MAX_FILE_SIZE_MB || !isDocTypeSupported

    if (!isDocTypeSupported) {
      console.log(`[분석] 비지원 파일형식(${input.mimeType}) → 텍스트 추출 모드로 전환`)
    }

    let base64Data = ""
    let mediaType: "application/pdf" | "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "application/pdf"

    if (!useTextFallback) {
      base64Data = fileBuffer.toString("base64")
      mediaType = input.mimeType as typeof mediaType
    } else {
      // 대용량 파일: 추출된 텍스트가 없으면 분석 불가
      if (!input.extractedText || input.extractedText.length < 100) {
        return { error: `파일 크기(${fileSizeMB.toFixed(1)}MB)가 너무 큽니다. PDF에서 텍스트를 추출할 수 없어 분석이 불가합니다. 30MB 이하로 압축하거나 텍스트가 포함된 PDF로 다시 시도해 주세요.` }
      }
      console.log(`[분석] 대용량 PDF(${fileSizeMB.toFixed(1)}MB) → 텍스트 추출 모드로 전환 (${input.extractedText.length}자)`)
    }

    try {
      // Claude API 호출 (플랜에 따라 모델 선택, 500 에러 자동 재시도)
      const anthropic = new Anthropic({ apiKey, maxRetries: 3 })
      const selectedModel = await getModelForUser()

      // 대용량 파일: 텍스트 기반 분석 / 일반 파일: 원본 문서 분석
      let pageContent = input.extractedText || ""
      if (pageContent.length > 100000) {
        pageContent = pageContent.substring(0, 100000)
      }

      const messages: Anthropic.MessageParam[] = useTextFallback
        ? [
            {
              role: "user" as const,
              content: `아래는 "${input.fileName}" 문서(${fileSizeMB.toFixed(1)}MB)에서 추출한 텍스트 내용입니다. 원본 PDF가 너무 커서 텍스트만 추출하여 분석합니다. 시스템 프롬프트의 평가 기준과 합격 사례들을 참고하여 JSON 형식으로만 응답해주세요. 반드시 15개 categories, companyFeedback, readabilityCategories(10개), layoutRecommendations(3개)를 모두 포함해야 합니다. 단, 텍스트 기반 분석이므로 readabilityCategories와 layoutRecommendations는 텍스트 구조를 기반으로 추정하여 작성해주세요.\n\n---\n\n${pageContent}`,
            },
          ]
        : [
            {
              role: "user" as const,
              content: [
                {
                  type: "document" as const,
                  source: {
                    type: "base64" as const,
                    media_type: mediaType,
                    data: base64Data,
                  },
                },
                {
                  type: "text" as const,
                  text: "위 문서를 분석해주세요. 시스템 프롬프트의 평가 기준과 합격 사례들을 참고하여 JSON 형식으로만 응답해주세요. 반드시 15개 categories, companyFeedback, readabilityCategories(10개), layoutRecommendations(3개)를 모두 포함해야 합니다.",
                },
              ],
            },
          ]

      let message
      try {
        message = await anthropic.messages.create({
          model: selectedModel,
          max_tokens: 16384,
          temperature: 0,
          messages,
          system: systemPrompt,
        })
      } catch (apiError: unknown) {
        // PDF 직접 전송 실패 시 텍스트 폴백 재시도
        const errMsg = apiError instanceof Error ? apiError.message : String(apiError)
        if (!useTextFallback && input.extractedText && input.extractedText.length >= 100) {
          console.error(`[분석-문서] PDF 직접 전송 실패(${errMsg}), 텍스트 폴백 재시도`)
          let fallbackContent = input.extractedText
          if (fallbackContent.length > 100000) fallbackContent = fallbackContent.substring(0, 100000)

          const fallbackMessages: Anthropic.MessageParam[] = [{
            role: "user" as const,
            content: `아래는 "${input.fileName}" 문서(${fileSizeMB.toFixed(1)}MB)에서 추출한 텍스트 내용입니다. 원본 PDF 전송이 실패하여 텍스트만 추출하여 분석합니다. 시스템 프롬프트의 평가 기준과 합격 사례들을 참고하여 JSON 형식으로만 응답해주세요. 반드시 15개 categories, companyFeedback, readabilityCategories(10개), layoutRecommendations(3개)를 모두 포함해야 합니다.\n\n---\n\n${fallbackContent}`,
          }]

          message = await anthropic.messages.create({
            model: selectedModel,
            max_tokens: 16384,
            temperature: 0,
            messages: fallbackMessages,
            system: systemPrompt,
          })
        } else {
          throw apiError
        }
      }

      // stop_reason 체크 — max_tokens로 잘리면 JSON 파싱 실패 가능
      if (message.stop_reason === "max_tokens") {
        console.error("[분석-문서] ⚠️ Claude 응답이 max_tokens에 의해 잘렸습니다. 출력이 불완전할 수 있습니다.")
      }

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

      const analysis = safeParseJSON(jsonStr)

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
      const targetCompanies = ["넥슨", "엔씨소프트", "넷마블", "크래프톤", "웹젠", "스마일게이트", "네오위즈", "펄어비스"]
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

      const analysisResult2 = {
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

      // 분석 이력 저장 + 크레딧 차감
      saveAnalysisHistory({
        projectId: input.projectId,
        fileName: input.fileName,
        score: analysis.score,
        categories: analysis.categories,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        ranking: analysisResult2.ranking,
        companyFeedback: analysis.companyFeedback || "",
        analysisSource: "pdf",
        readabilityCategories: analysis.readabilityCategories || [],
        layoutRecommendations: analysis.layoutRecommendations || [],
      }).catch(() => {})

      deductCredit().catch(() => {})

      return { data: analysisResult2 }
    } finally {
      // Supabase Storage에서 파일 삭제
      const supabaseClient = await createClient()
      await supabaseClient.storage.from("resumes").remove([input.filePath]).catch(() => {})
    }
  } catch (error) {
    console.error("Analysis error:", error)
    const errMsg = error instanceof Error ? error.message : String(error)
    if (errMsg.includes("credit balance") || errMsg.includes("insufficient_quota") || errMsg.includes("billing")) {
      return { error: "CREDIT_LIMIT_EXCEEDED" }
    }
    if (errMsg.includes("timeout") || errMsg.includes("FUNCTION_INVOCATION_TIMEOUT")) {
      return { error: "분석 시간이 초과되었습니다. 파일 크기가 큰 경우 시간이 오래 걸릴 수 있습니다. 다시 시도해 주세요." }
    }
    if (errMsg.includes("too many tokens") || errMsg.includes("context_length")) {
      return { error: "파일 내용이 너무 많아 분석할 수 없습니다. 더 짧은 문서로 시도해 주세요." }
    }
    if (errMsg.includes("request_too_large") || errMsg.includes("413") || errMsg.includes("maximum size")) {
      return { error: "파일 크기가 API 제한을 초과했습니다. 파일을 30MB 이하로 압축하여 다시 시도해 주세요." }
    }
    if (errMsg.includes("Internal server error") || errMsg.includes("api_error") || errMsg.includes("overloaded") || errMsg.includes("529")) {
      return { error: "AI 서버가 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요." }
    }
    return { error: `분석 중 오류가 발생했습니다. 다시 시도해 주세요. (${errMsg.slice(0, 100)})` }
  }
}
