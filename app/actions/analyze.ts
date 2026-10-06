/**
 * 사용자 포트폴리오 분석 서버 액션
 *
 * 핵심 함수:
 * - checkBeforeAnalysis(): 분석 전 인증 + 크레딧 확인
 * - uploadFileToStorage() / deleteFileFromStorage(): Supabase Storage 업로드·삭제
 * - scanDocument(): 1단계 — 직군·문서 형식·키워드 스캔 (Haiku, 크레딧 소모 없음)
 * - analyzeDocumentDirect(): 2단계 — 업로드된 파일(PDF/이미지/오피스) → Claude 분석
 * - analyzeUrlDirect(): 2단계 — URL 크롤링 또는 클라이언트 추출 텍스트 → Claude 분석
 *
 * 분석 파이프라인 (runAnalysis — 두 진입점이 공유):
 * 1. 크레딧·일일 상한 가드 (티어별 비용: 기본 1, 정밀 2)
 * 2. 직군 결정 (사용자가 1단계에서 확정한 값 → 없으면 휴리스틱)
 * 3. 같은 직군 합격 포트폴리오만 비교군으로 로드 (lib/analysis/reference.ts)
 * 4. 벡터 검색(유사 합격작 발췌) + 게임 디자인 라이브러리 인용
 * 5. 시스템 프롬프트 4블록 구성 + 프롬프트 캐싱 (lib/analysis/prompt.ts)
 * 6. 모델 호출 — PDF는 Files API로 업로드 후 참조 (base64 32MB 제한 회피), 실패 시 base64 → 텍스트 폴백
 * 7. JSON 파싱 → 직군 채점표로 정규화 (해당 없음 항목은 value null)
 * 8. 같은 직군 표본 기준 랭킹 → 이력 저장(토큰 사용량 포함) → 크레딧 차감
 *
 * 2026-10-06 개편 전 코드와의 차이: docs/PRD_문서분석.md 참조.
 * 환경변수: ANTHROPIC_API_KEY, JINA_API_KEY, OPENAI_API_KEY, ANALYSIS_MODEL_* (선택)
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import Anthropic, { toFile } from "@anthropic-ai/sdk"
import { v4 as uuidv4 } from "uuid"
import { checkAnalysisAllowance, saveAnalysisHistory, deductCredit } from "./subscription"
import { searchSimilarContent, formatChunksForPrompt } from "@/lib/vector-search"
import { searchSimilarLibraryContent, formatLibraryChunksForPrompt } from "@/lib/library/vector"
import { validateMimeMatchesSignature } from "@/lib/file-validation"
import {
  CATEGORY_SUBJECTS,
  DOMAIN_RUBRIC,
  DOMAIN_LABELS,
  classifyHeuristically,
  isDesignDomain,
  isDocForm,
  type DesignDomain,
  type DocForm,
} from "@/lib/analysis/domains"
import { MODEL_TIERS, DEFAULT_TIER, isModelTier, resolveModelId, type ModelTier } from "@/lib/analysis/model"
import { loadReferenceSet, type ReferenceSet } from "@/lib/analysis/reference"
import { buildSystemBlocks, buildUserInstruction, type AnalysisMode } from "@/lib/analysis/prompt"
import { formatBenchmarkForPrompt } from "@/lib/analysis/benchmark"
import { scanDocumentWithClaude, type DocumentScan } from "@/lib/analysis/classify"
import { extractJsonBlock, safeParseJSON } from "@/lib/analysis/json"
import { summarizeUsage, logUsage, type TokenUsage } from "@/lib/analysis/usage"

// ───────────────────────────────────────────
// 공개 타입 (클라이언트가 그대로 받는다)
// ───────────────────────────────────────────

export interface AnalysisCategory {
  subject: string
  /** 해당 없음 항목은 null */
  value: number | null
  fullMark: 100
  applicable: boolean
  feedback: string
}

export interface StandardsCheckItem {
  element: string
  status: "있음" | "부분" | "없음"
  note: string
}

export interface AnalysisResultData {
  score: number
  domainFit?: string
  /** 같은 직군 합격작 공통 요소 대조 (기준 카드 기반) */
  standardsCheck: StandardsCheckItem[]
  nextSteps: string[]
  categories: AnalysisCategory[]
  strengths: string[]
  weaknesses: string[]
  companyFeedback: string
  analysisSource: "pdf" | "url"
  readabilityCategories: Record<string, unknown>[]
  layoutRecommendations: Record<string, unknown>[]
  ranking: {
    total: number
    percentile: number
    rank: number
    companyComparison: { company: string; avgScore: number; userScore: number; sampleCount: number }[]
  }
  designDomain: DesignDomain
  designDomainLabel: string
  secondaryDomains: DesignDomain[]
  docForm: DocForm
  modelTier: ModelTier
  modelTierLabel: string
  comparisonPool: { sameDomainCount: number; total: number; insufficient: boolean; cardedCount: number }
  usage: TokenUsage
}

export interface AnalyzeOptions {
  tier?: ModelTier
  domain?: DesignDomain
  secondaryDomains?: DesignDomain[]
  docForm?: DocForm
  keywords?: string[]
}

// ───────────────────────────────────────────
// 분석 전 확인 / 업로드 / 삭제 (기존과 동일)
// ───────────────────────────────────────────

export async function checkBeforeAnalysis() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { allowed: false, reason: "login_required" as const }
  }

  const allowance = await checkAnalysisAllowance()
  if (!allowance.allowed) {
    if ("expired" in allowance && allowance.expired) {
      return { allowed: false, reason: "expired" as const, plan: allowance.plan }
    }
    return { allowed: false, reason: "limit_reached" as const, plan: allowance.plan }
  }

  return { allowed: true, plan: allowance.plan, unlimited: allowance.unlimited, remaining: allowance.remaining }
}

export async function uploadFileToStorage(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: "먼저 로그인해주세요." }
    }

    const file = formData.get("file") as File
    if (!file) {
      return { error: "파일을 찾을 수 없어요. 다시 업로드해주세요." }
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg", "image/png", "image/webp",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "text/plain",
    ]
    if (!allowedTypes.includes(file.type)) {
      return { error: "지원하지 않는 파일 형식이에요. PDF, DOCX, PPTX, XLSX, TXT, 이미지 파일만 업로드할 수 있어요." }
    }

    if (file.size > 200 * 1024 * 1024) {
      return { error: `파일이 너무 커요(${(file.size / (1024 * 1024)).toFixed(1)}MB). 최대 200MB, 권장 30MB 이하예요. 이미지를 압축하거나 페이지를 줄여서 다시 올려주세요.` }
    }

    const sigResult = await validateMimeMatchesSignature(file)
    if (!sigResult.valid) {
      console.warn("[uploadFileToStorage] 파일 시그니처 검증 실패:", { name: file.name, type: file.type, reason: sigResult.reason })
      return { error: "파일 내용이 형식과 다른 것 같아요. 정상적인 PDF, 이미지, 또는 Office 파일만 업로드할 수 있어요." }
    }

    const fileExt = file.name.split(".").pop()
    const filePath = `uploads/${uuidv4()}.${fileExt}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await supabase.storage
      .from("resumes")
      .upload(filePath, buffer, { contentType: file.type, upsert: false })

    if (error) {
      console.error("Upload error:", error)
      return { error: "파일 업로드에 실패했어요. 인터넷 연결을 확인하고 다시 시도해주세요." }
    }

    const { data: urlData } = supabase.storage.from("resumes").getPublicUrl(filePath)

    return {
      data: {
        fileName: file.name,
        filePath,
        fileUrl: urlData.publicUrl,
        mimeType: file.type,
        size: file.size,
      },
    }
  } catch (error) {
    console.error("Upload error:", error)
    return { error: "파일 업로드 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." }
  }
}

export async function deleteFileFromStorage(filePath: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: "먼저 로그인해주세요." }
    }
    if (!filePath.startsWith("uploads/")) {
      return { error: "파일을 처리할 수 없어요. 다시 시도해주세요." }
    }
    await supabase.storage.from("resumes").remove([filePath])
    return { success: true }
  } catch (error) {
    console.error("Delete error:", error)
    return { error: "임시 파일 정리에 실패했어요. 분석 결과에는 영향 없어요." }
  }
}

// ───────────────────────────────────────────
// 가드
// ───────────────────────────────────────────

// 일일 상한: 계정당 24시간 5회 (재시도 폭주·악용 차단기, 관리자 제외)
const DAILY_ANALYSIS_LIMIT = 5

async function guardAnalysisEntry(creditCost: number): Promise<{ error?: string }> {
  const allowance = await checkAnalysisAllowance()
  if (!allowance.allowed) {
    if (allowance.reason === "login_required") return { error: "먼저 로그인해주세요." }
    if ("expired" in allowance && allowance.expired) {
      return { error: "구독이 만료되었습니다. 크레딧을 구매해 주세요." }
    }
    return { error: "분석 크레딧이 없습니다. 크레딧을 구매해 주세요. 과외 수강생은 매월 크레딧이 지급됩니다." }
  }

  if (allowance.plan === "admin") return {}

  // 크레딧으로 결제하는 사용자는 티어 비용만큼 보유해야 한다 (정밀 분석 = 2크레딧)
  if ("source" in allowance && allowance.source === "credit") {
    const remaining = allowance.remaining ?? 0
    if (remaining < creditCost) {
      return { error: `이 분석에는 크레딧 ${creditCost}개가 필요해요. 현재 ${remaining}개 남아 있어요. 기본 분석을 선택하거나 크레딧을 충전해 주세요.` }
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "먼저 로그인해주세요." }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from("analysis_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("analyzed_at", since)

  if ((count ?? 0) >= DAILY_ANALYSIS_LIMIT) {
    return { error: `오늘 분석 한도(${DAILY_ANALYSIS_LIMIT}회)를 모두 사용했어요. 24시간 후에 다시 시도해주세요.` }
  }
  return {}
}

// URL이 내부 네트워크를 가리키는지 검사 (SSRF 방어)
function isInternalUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    const hostname = url.hostname.toLowerCase()
    if (url.protocol !== "http:" && url.protocol !== "https:") return true
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") ||
      hostname.startsWith("fd") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "[::1]" ||
      hostname === "metadata.google.internal" ||
      hostname.includes("[::ffff:")
    ) {
      return true
    }
    return false
  } catch {
    return true
  }
}

// ───────────────────────────────────────────
// 1단계: 문서 스캔 (직군 + 키워드)
// ───────────────────────────────────────────

export async function scanDocument(input: {
  fileName: string
  extractedText: string
}): Promise<{ scan?: DocumentScan; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "먼저 로그인해주세요." }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: "AI 서비스 설정에 문제가 있어요. 잠시 후 다시 시도해주세요." }

  try {
    const scan = await scanDocumentWithClaude({ fileName: input.fileName, text: input.extractedText.slice(0, 8000), apiKey })
    return { scan }
  } catch (err) {
    console.error("[scanDocument] 실패:", err)
    const h = classifyHeuristically({ fileName: input.fileName, text: input.extractedText })
    return { scan: { domain: h.domain, secondary: h.secondary, docForm: h.docForm, keywords: [], gameTitle: null, confidence: 0.3, method: "heuristic" } }
  }
}

// ───────────────────────────────────────────
// 2단계 진입점 ① URL / 추출 텍스트
// ───────────────────────────────────────────

export async function analyzeUrlDirect(input: {
  projectId: string
  url?: string
  extractedText?: string
  fileName?: string
} & AnalyzeOptions) {
  const supabaseAuth = await createClient()
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
  if (!authUser) return { error: "먼저 로그인해주세요." }

  const tier = isModelTier(input.tier) ? input.tier : DEFAULT_TIER
  const guard = await guardAnalysisEntry(MODEL_TIERS[tier].creditCost)
  if (guard.error) return { error: guard.error }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: "AI 서비스 설정에 문제가 있어요. 잠시 후 다시 시도해주세요." }

  if (input.url && !input.extractedText && isInternalUrl(input.url)) {
    return { error: "이 URL은 분석할 수 없어요. 공개된 웹 페이지 주소만 입력해주세요." }
  }

  try {
    let pageContent = ""
    if (input.extractedText) {
      pageContent = input.extractedText
      if (pageContent.length < 100) {
        return { error: "PDF에서 텍스트를 읽어올 수 없어요. 스캔된 이미지로만 만든 문서일 수 있어요. 텍스트가 포함된 PDF로 다시 올려주세요." }
      }
    } else {
      const fetched = await fetchUrlText(input.url!)
      if ("error" in fetched) return { error: fetched.error }
      pageContent = fetched.text
    }

    const displayName = input.extractedText ? (input.fileName || "대용량 PDF") : input.url!
    return await runAnalysis({
      projectId: input.projectId,
      fileName: displayName,
      content: { kind: "text", text: pageContent, source: input.extractedText ? "pdf" : "url" },
      extractedText: pageContent,
      options: input,
      apiKey,
    })
  } catch (error) {
    console.error("URL Analysis error:", error)
    return { error: toUserError(error) }
  }
}

async function fetchUrlText(url: string): Promise<{ text: string } | { error: string }> {
  const extractTextFromHtml = (html: string) =>
    html
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

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GameFeedbackBot/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) {
      return { error: "웹 페이지를 가져올 수 없어요. URL이 올바르고 공개되어 있는지 확인해주세요." }
    }
    let text = extractTextFromHtml(await response.text())

    // SPA/자바스크립트 페이지: Jina AI Reader 폴백
    if (text.length < 200) {
      try {
        const jina = await fetch(`https://r.jina.ai/${url}`, {
          headers: { Accept: "text/plain", "X-No-Cache": "true" },
          signal: AbortSignal.timeout(30000),
        })
        if (jina.ok) {
          const jinaText = await jina.text()
          if (jinaText.length > text.length) text = jinaText
        }
      } catch {
        // Jina 실패해도 기존 텍스트로 진행
      }
    }

    if (text.length < 100) {
      return { error: "페이지에서 텍스트를 읽어올 수 없어요. JavaScript로 동작하거나 비공개 페이지일 수 있어요. 파일을 직접 업로드해주세요." }
    }
    return { text }
  } catch (fetchError: unknown) {
    if (fetchError instanceof Error && fetchError.name === "TimeoutError") {
      return { error: "웹 페이지 응답이 너무 느려요. 잠시 후 다시 시도하거나 다른 URL로 시도해주세요." }
    }
    return { error: "웹 페이지를 가져올 수 없어요. URL이 올바르고 공개되어 있는지 확인해주세요." }
  }
}

// ───────────────────────────────────────────
// 2단계 진입점 ② 업로드된 파일
// ───────────────────────────────────────────

const CLAUDE_DOCUMENT_TYPES = ["application/pdf"]
const CLAUDE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

export async function analyzeDocumentDirect(input: {
  projectId: string
  fileName: string
  fileUrl: string
  mimeType: string
  filePath: string
  extractedText?: string
} & AnalyzeOptions) {
  const supabaseAuth = await createClient()
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
  if (!authUser) return { error: "먼저 로그인해주세요." }

  const tier = isModelTier(input.tier) ? input.tier : DEFAULT_TIER
  const guard = await guardAnalysisEntry(MODEL_TIERS[tier].creditCost)
  if (guard.error) return { error: guard.error }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: "AI 서비스 설정에 문제가 있어요. 잠시 후 다시 시도해주세요." }

  try {
    try {
      const response = await fetch(input.fileUrl)
      if (!response.ok) {
        return { error: "업로드된 파일을 가져올 수 없어요. 다시 업로드해주세요." }
      }
      const fileBuffer = Buffer.from(await response.arrayBuffer())
      const sizeMB = fileBuffer.length / (1024 * 1024)
      const isClaudeNative = CLAUDE_DOCUMENT_TYPES.includes(input.mimeType) || CLAUDE_IMAGE_TYPES.includes(input.mimeType)
      const hasText = !!input.extractedText && input.extractedText.length >= 100

      if (!isClaudeNative) {
        // PPTX/DOCX/XLSX/TXT: 모델이 원본을 읽을 수 없으므로 추출 텍스트로 분석
        if (!hasText) {
          return { error: "이 파일에서 텍스트를 읽어올 수 없어요. PDF로 변환해서 다시 올려주세요." }
        }
        console.log(`[분석] 비지원 파일형식(${input.mimeType}) → 텍스트 모드`)
        return await runAnalysis({
          projectId: input.projectId,
          fileName: input.fileName,
          content: { kind: "text", text: input.extractedText!, source: "pdf" },
          extractedText: input.extractedText,
          options: input,
          apiKey,
        })
      }

      return await runAnalysis({
        projectId: input.projectId,
        fileName: input.fileName,
        content: { kind: "file", buffer: fileBuffer, mimeType: input.mimeType, sizeMB },
        extractedText: input.extractedText,
        options: input,
        apiKey,
      })
    } finally {
      // 분석이 끝나면 임시 업로드 파일 삭제 (성공/실패 무관)
      const supabaseClient = await createClient()
      await supabaseClient.storage.from("resumes").remove([input.filePath]).catch(() => {})
    }
  } catch (error) {
    console.error("Analysis error:", error)
    return { error: toUserError(error) }
  }
}

// ───────────────────────────────────────────
// 공통 파이프라인
// ───────────────────────────────────────────

type ContentInput =
  | { kind: "file"; buffer: Buffer; mimeType: string; sizeMB: number }
  | { kind: "text"; text: string; source: "pdf" | "url" }

const FILES_API_BETA = "files-api-2025-04-14"
/** Files API 실패 시 base64 인라인으로 보낼 수 있는 상한 (API 요청 32MB 제한, base64 +33% 고려) */
const INLINE_BASE64_LIMIT_MB = 20
/** 텍스트 모드 상한 — 1M 컨텍스트 모델 기준 (약 15만 토큰) */
const TEXT_MODE_MAX_CHARS = 400_000
const RANKING_COMPANIES = ["넥슨", "엔씨소프트", "넷마블", "크래프톤", "웹젠", "스마일게이트", "네오위즈", "펄어비스"]

function supportsEffort(model: string): boolean {
  return /claude-(opus|sonnet)-(4-[5-9]|[5-9])|fable|mythos/.test(model)
}

function isRequestTooLarge(message: string): boolean {
  return /request_too_large|too many tokens|context_length|prompt is too long|413|maximum size|exceeds/.test(message)
}

async function runAnalysis(params: {
  projectId: string
  fileName: string
  content: ContentInput
  extractedText?: string
  options: AnalyzeOptions
  apiKey: string
}): Promise<{ data?: AnalysisResultData; error?: string }> {
  const startedAt = Date.now()
  const { options } = params
  const tier: ModelTier = isModelTier(options.tier) ? options.tier : DEFAULT_TIER
  const tierInfo = MODEL_TIERS[tier]
  const model = resolveModelId(tier)
  const keywords = (options.keywords ?? []).filter(k => typeof k === "string" && k.trim()).map(k => k.trim()).slice(0, 12)

  // 검색·분류에 쓸 텍스트
  const searchText = params.extractedText && params.extractedText.length >= 100
    ? params.extractedText
    : params.content.kind === "text" ? params.content.text : ""

  // 직군 결정: 사용자가 1단계에서 확정한 값 우선
  let domain: DesignDomain
  let secondary: DesignDomain[]
  let docForm: DocForm
  if (isDesignDomain(options.domain)) {
    domain = options.domain
    const h = classifyHeuristically({ fileName: params.fileName, text: searchText })
    secondary = (options.secondaryDomains ?? h.secondary).filter((d): d is DesignDomain => isDesignDomain(d) && d !== domain).slice(0, 2)
    docForm = isDocForm(options.docForm) ? options.docForm : h.docForm
  } else {
    const h = classifyHeuristically({ fileName: params.fileName, text: searchText })
    domain = h.domain
    secondary = h.secondary
    docForm = h.docForm
  }
  console.log(`[분석] 직군=${domain} (${DOMAIN_LABELS[domain]}) 형식=${docForm} 티어=${tier} 모델=${model}`)

  const supabase = await createClient()

  // 같은 직군 합격작 + 벡터/라이브러리 검색을 병렬로
  const searchQuery = (keywords.length ? `${keywords.slice(0, 3).join(" ")} ` : "") + searchText
  const [reference, vectorResult, libraryResult] = await Promise.all([
    loadReferenceSet(supabase, domain),
    searchText.length >= 100
      ? searchSimilarContent(searchQuery, 15, 0.4).catch(err => { console.error("[벡터 서치] 실패 (무시):", err); return { chunks: [] } })
      : Promise.resolve({ chunks: [] }),
    searchText.length >= 100
      ? searchSimilarLibraryContent(searchQuery, { matchCount: 6, matchThreshold: 0.35, types: ["principle", "pattern", "antipattern", "core_rule", "genre_guide"] })
          .catch(err => { console.error("[라이브러리] 실패 (무시):", err); return { chunks: [] } })
      : Promise.resolve({ chunks: [] }),
  ])
  console.log(`[분석] 비교군 ${reference.sameDomainCount}건${reference.insufficient ? " (표본 부족)" : ""}, 유사 청크 ${vectorResult.chunks.length}, 라이브러리 ${libraryResult.chunks.length}`)

  const vectorSection = vectorResult.chunks.length ? formatChunksForPrompt(vectorResult.chunks) : ""
  const librarySection = libraryResult.chunks.length ? formatLibraryChunksForPrompt(libraryResult.chunks) : ""

  const client = new Anthropic({ apiKey: params.apiKey, maxRetries: 1 })

  // ── 모델 호출 (파일 → 실패 시 텍스트 폴백) ──
  let message: Anthropic.Beta.BetaMessage | undefined
  let mode: AnalysisMode = params.content.kind === "file" ? "pdf" : params.content.source === "url" ? "url" : "text"

  const callText = async (text: string, textMode: AnalysisMode) => {
    const clipped = text.length > TEXT_MODE_MAX_CHARS ? text.substring(0, TEXT_MODE_MAX_CHARS) : text
    const system = buildSystemBlocks({ domain, secondary, docForm, mode: textMode, reference, benchmarkSection: formatBenchmarkForPrompt(false), vectorSection, librarySection, keywords })
    return client.beta.messages.stream({
      model,
      max_tokens: 20000,
      system,
      messages: [{ role: "user", content: `${buildUserInstruction(textMode, params.fileName)}\n\n---\n\n${clipped}` }],
      ...(supportsEffort(model) ? { output_config: { effort: tierInfo.effort } } : {}),
    }).finalMessage()
  }

  if (params.content.kind === "file") {
    const { buffer, mimeType, sizeMB } = params.content
    const isImage = CLAUDE_IMAGE_TYPES.includes(mimeType)
    const system = buildSystemBlocks({ domain, secondary, docForm, mode: "pdf", reference, benchmarkSection: formatBenchmarkForPrompt(true), vectorSection, librarySection, keywords })
    const instruction = buildUserInstruction("pdf", params.fileName, `${sizeMB.toFixed(1)}MB`)

    let uploadedFileId: string | null = null
    try {
      // 1) Files API 업로드 — 요청 본문 크기 제한(32MB)과 무관하게 원본을 모델에 전달
      let fileBlock: Anthropic.Beta.BetaContentBlockParam | null = null
      try {
        const uploaded = await client.beta.files.upload({
          file: await toFile(buffer, params.fileName, { type: mimeType }),
          betas: [FILES_API_BETA],
        })
        uploadedFileId = uploaded.id
        fileBlock = isImage
          ? { type: "image", source: { type: "file", file_id: uploaded.id } }
          : { type: "document", source: { type: "file", file_id: uploaded.id } }
        console.log(`[분석] Files API 업로드 완료 (${sizeMB.toFixed(1)}MB)`)
      } catch (uploadErr) {
        console.error("[분석] Files API 업로드 실패:", uploadErr instanceof Error ? uploadErr.message : uploadErr)
        if (sizeMB <= INLINE_BASE64_LIMIT_MB) {
          // 2) base64 인라인 폴백
          const data = buffer.toString("base64")
          fileBlock = isImage
            ? { type: "image", source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data } }
            : { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
          console.log("[분석] base64 인라인으로 전송")
        }
      }

      if (fileBlock) {
        try {
          message = await client.beta.messages.stream({
            model,
            max_tokens: 32000,
            system,
            messages: [{ role: "user", content: [fileBlock, { type: "text", text: instruction }] }],
            ...(uploadedFileId ? { betas: [FILES_API_BETA] } : {}),
            ...(supportsEffort(model) ? { output_config: { effort: tierInfo.effort } } : {}),
          }).finalMessage()
        } catch (apiErr) {
          const msg = apiErr instanceof Error ? apiErr.message : String(apiErr)
          if (params.extractedText && params.extractedText.length >= 100) {
            console.error(`[분석] 원본 전송 실패(${msg.slice(0, 200)}) → 텍스트 폴백`)
            mode = "text"
            message = await callText(params.extractedText, "text")
          } else {
            throw apiErr
          }
        }
      } else {
        // 3) 텍스트 폴백 (업로드 실패 + 인라인 불가)
        if (!params.extractedText || params.extractedText.length < 100) {
          return { error: "파일이 너무 커서 원본을 전달하지 못했고, 텍스트도 읽어올 수 없어요. 파일을 30MB 이하로 줄여서 다시 올려주세요." }
        }
        mode = "text"
        message = await callText(params.extractedText, "text")
      }
    } finally {
      if (uploadedFileId) {
        // 사용자 문서를 Anthropic 저장소에 남기지 않는다
        client.beta.files.delete(uploadedFileId, { betas: [FILES_API_BETA] }).catch(() => {})
      }
    }
  } else {
    message = await callText(params.content.text, mode)
  }

  if (!message) {
    throw new Error("모델 응답을 받지 못했습니다.")
  }

  if (message.stop_reason === "max_tokens") {
    console.error("[분석] ⚠️ 응답이 max_tokens에 의해 잘렸습니다. JSON 복구를 시도합니다.")
  }
  if (message.stop_reason === "refusal") {
    return { error: "AI가 이 문서의 분석을 거부했어요. 문서 내용을 확인한 뒤 다시 시도해주세요." }
  }

  const usage = summarizeUsage(model, message.usage, Date.now() - startedAt)
  logUsage(`분석-${mode}-${tier}`, usage)

  // ── 파싱 + 정규화 ──
  const responseText = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map(b => b.text)
    .join("")
  const analysis = safeParseJSON(extractJsonBlock(responseText))

  const categories = normalizeCategories(analysis.categories, domain)
  const applicableValues = categories.filter(c => c.applicable && typeof c.value === "number").map(c => c.value as number)
  const fallbackScore = applicableValues.length ? Math.round(applicableValues.reduce((a, b) => a + b, 0) / applicableValues.length) : 60
  const score = typeof analysis.score === "number" && Number.isFinite(analysis.score)
    ? Math.max(0, Math.min(100, Math.round(analysis.score)))
    : fallbackScore
  // 모델이 값을 비운 적용 항목은 종합 점수로 채운다 (드문 경우)
  for (const c of categories) if (c.applicable && c.value === null) c.value = score

  const strengths = toStringArray(analysis.strengths)
  const weaknesses = toStringArray(analysis.weaknesses)
  const readabilityCategories = mode === "pdf" ? toObjectArray(analysis.readabilityCategories) : []
  const layoutRecommendations = mode === "pdf" ? toObjectArray(analysis.layoutRecommendations) : []

  // ── 같은 직군 표본 기준 랭킹 ──
  const ranking = computeRanking(score, reference)

  const result: AnalysisResultData = {
    score,
    domainFit: typeof analysis.domainFit === "string" ? analysis.domainFit : undefined,
    standardsCheck: toStandardsCheck(analysis.standardsCheck),
    nextSteps: toStringArray(analysis.nextSteps).slice(0, 5),
    categories,
    strengths,
    weaknesses,
    companyFeedback: typeof analysis.companyFeedback === "string" ? analysis.companyFeedback : "",
    analysisSource: mode === "url" ? "url" : "pdf",
    readabilityCategories,
    layoutRecommendations,
    ranking,
    designDomain: domain,
    designDomainLabel: DOMAIN_LABELS[domain],
    secondaryDomains: secondary,
    docForm,
    modelTier: tier,
    modelTierLabel: tierInfo.label,
    comparisonPool: { sameDomainCount: reference.sameDomainCount, total: reference.all.length, insufficient: reference.insufficient, cardedCount: reference.cardedCount },
    usage,
  }

  // 분석 이력 저장 + 크레딧 차감 (실패해도 결과는 돌려준다)
  saveAnalysisHistory({
    projectId: params.projectId,
    fileName: params.fileName,
    score,
    categories: categories as unknown as Record<string, unknown>[],
    strengths,
    weaknesses,
    ranking,
    companyFeedback: result.companyFeedback,
    analysisSource: result.analysisSource,
    readabilityCategories,
    layoutRecommendations,
    designDomain: domain,
    modelTier: tier,
    tokenUsage: usage as unknown as Record<string, unknown>,
  }).catch(() => {})

  deductCredit(tierInfo.creditCost).catch(() => {})

  return { data: result }
}

// ───────────────────────────────────────────
// 정규화 헬퍼
// ───────────────────────────────────────────

function normalizeCategories(raw: unknown, domain: DesignDomain): AnalysisCategory[] {
  const rubric = DOMAIN_RUBRIC[domain]
  const list = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []
  return CATEGORY_SUBJECTS.map(subject => {
    const item = list.find(c => c && c.subject === subject)
    const na = rubric[subject] === "na"
    const feedback = item && typeof item.feedback === "string" ? item.feedback : ""
    if (na) {
      return {
        subject,
        value: null,
        fullMark: 100,
        applicable: false,
        feedback: `${DOMAIN_LABELS[domain]} 문서에서는 평가하지 않는 항목이에요.`,
      }
    }
    const v = item && typeof item.value === "number" && Number.isFinite(item.value)
      ? Math.max(0, Math.min(100, Math.round(item.value)))
      : null
    return { subject, value: v, fullMark: 100, applicable: true, feedback }
  })
}

function toStandardsCheck(raw: unknown): StandardsCheckItem[] {
  if (!Array.isArray(raw)) return []
  const statuses = ["있음", "부분", "없음"] as const
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map(x => ({
      element: typeof x.element === "string" ? x.element : "",
      status: (statuses as readonly string[]).includes(x.status as string) ? (x.status as StandardsCheckItem["status"]) : "부분",
      note: typeof x.note === "string" ? x.note : "",
    }))
    .filter(x => x.element)
    .slice(0, 15)
}

function toStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string" && s.trim().length > 0) : []
}

function toObjectArray(raw: unknown): Record<string, unknown>[] {
  return Array.isArray(raw) ? raw.filter((o): o is Record<string, unknown> => !!o && typeof o === "object") : []
}

function computeRanking(score: number, reference: ReferenceSet): AnalysisResultData["ranking"] {
  // 표본이 충분하면 같은 직군만, 아니면 전체 합격작과 비교
  const pool = reference.sameDomainCount >= 5 ? reference.sameDomain : reference.all
  const total = pool.length
  let percentile = 50
  let rank = Math.max(1, Math.round(total / 2))
  if (total > 0) {
    const betterThan = pool.filter(p => (p.overall_score ?? 0) < score).length
    percentile = Math.round((betterThan / total) * 100)
    rank = Math.max(1, Math.min(total, total - Math.round((percentile / 100) * total)))
  }

  const companyComparison = RANKING_COMPANIES.map(company => {
    const matched = Object.entries(reference.companyStats).find(([key]) => key.includes(company) || company.includes(key))
    if (matched && matched[1].count > 0) {
      return { company, avgScore: Math.round(matched[1].total / matched[1].count), userScore: score, sampleCount: matched[1].count }
    }
    return { company, avgScore: reference.avgOverall, userScore: score, sampleCount: 0 }
  })
  companyComparison.push({ company: "전체 합격자", avgScore: reference.avgOverall, userScore: score, sampleCount: total })

  return { total, percentile, rank, companyComparison }
}

function toUserError(error: unknown): string {
  const errMsg = error instanceof Error ? error.message : String(error)
  if (errMsg.includes("credit balance") || errMsg.includes("insufficient_quota") || errMsg.includes("billing")) {
    return "CREDIT_LIMIT_EXCEEDED"
  }
  if (errMsg.includes("timeout") || errMsg.includes("FUNCTION_INVOCATION_TIMEOUT")) {
    return "분석 시간이 길어져 중단됐어요. 파일을 더 작게 만들거나 잠시 후 다시 시도해주세요."
  }
  if (errMsg.includes("Streaming is required")) {
    return "AI 처리가 길어져 일시적으로 차단됐어요. 파일을 더 작게 만들거나 잠시 후 다시 시도해주세요."
  }
  if (isRequestTooLarge(errMsg)) {
    return "문서 내용이 너무 많아요. 불필요한 페이지를 줄이거나 이미지를 압축한 뒤 다시 시도해주세요."
  }
  if (errMsg.includes("Internal server error") || errMsg.includes("api_error") || errMsg.includes("overloaded") || errMsg.includes("529")) {
    return "AI 서버가 잠시 불안정해요. 1~2분 후 다시 시도해주세요."
  }
  if (errMsg.includes("파싱할 수 없습니다")) {
    return "AI 응답을 읽는 데 실패했어요. 다시 시도해주세요."
  }
  console.error("[분석 오류 상세]", errMsg)
  return "분석 중 문제가 생겼어요. 잠시 후 다시 시도해주세요."
}
