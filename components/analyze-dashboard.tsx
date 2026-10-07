/**
 * 분석 대시보드 — 핵심 페이지 컴포넌트 (1387줄)
 *
 * 기능:
 * - 파일 업로드 (드래그&드롭, PDF/DOCX/XLSX/CSV/PPTX, 200MB 제한)
 * - URL 직접 분석 (크롤링 → AI 분석)
 * - 파일 크기별 3단계 처리: <30MB 직접업로드, 30~100MB 압축, 100MB+ 텍스트추출
 * - Claude AI 분석 (15개 카테고리 점수 + 강점/약점 + 랭킹 + 가독성 + 레이아웃)
 * - 프로젝트 선택/생성 → 결과 자동 저장
 * - 멀티파일 탭 전환, 분석 진행률 표시, 로딩 메시지 애니메이션
 *
 * 주요 흐름:
 * 1. 프로젝트 선택 → 파일 업로드/URL 입력
 * 2. 구독 체크 (checkBeforeAnalysis)
 * 3. 파일 크기별 분기 → 서버 업로드 or 클라이언트 압축 or 텍스트 추출
 * 4. AI 분석 (analyzeDocumentDirect / analyzeUrlDirect)
 * 5. 결과 렌더링 (ScoreCard, RadarChart, FeedbackCards, DesignScores 등)
 * 6. saveAnalysisHistory로 DB 저장
 *
 * 의존: analyze actions, pdf-extract, pdf-compress, subscription actions
 */
"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { GlossaryText } from "@/components/glossary-text"
import { useDropzone } from "react-dropzone"
import { UPLOAD_ACCEPT, UPLOAD_MAX_SIZE, hasPendingUpload, takePendingUpload, getDroppedFiles } from "@/lib/pending-upload"
import { notifyCreditsChanged } from "@/components/credit-chip"
import { CompanyFeedback } from "@/components/company-feedback"
import { GradeScale } from "@/components/grade-scale"
import { docKeyLoose, fileBaseName } from "@/lib/analysis/doc-key"
import { VersionDelta } from "@/components/version-delta"
import { AnalysisProgress } from "@/components/analysis-progress"
import { TARGET_COMPANIES } from "@/lib/analysis/companies"
import { LARGE_DOC_NOTICE, PAGES_PER_CREDIT, countPagesFromText, extraCreditsForPages } from "@/lib/analysis/pages"
import { FileText, Loader2, CheckCircle2, Download, AlertCircle, X, Lock, FolderOpen, Plus, ArrowRight, Eye, Zap, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScoreCard } from "@/components/score-card"
import { RadarChartComponent } from "@/components/radar-chart-component"
import { FeedbackCards } from "@/components/feedback-cards"
import { DesignScores } from "@/components/design-scores"
import { ReadabilityScores } from "@/components/readability-scores"
import { LayoutRecommendations } from "@/components/layout-recommendations"
import { StandardsCheck } from "@/components/standards-check"
import { analyzeDocumentDirect, analyzeUrlDirect, deleteFileFromStorage, checkBeforeAnalysis, scanDocument } from "@/app/actions/analyze"
import { MODEL_TIERS, DEFAULT_TIER, type ModelTier } from "@/lib/analysis/model"
import { ALL_DOMAINS, DOMAIN_LABELS, DOC_FORM_LABELS, pickThreeDomains, isDesignDomain, type DesignDomain, type DocForm } from "@/lib/analysis/domains"
import { getProjects, createProject, assignAnalysisToProject, getProjectAnalyses } from "@/app/actions/subscription"
import { createClient } from "@/lib/supabase/client"
import { PAYMENTS_ENABLED } from "@/lib/payments-config"
import { TUTORING_KAKAO_URL } from "@/lib/tutoring-config"
import { extractTextFromPdf } from "@/lib/pdf-extract"
import { extractTextFromOffice, isOfficeFile } from "@/lib/office-extract"
import { compressPdf } from "@/lib/pdf-compress"
import { v4 as uuidv4 } from "uuid"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"

type Project = {
  id: string
  name: string
  analysis_count: number
  best_score: number | null
}

type ReadabilityCategory = {
  subject: string
  value: number
  fullMark: number
  feedback?: string
}

type LayoutSection = {
  label: string
  x: number
  y: number
  w: number
  h: number
  color: string
}

type LayoutRecommendation = {
  pageOrSection: string
  currentDescription: string
  recommendedDescription: string
  currentLayout: { sections: LayoutSection[] }
  recommendedLayout: { sections: LayoutSection[] }
}

/** 지난 분석 설정을 읽을 때 쓰는 이력 행 (ranking JSON에 설정이 들어 있다) */
type SavedSettingsRow = {
  file_name: string
  document_name?: string | null
  design_domain?: string | null
  ranking?: { targetCompany?: string | null; settings?: { domains?: string[]; topics?: string[]; docForm?: string } } | null
}

type AnalysisResult = {
  fileName: string
  /** 지원 회사 (없으면 회사 무관) */
  targetCompany?: string | null
  /** analysis_history id — '저장하기'로 프로젝트에 넣을 때 쓴다 */
  historyId?: string | null
  /** 저장된 프로젝트 (없으면 아직 저장 안 함) */
  projectId?: string | null
  score: number
  categories: {
    subject: string
    /** 직군 기준 '해당 없음' 항목은 null */
    value: number | null
    fullMark: number
    feedback?: string
    applicable?: boolean
  }[]
  strengths: string[]
  weaknesses: string[]
  detailedFeedback?: string
  companyFeedback?: string
  analysisSource?: "pdf" | "url"
  readabilityCategories?: ReadabilityCategory[]
  layoutRecommendations?: LayoutRecommendation[]
  // 2026-10: 직군별 채점 + 모델 티어
  domainFit?: string
  designDomain?: DesignDomain
  designDomainLabel?: string
  modelTier?: ModelTier
  modelTierLabel?: string
  comparisonPool?: { sameDomainCount: number; total: number; insufficient: boolean; cardedCount?: number }
  standardsCheck?: { element: string; status: "있음" | "부분" | "없음"; note: string }[]
  nextSteps?: string[]
  ranking?: {
    total: number
    percentile: number
    rank?: number
    companyComparison?: {
      company: string
      avgScore: number
      userScore: number
      sampleCount?: number
    }[]
  }
}

type FileStatus = {
  file: File
  status: "pending" | "uploading" | "analyzing" | "success" | "error"
  result?: AnalysisResult
  error?: string
}

const MAX_FILES = 1

function getGrade(score: number): { grade: string; color: string } {
  if (score >= 90) return { grade: "S", color: "bg-purple-500" }
  if (score >= 80) return { grade: "A", color: "bg-emerald-500" }
  if (score >= 70) return { grade: "B", color: "bg-blue-500" }
  if (score >= 60) return { grade: "C", color: "bg-amber-500" }
  return { grade: "D", color: "bg-red-500" }
}

export function AnalyzeDashboard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const preselectedProjectId = searchParams.get("projectId")
  // 프로젝트 화면의 문서에서 들어온 경우 그 문서의 새 버전으로 저장
  const preselectedDocument = searchParams.get("doc")

  const [files, setFiles] = useState<FileStatus[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showCreditError, setShowCreditError] = useState(false)
  const [showKeywordEditor, setShowKeywordEditor] = useState(false)
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([])
  const [isExtractingKeywords, setIsExtractingKeywords] = useState(false)
  const [newKeywordInput, setNewKeywordInput] = useState("")
  const [pendingFiles, setPendingFiles] = useState<FileStatus[]>([])
  // 1단계 스캔 결과: 직군 (AI 추정값 + 사용자 확정값) / 문서 형식 / 분석 티어
  const [detectedDomain, setDetectedDomain] = useState<DesignDomain | null>(null)
  // 문서 분야: AI가 3개를 미리 고르고(첫 번째 = 주 직군, 나머지 = 보조 직군) 사용자가 바꾼다
  const [pickedDomains, setPickedDomains] = useState<DesignDomain[]>(["general"])
  const selectedDomain: DesignDomain = pickedDomains[0] ?? "general"
  // 지원 회사 — null이면 회사 무관
  const [targetCompany, setTargetCompany] = useState<string | null>(null)
  // 프로젝트에서 들어온 경우 그 프로젝트의 분석 이력 — 지난 분석 설정을 기본값으로 불러온다
  const [projectHistory, setProjectHistory] = useState<SavedSettingsRow[]>([])
  const [settingsNote, setSettingsNote] = useState("")
  // 같은 문서의 직전 버전 (결과 화면 "이전 버전 대비")
  const [prevVersion, setPrevVersion] = useState<{ score: number; categories: { subject: string; value: number | null }[]; version: number } | null>(null)
  // 사용자가 직접 적은 주제 (AI 키워드와 함께 비교 검색에 쓰인다)
  const [customTopics, setCustomTopics] = useState<string[]>([])
  const [scanDocForm, setScanDocForm] = useState<DocForm>("unknown")
  const [scanConfidence, setScanConfidence] = useState<number>(0)
  const [selectedTier, setSelectedTier] = useState<ModelTier>(DEFAULT_TIER)
  // 1단계에서 업로드된 파일 정보 (2단계에서 재사용)
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    fileUrl: string; filePath: string; mimeType: string; extractedText?: string
  } | null>(null)
  const [statusMessage, setStatusMessage] = useState("")
  const [allowanceInfo, setAllowanceInfo] = useState<{
    allowed: boolean
    reason?: string
    plan?: string
    remaining?: number
    unlimited?: boolean
  } | null>(null)
  const [checkingAllowance, setCheckingAllowance] = useState(true)

  // 프로젝트 관련 상태
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(preselectedProjectId)
  // 분석 뒤 '저장하기' 다이얼로그
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveTarget, setSaveTarget] = useState<string>("new")
  const [saveName, setSaveName] = useState("")
  // 프로젝트 안 문서명 — 같은 문서의 수정본은 같은 이름으로 묶인다 (파일명이 바뀌어도)
  const [saveDocName, setSaveDocName] = useState("")
  const [saveDocOptions, setSaveDocOptions] = useState<string[]>([])
  const [savingProject, setSavingProject] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)
  // 로그인 판별: allowanceInfo가 로드된 후에만 판단 (초기 null 상태에서는 false로 취급)
  const isLoggedIn = allowanceInfo !== null && allowanceInfo.reason !== "login_required" && allowanceInfo.plan !== "none"

  // 분석 중 로딩 메시지 (순서대로 표시)
  const loadingMessages = [
    "문서 내용을 꼼꼼히 살펴보는 중...",
    "논리 구조와 흐름을 분석하는 중...",
    "게임 디자인 역량을 평가하는 중...",
    "넥슨 합격자 포트폴리오와 비교하는 중...",
    "엔씨소프트 합격자 포트폴리오와 비교하는 중...",
    "넷마블 합격자 포트폴리오와 비교하는 중...",
    "크래프톤 합격자 포트폴리오와 비교하는 중...",
    "펄어비스 합격자 포트폴리오와 비교하는 중...",
    "스마일게이트 합격자 포트폴리오와 비교하는 중...",
    "시프트업 합격자 포트폴리오와 비교하는 중...",
    "강점과 보완점을 정리하는 중...",
    "최종 점수를 계산하는 중...",
  ]

  // 시간 기반 진행률 (0~90%까지 천천히, 완료 시 100%)
  const [fakeProgress, setFakeProgress] = useState(0)

  useEffect(() => {
    if (!isAnalyzing) {
      setStatusMessage("")
      setFakeProgress(0)
      return
    }
    // 메시지를 순서대로 표시
    let msgIndex = 0
    setStatusMessage(loadingMessages[0])
    const msgTimer = setInterval(() => {
      msgIndex++
      if (msgIndex < loadingMessages.length) {
        setStatusMessage(loadingMessages[msgIndex])
      }
    }, 5000)

    // 진행률: 0 → 90%까지 60초에 걸쳐 서서히 증가
    setFakeProgress(5)
    const progressTimer = setInterval(() => {
      setFakeProgress(prev => {
        if (prev >= 90) return 90 // 90%에서 멈춤 (완료 전까지)
        // 처음엔 빠르게, 나중엔 느리게
        const increment = prev < 30 ? 3 : prev < 60 ? 2 : 0.5
        return Math.min(prev + increment, 90)
      })
    }, 1000)

    return () => {
      clearInterval(msgTimer)
      clearInterval(progressTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalyzing])

  // 계속 분석하기 — 결과를 닫고 첫 업로드 화면으로 돌아간다 (남은 크레딧도 다시 읽음)
  // 분석 결과 PDF 저장 — 브라우저 인쇄 창에서 "PDF로 저장". 파일 이름은 문서명·점수로
  const exportPdf = () => {
    const r = results[currentIndex]
    const prevTitle = document.title
    if (r) document.title = `문라이트아카이브_${fileBaseName(r.fileName)}_${r.score}점`
    const restore = () => { document.title = prevTitle; window.removeEventListener("afterprint", restore) }
    window.addEventListener("afterprint", restore)
    // 접힌 피드백이 펼쳐질 시간을 준다 (beforeprint에서 펼침)
    setTimeout(() => window.print(), 50)
  }

  // 뒤로가기: 결과 화면이나 분석 설정 창에서 누르면 다른 페이지가 아니라 업로드 화면으로 돌아온다
  const historyStepRef = useRef<"none" | "modal" | "result">("none")
  // 우리가 넣은 기록 칸이 하나 살아 있는지 — 있으면 새로 쌓지 않고 바꿔 쓴다 (뒤로가기 한 번 = 한 단계)
  const historyPushedRef = useRef(false)
  const startOverRef = useRef<() => void>(() => {})
  const cancelModalRef = useRef<() => void>(() => {})
  useEffect(() => {
    const step = results.length > 0 ? "result" : showKeywordEditor ? "modal" : "none"
    if (step !== "none" && historyStepRef.current !== step) {
      if (historyPushedRef.current) window.history.replaceState({ moonlight: step }, "")
      else { window.history.pushState({ moonlight: step }, ""); historyPushedRef.current = true }
    }
    if (step !== "none" || !isAnalyzing) historyStepRef.current = step
  }, [results.length, showKeywordEditor, isAnalyzing])
  useEffect(() => {
    const onPop = () => {
      const step = historyStepRef.current
      historyStepRef.current = "none"
      historyPushedRef.current = false
      if (step === "result") startOverRef.current()
      else if (step === "modal") cancelModalRef.current()
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  const startOver = () => {
    setResults([])
    setFiles([])
    setPendingFiles([])
    setCurrentIndex(0)
    setError(null)
    setUploadedFileInfo(null)
    setExtractedKeywords([])
    setCustomTopics([])
    setDetectedDomain(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
    checkBeforeAnalysis().then(a => {
      setAllowanceInfo(a)
      if (typeof a.remaining === "number") notifyCreditsChanged(a.remaining)
    }).catch(() => {})
  }

  // 페이지 로드 시 구독 상태 + 프로젝트 목록 체크
  useEffect(() => {
    async function init() {
      try {
        const allowanceResult = await checkBeforeAnalysis()

        if (allowanceResult.reason === "login_required") {
          // 비로그인: 페이지는 보여주되 분석 시 로그인 유도
          setAllowanceInfo({ allowed: false, reason: "login_required" })
          setCheckingAllowance(false)
          return
        }

        setAllowanceInfo(allowanceResult)

        // 프로젝트는 분석 뒤 '저장하기'에서 고른다 — 분석 전에는 고르지 않는다.
        // 프로젝트 페이지에서 "이 프로젝트로 새 분석"으로 들어온 경우(?projectId=)에만 바로 그 프로젝트에 저장
        const projectsResult = await getProjects()
        if (projectsResult.data) setProjects(projectsResult.data as Project[])
        if (preselectedProjectId) {
          const hist = await getProjectAnalyses(preselectedProjectId)
          if ("data" in hist && hist.data) setProjectHistory(hist.data as SavedSettingsRow[])
        }
      } catch {
        setAllowanceInfo({ allowed: true })
      } finally {
        setCheckingAllowance(false)
      }
    }
    init()
  }, [preselectedProjectId])

  // 분석 결과 저장 — 기존 프로젝트를 고르거나 새로 만들고, 저장 뒤 프로젝트 화면으로 이동
  // 저장된 분석 설정 — 회사는 프로젝트 단위, 분야·주제는 문서 단위 (분석 모드는 비용 때문에 저장 안 함)
  const applySavedSettings = () => {
    if (!preselectedProjectId || projectHistory.length === 0) { setSettingsNote(""); return }
    const notes: string[] = []
    // 이력은 최신순 — 지원 회사를 기록한 가장 최근 분석
    const withCompany = projectHistory.find(r => r.ranking && "targetCompany" in r.ranking)
    if (withCompany) {
      const c = withCompany.ranking!.targetCompany
      setTargetCompany(typeof c === "string" ? c : null)
      notes.push("지원 회사")
    }
    if (preselectedDocument) {
      const docRow = projectHistory.find(r => (r.document_name?.trim() || fileBaseName(r.file_name)) === preselectedDocument)
      if (docRow) {
        const saved = (docRow.ranking?.settings?.domains ?? []).filter(isDesignDomain)
        const domains = saved.length > 0 ? saved : isDesignDomain(docRow.design_domain) ? [docRow.design_domain] : []
        if (domains.length > 0) {
          setPickedDomains(pickThreeDomains(domains[0], domains.slice(1)))
          notes.push("문서 분야")
        }
        const savedForm = docRow.ranking?.settings?.docForm
        if (savedForm && savedForm in DOC_FORM_LABELS) setScanDocForm(savedForm as DocForm)
        const topics = docRow.ranking?.settings?.topics ?? []
        if (topics.length > 0) { setCustomTopics(topics); notes.push("주제") }
      }
    }
    setSettingsNote(notes.length ? `지난 분석의 ${notes.join("·")} 설정을 불러왔어요` : "")
  }

  // 결과가 프로젝트에 저장돼 있으면 같은 문서의 직전 버전을 찾아 비교한다
  const currentHistoryId = results[currentIndex]?.historyId ?? null
  const currentProjectId = results[currentIndex]?.projectId ?? selectedProjectId ?? null
  const currentFileName = results[currentIndex]?.fileName ?? ""
  useEffect(() => {
    setPrevVersion(null)
    if (!currentProjectId || !currentFileName) return
    let cancelled = false
    getProjectAnalyses(currentProjectId).then(res => {
      if (cancelled || !("data" in res) || !res.data) return
      type Row = { id: string; file_name: string; document_name?: string | null; analyzed_at: string; overall_score: number; categories?: { subject: string; value: number | null }[] }
      const rows = res.data as Row[]
      const key = (r: Row) => r.document_name?.trim() || fileBaseName(r.file_name)
      const me = currentHistoryId ? rows.find(r => r.id === currentHistoryId) : undefined
      // 저장 전이면 들어온 문서명(또는 파일명이 비슷한 기존 문서)으로 찾는다
      const myKey = me ? key(me) : (preselectedDocument || fileBaseName(currentFileName))
      const same = rows
        .filter(r => key(r) === myKey || docKeyLoose(key(r)) === docKeyLoose(myKey) || docKeyLoose(fileBaseName(r.file_name)) === docKeyLoose(myKey))
        .sort((a, b) => a.analyzed_at.localeCompare(b.analyzed_at))
      const idx = me ? same.findIndex(r => r.id === me.id) : same.length
      if (idx > 0) setPrevVersion({ score: same[idx - 1].overall_score, categories: same[idx - 1].categories ?? [], version: idx + 1 })
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHistoryId, currentProjectId, currentFileName])

  const resolveDocName = (fileName: string): string | null => {
    if (preselectedDocument) return preselectedDocument
    const mine = docKeyLoose(fileBaseName(fileName))
    if (!mine) return null
    const match = projectHistory.find(r => docKeyLoose(fileBaseName(r.file_name)) === mine || docKeyLoose(r.document_name || "") === mine)
    return match ? (match.document_name?.trim() || fileBaseName(match.file_name)) : null
  }


  // 저장 대상 프로젝트의 기존 문서명 목록 (같은 문서의 새 버전으로 넣을 수 있게)

  const loadDocOptions = async (projectId: string, fileName?: string) => {
    if (projectId === "new") { setSaveDocOptions([]); return }
    const res = await getProjectAnalyses(projectId)
    const rows = ("data" in res && res.data ? res.data : []) as { document_name?: string | null; file_name: string }[]
    const options = [...new Set(rows.map(r => r.document_name || fileBaseName(r.file_name)).filter(Boolean))]
    setSaveDocOptions(options)
    if (fileName) {
      const mine = docKeyLoose(fileBaseName(fileName))
      const match = rows.find(r => docKeyLoose(fileBaseName(r.file_name)) === mine || docKeyLoose(r.document_name || "") === mine)
      if (match && mine) setSaveDocName(match.document_name || fileBaseName(match.file_name))
    }
  }

  const openSaveDialog = () => {
    const base = preselectedDocument || fileBaseName(results[currentIndex]?.fileName) || "내 포트폴리오"
    setSaveName("내 포트폴리오")
    setSaveDocName(base.slice(0, 60))
    const target = selectedProjectId && projects.some(p => p.id === selectedProjectId)
      ? selectedProjectId
      : projects.length > 0 ? projects[0].id : "new"
    setSaveTarget(target)
    loadDocOptions(target, preselectedDocument ? undefined : results[currentIndex]?.fileName)
    setShowSaveDialog(true)
  }

  const handleSaveToProject = async () => {
    const historyIds = results.map(r => r.historyId).filter((id): id is string => !!id)
    if (historyIds.length === 0) {
      setError("저장할 분석 기록을 찾지 못했어요. 프로젝트 페이지의 '저장 안 한 분석'에서 다시 시도해 주세요.")
      setShowSaveDialog(false)
      return
    }
    setSavingProject(true)
    try {
      let projectId = saveTarget
      if (saveTarget === "new") {
        const created = await createProject(saveName.trim() || "내 포트폴리오")
        if (!created.data) { setError(created.error || "프로젝트를 만들지 못했어요."); return }
        projectId = created.data.id
      }
      for (const id of historyIds) {
        const res = await assignAnalysisToProject(id, projectId, saveDocName.trim() || null)
        if (res.error) { setError(res.error); return }
      }
      setResults(prev => prev.map(r => ({ ...r, projectId })))
      setShowSaveDialog(false)
      router.push(`/projects?project=${projectId}`)
    } catch {
      setError("저장에 실패했어요. 잠시 후 다시 시도해주세요.")
    } finally {
      setSavingProject(false)
    }
  }

  type AnalyzeRunOptions = { tier: ModelTier; domain: DesignDomain; secondaryDomains?: DesignDomain[]; docForm: DocForm }

  // 여러 파일 분석 (2단계: 합격작 비교)
  const handleAnalyzeFiles = async (filesToAnalyze: FileStatus[], _unused?: string, keywords?: string[], runOptions?: AnalyzeRunOptions) => {
    const analyzeOptions = {
      tier: runOptions?.tier ?? selectedTier,
      domain: runOptions?.domain ?? selectedDomain,
      secondaryDomains: runOptions?.secondaryDomains ?? pickedDomains.slice(1),
      docForm: runOptions?.docForm ?? scanDocForm,
      keywords,
      targetCompany,
      customTopics,
    }
    setIsAnalyzing(true)
    setError(null)
    setResults([])
    setCurrentIndex(0)

    const newResults: AnalysisResult[] = []

    for (let i = 0; i < filesToAnalyze.length; i++) {
      const fileStatus = filesToAnalyze[i]
      setCurrentIndex(i)

      try {
        setStatusMessage("파일을 업로드하는 중...")
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: "uploading" } : f
        ))

        // 파일 타입 체크
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
        if (!allowedTypes.includes(fileStatus.file.type)) {
          const ext = fileStatus.file.name.split(".").pop()?.toUpperCase() || "알 수 없음"
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: `지원하지 않는 파일 형식입니다. (.${ext}) PDF, DOCX, PPTX, XLSX, TXT, 이미지만 가능합니다.` } : f
          ))
          continue
        }

        const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB
        if (fileStatus.file.size > MAX_FILE_SIZE) {
          const sizeMB = (fileStatus.file.size / (1024 * 1024)).toFixed(1)
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: `파일 크기(${sizeMB}MB)가 200MB를 초과합니다. 10MB 이하를 권장합니다. 이미지 압축, 불필요한 페이지 제거 등으로 파일을 최적화해 주세요.` } : f
          ))
          continue
        }

        // 빈 파일 체크
        if (fileStatus.file.size === 0) {
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: "파일이 비어있어요. 내용이 있는 파일을 업로드해주세요." } : f
          ))
          continue
        }

        // 대용량 파일 처리
        const LARGE_FILE_THRESHOLD = 30 * 1024 * 1024 // 30MB
        const COMPRESS_LIMIT = 100 * 1024 * 1024 // 100MB (이 이상은 압축 시도하지 않음)
        const isPdf = fileStatus.file.type === "application/pdf"
        const isLargeFile = fileStatus.file.size > LARGE_FILE_THRESHOLD

        // 대용량 비-PDF 파일은 압축 미지원
        if (isLargeFile && !isPdf) {
          const sizeMB = (fileStatus.file.size / (1024 * 1024)).toFixed(1)
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: `파일 크기(${sizeMB}MB)가 분석 가능 크기(30MB)를 초과합니다. PDF로 변환하면 자동 압축 후 분석됩니다.` } : f
          ))
          continue
        }

        // 텍스트 추출 → AI 분석 공통 함수
        const doTextAnalysis = async (): Promise<boolean> => {
          setStatusMessage("텍스트 추출 중...")
          const extractedText = await extractTextFromPdf(fileStatus.file, (current, total) => {
            setStatusMessage(`텍스트 추출 중... (${current}/${total} 페이지)`)
          })
          if (extractedText.length < 100) {
            setFiles(prev => prev.map((f, idx) =>
              idx === i ? { ...f, status: "error", error: "PDF에서 텍스트를 읽어올 수 없어요. 스캔된 이미지로만 만든 문서일 수 있어요. 텍스트가 포함된 PDF로 다시 시도해주세요." } : f
            ))
            return false
          }
          setStatusMessage("AI 분석 중...")
          const textResult = await analyzeUrlDirect({
            // 항상 '저장 안 한 분석'으로 남기고, 결과 화면의 '저장하기'에서 프로젝트·문서를 고른다 (매번)
            projectId: null,
            // 저장은 안 하지만, 같은 문서의 직전 분석을 점수 기준점으로 찾을 때 쓴다
            documentName: selectedProjectId ? resolveDocName(fileStatus.file.name) : null,
            extractedText,
            fileName: fileStatus.file.name,
            ...analyzeOptions,
          })
          if (textResult.error) {
            if (textResult.error === "CREDIT_LIMIT_EXCEEDED") {
              setShowCreditError(true)
              setFiles(prev => prev.map((f, idx) =>
                idx === i ? { ...f, status: "error", error: "서비스 점검 중" } : f
              ))
              return false
            }
            setFiles(prev => prev.map((f, idx) =>
              idx === i ? { ...f, status: "error", error: textResult.error } : f
            ))
          } else {
            const result = { ...textResult.data, fileName: fileStatus.file.name } as AnalysisResult
            newResults.push(result)
            setResults([...newResults])
            setFiles(prev => prev.map((f, idx) =>
              idx === i ? { ...f, status: "success", result } : f
            ))
          }
          return true
        }

        // 분석할 파일 결정 (대용량 PDF 분기 처리)
        let fileToUpload = fileStatus.file

        if (isLargeFile && isPdf) {
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "analyzing" } : f
          ))

          // 100MB 이상: 압축이 너무 느림 → 바로 텍스트 추출
          if (fileStatus.file.size > COMPRESS_LIMIT) {
            const sizeMB = (fileStatus.file.size / (1024 * 1024)).toFixed(0)
            setStatusMessage(`${sizeMB}MB 파일 — 텍스트 기반 분석으로 진행합니다`)
            try {
              await doTextAnalysis()
            } catch {
              setFiles(prev => prev.map((f, idx) =>
                idx === i ? { ...f, status: "error", error: "PDF 처리에 실패했어요. 파일이 손상되었거나 암호가 걸려있는지 확인해주세요." } : f
              ))
            }
            continue
          }

          // 30~100MB: 압축 시도 (타임아웃 3분)
          try {
            const compressPromise = compressPdf(fileStatus.file, (current, total) => {
              setStatusMessage(`PDF 압축 중... (${current}/${total} 페이지)`)
            })
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("COMPRESS_TIMEOUT")), 180000)
            )
            const compressedFile = await Promise.race([compressPromise, timeoutPromise])

            const compressedMB = (compressedFile.size / (1024 * 1024)).toFixed(1)
            const originalMB = (fileStatus.file.size / (1024 * 1024)).toFixed(1)
            console.log(`PDF 압축 완료: ${originalMB}MB → ${compressedMB}MB`)

            // 압축 후에도 30MB 초과하면 텍스트 추출로 폴백
            if (compressedFile.size > LARGE_FILE_THRESHOLD) {
              setStatusMessage("압축 후에도 크기가 큽니다. 텍스트 기반 분석으로 전환...")
              try {
                await doTextAnalysis()
              } catch {
                setFiles(prev => prev.map((f, idx) =>
                  idx === i ? { ...f, status: "error", error: "파일 처리에 실패했어요. 파일을 직접 압축한 뒤 다시 올려주세요." } : f
                ))
              }
              continue
            }

            fileToUpload = compressedFile
            setStatusMessage("압축 완료! 업로드 중...")
          } catch (compressError) {
            const errorMsg = compressError instanceof Error ? compressError.message : ""
            console.error("PDF compression error:", compressError)
            setStatusMessage(errorMsg === "COMPRESS_TIMEOUT"
              ? "압축 시간 초과. 텍스트 기반 분석으로 전환..."
              : "압축 실패. 텍스트 기반 분석으로 전환..."
            )
            try {
              await doTextAnalysis()
            } catch { /* 텍스트 추출도 실패 */ }
            if (files[i]?.status !== "success" && files[i]?.status !== "error") {
              setFiles(prev => prev.map((f, idx) =>
                idx === i ? { ...f, status: "error", error: "PDF 처리에 실패했어요. 파일이 손상되었거나 암호가 걸려있는지 확인해주세요." } : f
              ))
            }
            continue
          }
        }

        // === Supabase 업로드 → 풀 분석 (압축된 파일 또는 원본) ===
        let analysisResult: Awaited<ReturnType<typeof analyzeDocumentDirect>>
        {
          const supabase = createClient()
          const fileExt = fileToUpload.name.split(".").pop()
          const uniqueFileName = `${uuidv4()}.${fileExt}`
          const filePath = `uploads/${uniqueFileName}`

          const { error: uploadError } = await supabase.storage
            .from("resumes")
            .upload(filePath, fileToUpload, {
              contentType: fileToUpload.type,
              upsert: false,
            })

          if (uploadError) {
            console.error("Upload error:", uploadError)
            let errorMsg = "파일 업로드에 실패했어요. 잠시 후 다시 시도해주세요."
            const errMsg = uploadError.message || ""
            if (errMsg.includes("exceeded") || errMsg.includes("too large") || errMsg.includes("413") || errMsg.includes("size")) {
              const fileSizeMB = (fileToUpload.size / (1024 * 1024)).toFixed(1)
              errorMsg = `파일이 너무 커요(${fileSizeMB}MB). 파일을 더 작게 만들어서 다시 올려주세요.`
            } else if (errMsg.includes("not found") || errMsg.includes("bucket")) {
              errorMsg = "저장소에 일시적인 문제가 있어요. 잠시 후 다시 시도해주세요."
            } else if (errMsg.includes("permission") || errMsg.includes("policy") || errMsg.includes("403")) {
              errorMsg = "로그인 세션이 만료됐어요. 다시 로그인해주세요."
            } else if (errMsg.includes("network") || errMsg.includes("fetch") || errMsg.includes("timeout")) {
              errorMsg = "인터넷 연결이 불안정해요. 연결 상태를 확인하고 다시 시도해주세요."
            } else if (errMsg.includes("duplicate") || errMsg.includes("already exists")) {
              errorMsg = "잠시 후 다시 시도해주세요."
            }
            setFiles(prev => prev.map((f, idx) =>
              idx === i ? { ...f, status: "error", error: errorMsg } : f
            ))
            continue
          }

          const { data: urlData } = supabase.storage
            .from("resumes")
            .getPublicUrl(filePath)

          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "analyzing" } : f
          ))

          // 텍스트 확보: 1단계에서 저장된 텍스트 우선 사용, 없으면 재추출
          let extractedTextForSearch: string | undefined = uploadedFileInfo?.extractedText || undefined
          if (!extractedTextForSearch) {
            try {
              setStatusMessage("텍스트 추출 중...")
              if (isPdf) {
                extractedTextForSearch = await extractTextFromPdf(fileStatus.file)
              } else if (isOfficeFile(fileStatus.file.type)) {
                extractedTextForSearch = await extractTextFromOffice(fileStatus.file)
              }
            } catch {
              console.log("텍스트 추출 실패 (무시)")
            }
          }
          if (extractedTextForSearch && extractedTextForSearch.length < 100) {
            extractedTextForSearch = undefined
          }
          setStatusMessage("AI 분석 중...")

          analysisResult = await analyzeDocumentDirect({
            // 항상 '저장 안 한 분석'으로 남기고, 결과 화면의 '저장하기'에서 프로젝트·문서를 고른다 (매번)
            projectId: null,
            // 저장은 안 하지만, 같은 문서의 직전 분석을 점수 기준점으로 찾을 때 쓴다
            documentName: selectedProjectId ? resolveDocName(fileStatus.file.name) : null,
            fileName: fileStatus.file.name,
            fileUrl: urlData.publicUrl,
            mimeType: fileStatus.file.type,
            filePath,
            extractedText: extractedTextForSearch,
            ...analyzeOptions,
          })

          if (analysisResult.error) {
            await deleteFileFromStorage(filePath)
          }
        }

        // === 공통: 분석 결과 처리 ===
        if (analysisResult.error) {
          if (analysisResult.error === "CREDIT_LIMIT_EXCEEDED") {
            setShowCreditError(true)
            setFiles(prev => prev.map((f, idx) =>
              idx === i ? { ...f, status: "error", error: "서비스 점검 중" } : f
            ))
            break
          }
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: analysisResult.error } : f
          ))
        } else {
          const result = {
            ...analysisResult.data,
            fileName: fileStatus.file.name
          } as AnalysisResult

          newResults.push(result)
          setResults([...newResults])

          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "success", result } : f
          ))
        }
      } catch (err) {
        console.error("Analysis error:", err)
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: "error", error: "분석에 실패했어요. 잠시 후 다시 시도해주세요." } : f
        ))
      }

      if (i < filesToAnalyze.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    setStatusMessage("")
    setIsAnalyzing(false)
    // 남은 크레딧 다시 읽어 화면·헤더 칩 갱신
    checkBeforeAnalysis().then(a => {
      setAllowanceInfo(a)
      if (typeof a.remaining === "number") notifyCreditsChanged(a.remaining)
    }).catch(() => {})
    // 결과 영역으로 스크롤
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 200)
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (isAnalyzing) return // 분석 중에는 새 파일 업로드 차단
    if (!isLoggedIn) {
      router.push("/login?redirect=/analyze")
      return
    }
    // 다중 파일 업로드 안내 — MAX_FILES 초과 시 사용자에게 명확히 알림
    if (acceptedFiles.length > MAX_FILES) {
      setError(`한 번에 ${MAX_FILES}개의 파일만 분석할 수 있어요. 첫 번째 파일(${acceptedFiles[0].name})만 진행됩니다. 다른 파일은 분석 후 따로 올려주세요.`)
    }

    if (acceptedFiles.length > 0) {
      const filesToAdd = acceptedFiles.slice(0, MAX_FILES)

      const newFiles: FileStatus[] = filesToAdd.map(file => ({
        file,
        status: "pending" as const
      }))

      setFiles(newFiles)
      setResults([])
      // 다중 파일 안내가 없는 경우에만 에러 초기화
      if (acceptedFiles.length <= MAX_FILES) {
        setError(null)
      }

      // 바로 스캔 → 분석 설정 창 하나에서 크레딧 차감까지 확인한다 (예전엔 차감 확인 창이 따로 떠서 확인을 두 번 했다)
      setPendingFiles(newFiles)
      startKeywordExtraction(newFiles)
    }
  }, [selectedProjectId, isLoggedIn, router, allowanceInfo])


  // 1단계: 키워드 추출 (파일 업로드 + 텍스트 추출 + Claude 키워드 추출)
  const startKeywordExtraction = async (filesToProcess: FileStatus[]) => {
    if (filesToProcess.length === 0) return
    setIsExtractingKeywords(true)
    setStatusMessage("문서를 스캔하는 중...")

    try {
      const fileStatus = filesToProcess[0]
      let extractedText = ""

      // 파일 형식에 따라 텍스트 추출
      if (fileStatus.file.type === "application/pdf") {
        try {
          extractedText = await extractTextFromPdf(fileStatus.file) || ""
        } catch {
          console.log("PDF 텍스트 추출 실패 (무시)")
        }
      } else if (isOfficeFile(fileStatus.file.type)) {
        try {
          setStatusMessage("문서에서 텍스트를 추출하는 중...")
          extractedText = await extractTextFromOffice(fileStatus.file) || ""
        } catch {
          console.log("Office 텍스트 추출 실패 (무시)")
        }
      }

      // 추출된 텍스트를 저장 (2단계에서 재사용 — 대용량 파일 폴백용)
      setUploadedFileInfo({ fileUrl: "", filePath: "", mimeType: fileStatus.file.type, extractedText })

      // 직군·형식·키워드 스캔 (Haiku, 크레딧 차감 없음). 서버에는 앞 8000자만 전송
      const result = await scanDocument({
        extractedText: extractedText.slice(0, 8000),
        fileName: fileStatus.file.name,
      })
      if (result.scan) {
        setDetectedDomain(result.scan.domain)
        setPickedDomains(pickThreeDomains(result.scan.domain, result.scan.secondary))
        setScanDocForm(result.scan.docForm)
        setScanConfidence(result.scan.confidence)
        setExtractedKeywords(
          result.scan.keywords.length > 0 ? result.scan.keywords : extractFallbackKeywords(fileStatus.file.name)
        )
      } else {
        setDetectedDomain(null)
        setPickedDomains(pickThreeDomains("general"))
        setScanDocForm("unknown")
        setScanConfidence(0)
        setExtractedKeywords(extractFallbackKeywords(fileStatus.file.name))
      }
      setSelectedTier(DEFAULT_TIER)
      setCustomTopics([])
      applySavedSettings()

      setShowKeywordEditor(true)
    } catch (err) {
      console.error("문서 스캔 오류:", err)
      setDetectedDomain(null)
      setPickedDomains(pickThreeDomains("general"))
      setScanDocForm("unknown")
      setSelectedTier(DEFAULT_TIER)
      setCustomTopics([])
      applySavedSettings()
      setExtractedKeywords(extractFallbackKeywords(filesToProcess[0]?.file.name || ""))
      setShowKeywordEditor(true)
    } finally {
      setIsExtractingKeywords(false)
      setStatusMessage("")
    }
  }

  // 파일명에서 키워드 폴백 추출
  const extractFallbackKeywords = (fileName: string): string[] => {
    const keywords: string[] = []
    const patterns = [
      "시스템", "레벨", "전투", "캐릭터", "몬스터", "UI", "UX", "역기획",
      "데이터", "테이블", "콘텐츠", "퀘스트", "밸런", "스킬", "제안서", "기획서",
      "강화", "재화", "인벤토리", "보스", "던전", "PvP",
    ]
    const lower = fileName.toLowerCase()
    for (const p of patterns) {
      if (lower.includes(p.toLowerCase())) keywords.push(p)
    }
    return keywords.length > 0 ? keywords : ["게임기획"]
  }

  // 사용자 주제 추가 / 삭제
  const handleAddKeyword = () => {
    const trimmed = newKeywordInput.trim()
    if (trimmed && !customTopics.includes(trimmed)) {
      setCustomTopics(prev => [...prev, trimmed].slice(0, 10))
      if (/포스트 ?모템|post ?-?mortem|회고/i.test(trimmed)) setScanDocForm("postmortem")
    }
    setNewKeywordInput("")
  }

  const handleRemoveKeyword = (keyword: string) => {
    setCustomTopics(prev => prev.filter(k => k !== keyword))
  }

  // 분야 칩: 선택된 칩을 누르면 빠지고(최소 1개 유지), 새 칩은 3개까지 추가 · 이미 3개면 마지막 것과 교체
  const toggleDomain = (d: DesignDomain) => {
    setPickedDomains(prev => {
      if (prev.includes(d)) return prev.length > 1 ? prev.filter(x => x !== d) : prev
      return prev.length < 3 ? [...prev, d] : [...prev.slice(0, 2), d]
    })
  }

  // 2단계: 합격작 비교 시작 (확정된 직군·티어·키워드로)
  const handleStartComparison = () => {
    setShowKeywordEditor(false)
    const filesToAnalyze = [...pendingFiles]
    const runOptions: AnalyzeRunOptions = { tier: selectedTier, domain: selectedDomain, secondaryDomains: pickedDomains.slice(1), docForm: scanDocForm }
    // 사용자가 적은 주제를 앞에 두고 AI 키워드를 뒤에 (중복 제거)
    const keywords = [...new Set([...customTopics, ...extractedKeywords])]
    setPendingFiles([])
    setTimeout(() => {
      handleAnalyzeFiles(filesToAnalyze, undefined, keywords, runOptions)
    }, 100)
  }

  // 분석 설정 취소
  const handleKeywordCancel = () => {
    setShowKeywordEditor(false)
    setExtractedKeywords([])
    setCustomTopics([])
    setDetectedDomain(null)
    setPickedDomains(pickThreeDomains("general"))
    setScanDocForm("unknown")
    setSelectedTier(DEFAULT_TIER)
    setUploadedFileInfo(null)
    setPendingFiles([])
    setFiles([])
  }
  cancelModalRef.current = handleKeywordCancel
  startOverRef.current = () => startOver()

  // 크레딧 사용자가 정밀 분석(2크레딧)을 고를 수 있는지
  const remainingCredits = allowanceInfo?.remaining ?? 0
  const isUnlimitedUser = !!allowanceInfo?.unlimited
  // 40쪽마다 1크레딧 추가 (서버가 PDF 원본으로 다시 판정한다)
  const docPages = countPagesFromText(uploadedFileInfo?.extractedText)
  const pageExtra = extraCreditsForPages(docPages)
  const tierCost = (tier: ModelTier) => MODEL_TIERS[tier].creditCost + pageExtra
  const canAffordTier = (tier: ModelTier) => isUnlimitedUser || remainingCredits >= tierCost(tier)
  const selectedTierCost = tierCost(selectedTier)


  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  // dropzone 거부 파일 안내 (형식 미지원 / 크기 초과 / 개수 초과)
  const onDropRejected = useCallback((rejections: { file: File; errors: { code: string; message: string }[] }[]) => {
    if (rejections.length === 0) return
    const first = rejections[0]
    const errorCode = first.errors[0]?.code

    if (errorCode === "too-many-files") {
      setError(`한 번에 ${MAX_FILES}개의 파일만 분석할 수 있어요. 한 파일을 먼저 분석한 후 다른 파일을 올려주세요.`)
    } else if (errorCode === "file-too-large") {
      const sizeMB = (first.file.size / (1024 * 1024)).toFixed(1)
      setError(`파일이 너무 커요(${sizeMB}MB). 최대 200MB, 권장 10MB 이하예요. 이미지를 압축하거나 페이지를 줄여서 다시 올려주세요.`)
    } else if (errorCode === "file-invalid-type") {
      const ext = first.file.name.split(".").pop()?.toUpperCase() || "알 수 없음"
      setError(`이 파일 형식(.${ext})은 지원하지 않아요. PDF, DOCX, PPTX, XLSX, TXT만 분석할 수 있어요.`)
    } else {
      setError(`'${first.file.name}' 파일을 업로드할 수 없어요. 형식과 크기를 확인하고 다시 시도해주세요.`)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: UPLOAD_ACCEPT,
    getFilesFromEvent: getDroppedFiles,
    maxFiles: MAX_FILES,
    maxSize: UPLOAD_MAX_SIZE,
  })

  // 홈 업로드 창에서 넘어온 파일 — 로그인·프로젝트 확인이 끝나면 바로 분석 흐름으로 넣는다
  useEffect(() => {
    if (checkingAllowance || isAnalyzing || !hasPendingUpload()) return
    const handed = takePendingUpload()
    if (handed) onDrop(handed)
  }, [checkingAllowance, isAnalyzing, isLoggedIn, onDrop])

  return (
    <div className="pt-24 pb-16 px-6 bg-background min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* 대표 문구 — 홈과 같은 첫 화면 (결과가 없을 때) */}
        {results.length === 0 && (
          <div className="text-center mb-8">
            <h1 className="sr-only">게임 기획 문서 분석</h1>
            <p className="text-xl sm:text-2xl md:text-3xl text-foreground leading-snug font-medium">
              <span className="font-extrabold text-primary">187개의 합격 포트폴리오</span>를 기준으로,
              <br className="hidden sm:block" /> 당신의 기획 문서가 실제로 통하는지 진단합니다.
            </p>
          </div>
        )}

        {/* 로딩 중 */}
        {checkingAllowance && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {/* 크레딧 소진 안내 (로그인은 됐지만 남은 크레딧 없음) */}
        {!checkingAllowance && allowanceInfo && !allowanceInfo.allowed && allowanceInfo.reason !== "login_required" && results.length === 0 && (
          <Card className="mb-8 bg-card border-border">
            <CardContent className="pt-8 pb-8 text-center">
              <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-black text-foreground mb-2">남은 크레딧이 없어요</h2>
              <p className="text-muted-foreground mb-6">
                크레딧을 충전하면 바로 이어서 분석할 수 있어요.<br />
                기본 분석 1크레딧 · 정밀 분석 2크레딧
              </p>
              <div className="flex justify-center gap-3">
                <Button asChild className="bg-primary hover:bg-primary/90 text-white">
                  <Link href="/payment/credits">크레딧 충전</Link>
                </Button>
                <Button asChild variant="outline" className="border-border text-foreground hover:bg-secondary bg-transparent">
                  <Link href="/pricing">요금제 보기</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 업로드 — 로그인 직후 가장 먼저 보이는 분석 창. 비로그인도 보여주고 올리면 로그인 유도 */}
        {!checkingAllowance && (allowanceInfo?.allowed || allowanceInfo?.reason === "login_required") && results.length === 0 && (
          <div className="mb-8 max-w-5xl mx-auto">
            {isAnalyzing ? (
              /* 분석 진행 중 — 업로드 창 자리에 진행 화면 */
              <div className="w-full min-h-[360px] sm:min-h-0 sm:aspect-[16/9] lg:aspect-[2.35/1] rounded-[2rem] border-2 border-primary/40 bg-accent/30 flex flex-col items-center justify-center gap-5 px-6 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
                {files.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border border-border">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground truncate max-w-[250px]">{files[0].file.name}</span>
                    <span className="text-xs text-muted-foreground">{(files[0].file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-foreground text-lg">
                    {statusMessage || "AI가 문서를 직접 읽고 분석 중..."}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">보통 1~2분 정도 걸려요</p>
                </div>
                <Progress value={fakeProgress} className="h-2 w-full max-w-sm" />
              </div>
            ) : (
              /* 평소 — 홈과 같은 큰 업로드 창 */
              <div
                {...getRootProps()}
                className={`group w-full min-h-[360px] sm:min-h-0 sm:aspect-[16/9] lg:aspect-[2.35/1] rounded-[2rem] border-2 border-dashed
                  flex flex-col items-center justify-center gap-6 px-6 text-center transition-all ${
                  isDragActive
                    ? "border-primary bg-accent/60 shadow-[0_24px_70px_-20px_rgba(0,70,173,0.45)] cursor-pointer"
                    : "border-primary/25 bg-card shadow-[0_12px_50px_-24px_rgba(0,70,173,0.35)] hover:border-primary/60 hover:bg-accent/25 cursor-pointer"
                }`}
              >
                <input {...getInputProps()} aria-label="분석할 문서 올리기" />
                <span className={`flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full transition-all ${
                  isDragActive ? "bg-primary text-white scale-110" : "bg-accent text-primary group-hover:bg-primary group-hover:text-white"
                }`}>
                  <Plus className="w-8 h-8 md:w-10 md:h-10" strokeWidth={2.25} />
                </span>
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-lg md:text-xl font-extrabold text-primary">
                    {isDragActive ? "놓으면 바로 분석을 시작합니다" : "여기에 문서를 드래그해 주세요"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {!isLoggedIn ? "파일을 올리면 로그인 후 바로 분석이 시작됩니다" : "또는 클릭해서 파일 선택"}
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-1">PDF · DOCX · PPTX · XLSX · TXT · 권장 10MB 이하 (최대 200MB)</p>
                </div>
              </div>
            )}

            {isAnalyzing && <AnalysisProgress progress={fakeProgress} targetCompany={targetCompany} />}

            {/* 남은 크레딧 (+ 프로젝트 화면에서 들어온 경우 저장될 프로젝트) — 한 줄 */}
            {isLoggedIn && allowanceInfo?.allowed && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 min-w-0">
                  {selectedProjectId && projects.find(p => p.id === selectedProjectId) && (
                    <>
                      <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate">
                        <span className="text-foreground font-medium">{projects.find(p => p.id === selectedProjectId)!.name}</span>
                        {preselectedDocument ? <> · <span className="text-foreground font-medium">{preselectedDocument}</span></> : null} 기준으로 이전 버전과 비교해요
                      </span>
                    </>
                  )}
                </span>
                {!allowanceInfo.unlimited && allowanceInfo.remaining !== undefined && (
                  <span>
                    남은 크레딧 <span className="font-bold text-foreground">{allowanceInfo.remaining}</span>
                    <span className="mx-1.5 text-border">|</span>
                    <Link href="/payment/credits" className="text-primary hover:underline">충전</Link>
                  </span>
                )}
              </div>
            )}

            {/* 선택된 파일 목록 (에러/완료 상태) */}
            {files.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-sm text-muted-foreground mb-3">선택된 파일</p>
                {files.map((fileStatus, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      fileStatus.status === "success" ? "bg-emerald-500/10 border border-emerald-500/30" :
                      fileStatus.status === "error" ? "bg-red-500/10 border border-red-500/30" :
                      "bg-secondary border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {fileStatus.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : fileStatus.status === "error" ? (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm text-foreground truncate max-w-[200px] sm:max-w-[300px]">{fileStatus.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                          {fileStatus.result && ` · ${fileStatus.result.score}점`}
                          {fileStatus.error && ` · ${fileStatus.error}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-600">{error}</p>
              </div>
            )}

            <p className="mt-4 text-xs text-muted-foreground/80 text-center">
              업로드 시 <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">개인정보 처리방침</Link>에 동의한 것으로 봅니다 · 자료는 분석 후 서버에서 삭제되고 결과는 본인만 볼 수 있습니다
            </p>

            {/* 파일 크기 사용팁 — 항상 표시 (분석 중에도 유지) */}
            <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                더 정확한 분석을 받고 싶나요?
              </p>
              <p className="text-[11px] text-muted-foreground mb-3">
                파일 크기에 따라 분석 방식이 달라집니다. 작을수록 이미지·레이아웃까지 꼼꼼하게 봐요.
              </p>
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-primary/10 border border-primary/20 rounded-lg">
                  <span className="text-primary text-xs font-bold whitespace-nowrap mt-0.5">10MB 이하</span>
                  <span className="text-[11px] text-foreground/80 leading-relaxed">이미지·레이아웃까지 분석하는 <span className="text-primary font-semibold">최고 품질</span> — 가장 정확한 결과를 받을 수 있어요</span>
                </div>
                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-primary/5 border border-primary/10 rounded-lg">
                  <span className="text-primary/80 text-xs font-bold whitespace-nowrap mt-0.5">10~100MB</span>
                  <span className="text-[11px] text-foreground/80 leading-relaxed">텍스트를 추출해서 분석해요 — 이미지·레이아웃 평가는 추정으로 작성돼요</span>
                </div>
                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-secondary border border-border rounded-lg">
                  <span className="text-muted-foreground text-xs font-bold whitespace-nowrap mt-0.5">100MB 이상</span>
                  <span className="text-[11px] text-foreground/80 leading-relaxed">텍스트만 추출해서 분석해요 — 이미지·레이아웃 평가는 빠져요</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                💡 이미지 해상도를 낮추거나 불필요한 페이지를 지우면 대부분 10MB 이하로 줄일 수 있어요.
              </p>
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {results.length > 0 && (
          <div ref={resultsRef} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 인쇄용 머리글 (PDF에만 보인다) */}
            <div className="hidden print:block border-b border-border pb-3 mb-2">
              <p className="text-xs text-muted-foreground">문라이트 아카이브 · 게임 기획 문서 분석 결과</p>
              <p className="text-lg font-black text-foreground">{results[currentIndex]?.fileName}</p>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3" data-print-hide>
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">
                  {results.length === 1 ? "분석 완료" : `${results.length}개 문서 분석 완료`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {results[currentIndex]?.projectId ? (
                  <Button
                    variant="outline"
                    asChild
                    className="border-primary/30 text-primary hover:bg-primary/10 bg-transparent"
                  >
                    <Link href={`/projects?project=${results[currentIndex].projectId}`}>
                      <FolderOpen className="w-3.5 h-3.5 mr-1" /> 프로젝트 보기
                    </Link>
                  </Button>
                ) : isLoggedIn && (
                  <Button onClick={openSaveDialog} className="bg-primary hover:bg-primary/90 text-white">
                    <FolderOpen className="w-3.5 h-3.5 mr-1" /> 저장하기
                  </Button>
                )}
                <Button variant="outline" onClick={exportPdf} className="border-border text-foreground/80 hover:bg-secondary bg-transparent">
                  <Download className="w-3.5 h-3.5 mr-1" /> PDF로 저장
                </Button>
                <Button
                  variant="outline"
                  onClick={startOver}
                  className="border-border text-foreground/80 hover:bg-secondary bg-transparent"
                >
                  분석하기
                </Button>
              </div>
            </div>

            {results.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {results.map((r, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                      currentIndex === idx
                        ? "bg-primary text-white"
                        : "bg-secondary text-foreground/80 hover:bg-muted"
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold text-foreground ${getGrade(r.score).color}`}>
                      {getGrade(r.score).grade}
                    </span>
                    <span className="truncate max-w-[150px] inline-block align-middle">{r.fileName}</span>
                    <span className="text-xs opacity-70">{r.score}점</span>
                  </button>
                ))}
              </div>
            )}

            {results[currentIndex] && (
              <>
                {results.length > 1 && (
                  <p className="text-muted-foreground text-sm">
                    현재 보기: <span className="text-foreground">{results[currentIndex].fileName}</span>
                  </p>
                )}

                {/* 직군·분석 모드·비교군 안내 */}
                {(results[currentIndex].designDomainLabel || results[currentIndex].modelTierLabel) && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {results[currentIndex].designDomainLabel && (
                      <span className="px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary">
                        {results[currentIndex].designDomainLabel} 문서 기준 채점
                      </span>
                    )}
                    {results[currentIndex].targetCompany && (
                      <span className="px-2.5 py-1 rounded-full bg-primary text-white font-semibold">
                        {results[currentIndex].targetCompany} 지원 기준
                      </span>
                    )}
                    {results[currentIndex].modelTierLabel && (
                      <span className="px-2.5 py-1 rounded-full bg-secondary border border-border text-foreground/80">
                        {results[currentIndex].modelTierLabel}
                      </span>
                    )}
                    {results[currentIndex].comparisonPool && (
                      <span className={`px-2.5 py-1 rounded-full border ${results[currentIndex].comparisonPool!.insufficient ? "bg-amber-500/10 border-amber-500/30 text-amber-700" : "bg-secondary border-border text-muted-foreground"}`}>
                        {results[currentIndex].comparisonPool!.insufficient
                          ? `같은 직군 합격 표본 ${results[currentIndex].comparisonPool!.sameDomainCount}건 — 전체 합격작 기준으로 보완 비교`
                          : `같은 직군 합격작 ${results[currentIndex].comparisonPool!.sameDomainCount}건과 비교`}
                      </span>
                    )}
                    {results[currentIndex].domainFit && (
                      <p className="w-full text-muted-foreground mt-1"><GlossaryText text={results[currentIndex].domainFit!} /></p>
                    )}
                  </div>
                )}

                {prevVersion && (
                  <VersionDelta
                    prevScore={prevVersion.score}
                    prevCategories={prevVersion.categories}
                    score={results[currentIndex].score}
                    categories={results[currentIndex].categories}
                    versionNumber={prevVersion.version}
                  />
                )}

                <div className="grid lg:grid-cols-2 print:grid-cols-2 gap-8 print:gap-4">
                  <ScoreCard score={results[currentIndex].score} ranking={results[currentIndex].ranking} />
                  <RadarChartComponent data={results[currentIndex].categories} />
                </div>

                {/* 합격 문서 기준 위치 + 회사별 분석 (합격 문서끼리 줄 세우지 않는다) */}
                {(() => {
                  const userScore = results[currentIndex].score
                  return (
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground text-lg">합격 문서 기준 위치</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-8">
                        <GradeScale score={userScore} />
                      </div>

                      {/* 회사별 분석 — 지원 회사를 골랐으면 그 회사가 맨 앞 */}
                      {results[currentIndex].companyFeedback && (
                        <CompanyFeedback feedback={results[currentIndex].companyFeedback!} targetCompany={results[currentIndex].targetCompany} />
                      )}
                    </CardContent>
                  </Card>
                  )
                })()}

                <FeedbackCards
                  strengths={results[currentIndex].strengths}
                  weaknesses={results[currentIndex].weaknesses}
                />

                {/* 같은 직군 합격 문서 공통 요소 대조 + 다음에 할 일 */}
                <StandardsCheck
                  items={results[currentIndex].standardsCheck ?? []}
                  nextSteps={results[currentIndex].nextSteps}
                  domainLabel={results[currentIndex].designDomainLabel}
                />

                {/* 게임 디자인 역량 점수 (직군 기준 해당 없음 항목은 제외 표시) */}
                <DesignScores data={results[currentIndex].categories} domainLabel={results[currentIndex].designDomainLabel} />

                {/* 문서 가독성 (PDF만) */}
                {results[currentIndex].analysisSource === "pdf" && results[currentIndex].readabilityCategories && results[currentIndex].readabilityCategories!.length > 0 ? (
                  <>
                    <ReadabilityScores data={results[currentIndex].readabilityCategories!} />
                    {results[currentIndex].layoutRecommendations && results[currentIndex].layoutRecommendations!.length > 0 && (
                      <LayoutRecommendations data={results[currentIndex].layoutRecommendations!} />
                    )}
                  </>
                ) : results[currentIndex].analysisSource === "url" ? (
                  <Card className="bg-card border-border">
                    <CardContent className="p-6 text-center">
                      <Eye className="w-8 h-8 text-muted-foreground/80 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">PDF 파일을 업로드하면 문서의 시각적 가독성 분석과 레이아웃 개선 제안을 받을 수 있습니다</p>
                    </CardContent>
                  </Card>
                ) : null}

                {/* 하단 CTA 영역 */}
                <div className="space-y-4" data-print-hide>
                  {/* 저장 + 다음 행동 — 분석은 일단 '저장 안 한 분석'으로 남고, 여기서 프로젝트에 넣는다 */}
                  {isLoggedIn && (
                    <Card className="bg-card border-border">
                      <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        {results[currentIndex]?.projectId ? (
                          <div className="text-center sm:text-left">
                            <p className="text-foreground font-semibold mb-1">
                              <span className="text-primary">{projects.find(p => p.id === results[currentIndex].projectId)?.name ?? "프로젝트"}</span>에 저장됐어요
                            </p>
                            <p className="text-sm text-muted-foreground">수정본을 다시 분석하면 같은 프로젝트에서 점수 변화를 비교할 수 있어요.</p>
                          </div>
                        ) : (
                          <div className="text-center sm:text-left">
                            <p className="text-foreground font-semibold mb-1">분석 결과를 저장할까요?</p>
                            <p className="text-sm text-muted-foreground">프로젝트에 저장해 두면 수정본을 다시 분석했을 때 점수 변화를 비교할 수 있어요.</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 shrink-0">
                          {results[currentIndex]?.projectId ? (
                            <Button asChild className="bg-primary hover:bg-primary/90 text-white">
                              <Link href={`/projects?project=${results[currentIndex].projectId}`}>
                                <FolderOpen className="w-4 h-4 mr-1" /> 프로젝트 보기
                              </Link>
                            </Button>
                          ) : (
                            <Button onClick={openSaveDialog} className="bg-primary hover:bg-primary/90 text-white">
                              <FolderOpen className="w-4 h-4 mr-1" /> 저장하기
                            </Button>
                          )}
                          <Button onClick={startOver} variant="outline" className="border-border text-foreground hover:bg-secondary bg-transparent">
                            분석하기
                            <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 과외 상담 퍼널 (무료 사용자) — 점수를 확인한 직후가 상담 최적 타이밍 */}
                  {(!allowanceInfo?.plan || allowanceInfo.plan === "free") && (
                    <Card className="bg-accent/50 border-primary/20">
                      <CardContent className="p-6">
                        <p className="text-foreground font-semibold mb-1">점수보다 중요한 건, 다음 스텝입니다</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          187개 합격 포트폴리오를 만든 11년차 현업 기획자가 1:1 과외로 합격까지 함께합니다.
                          방금 받은 분석 결과를 들고 오시면 상담이 더 정확해져요.
                        </p>
                        <div className="flex items-center gap-3">
                          <a
                            href={TUTORING_KAKAO_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-ink hover:bg-black/85 text-white font-semibold rounded-lg transition-colors text-sm"
                          >
                            1:1 과외 상담 (무료)
                            <ArrowRight className="w-4 h-4" />
                          </a>
                          <Button asChild variant="outline" className="border-border text-foreground/80 hover:bg-secondary bg-transparent">
                            <Link href="/payment/credits">크레딧 구매</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 프로젝트에 저장 다이얼로그 */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => !savingProject && setShowSaveDialog(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-foreground mb-1">
              {projects.length === 0 ? "프로젝트를 만드세요" : "어느 프로젝트에 저장할까요?"}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              지원하는 회사나 포트폴리오 단위로 만들면 좋아요. 같은 문서의 수정본을 모아 점수 변화를 볼 수 있어요.
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto mb-5">
              {projects.map(project => (
                <label
                  key={project.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    saveTarget === project.id ? "border-primary bg-accent/50" : "border-border hover:border-primary/40"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <input type="radio" name="save-target" checked={saveTarget === project.id} onChange={() => { setSaveTarget(project.id); loadDocOptions(project.id, results[currentIndex]?.fileName) }} className="accent-[#0046AD]" />
                    <span className="text-sm text-foreground font-medium truncate">{project.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{project.analysis_count}개 분석</span>
                </label>
              ))}

              <label
                className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
                  saveTarget === "new" ? "border-primary bg-accent/50" : "border-dashed border-border hover:border-primary/40"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input type="radio" name="save-target" checked={saveTarget === "new"} onChange={() => { setSaveTarget("new"); setSaveDocOptions([]) }} className="accent-[#0046AD]" />
                  <span className="text-sm text-foreground font-medium">새 프로젝트</span>
                </span>
                {saveTarget === "new" && (
                  <input
                    type="text"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing && saveName.trim()) handleSaveToProject() }}
                    placeholder="프로젝트 이름 (예: 넥슨 지원용 포트폴리오)"
                    maxLength={40}
                    autoFocus
                    className="mt-2 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:border-primary"
                  />
                )}
              </label>
            </div>

            {/* 문서명 — 파일명이 바뀌어도 같은 문서의 수정본끼리 묶는다 */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-foreground mb-1.5">문서명</p>
              {saveDocOptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {saveDocOptions.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSaveDocName(name)}
                      className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                        saveDocName === name ? "bg-primary border-primary text-white" : "border-border text-foreground/80 hover:border-primary/50"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={saveDocName}
                onChange={e => setSaveDocName(e.target.value)}
                maxLength={60}
                placeholder="예: 레벨 디자인 기획서"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:border-primary"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {saveDocOptions.length > 0 ? "같은 문서의 수정본이면 위에서 기존 문서를 고르세요. 파일명이 달라도 한 문서로 묶여요." : "같은 문서의 수정본을 나중에 이 이름으로 묶어 점수 변화를 볼 수 있어요."}
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)} disabled={savingProject} className="flex-1 border-border text-muted-foreground">
                취소
              </Button>
              <Button
                onClick={handleSaveToProject}
                disabled={savingProject || (saveTarget === "new" && !saveName.trim())}
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
              >
                {savingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : saveTarget === "new" ? "만들고 저장" : "저장하기"}
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* 1단계: 키워드 추출 로딩 */}
      {isExtractingKeywords && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-2">1단계: 문서 스캔</h3>
            <p className="text-muted-foreground text-sm">문서의 직군과 키워드를 파악하는 중...</p>
          </div>
        </div>
      )}

      {/* 2단계 전: 키워드 편집 모달 */}
      {showKeywordEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg mx-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* 헤더 */}
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">분석 설정을 확인해주세요</h3>
              <p className="text-sm text-muted-foreground">
                직군에 맞는 채점표와 같은 직군 합격작으로 비교합니다
              </p>
            </div>

            {/* 파일 정보 */}
            {pendingFiles.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-secondary rounded-lg border border-border">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-foreground truncate">{pendingFiles[0].file.name}</span>
              </div>
            )}

            {settingsNote && (
              <p className="mb-4 text-xs text-primary bg-accent/60 rounded-lg px-3 py-2">{settingsNote}. 바꾸면 다음 분석부터 바뀐 값이 기본이 돼요.</p>
            )}

            {/* 문서 분야 — AI가 3개를 미리 고르고, 사용자가 바꾸거나 주제를 직접 적는다 */}
            <div className="mb-5">
              <p className="text-xs text-muted-foreground mb-2">
                문서 분야
                <span className="ml-2 text-primary">
                  {detectedDomain ? "AI가 3개를 골랐어요" : "분야를 골라주세요"}
                </span>
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {ALL_DOMAINS.map((d) => {
                  const order = pickedDomains.indexOf(d)
                  const picked = order >= 0
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDomain(d)}
                      className={`px-2 py-1.5 rounded-lg text-xs border transition-colors ${
                        order === 0
                          ? "bg-primary border-primary text-white font-semibold"
                          : picked
                            ? "bg-primary/10 border-primary text-primary font-medium"
                            : "bg-secondary border-border text-foreground/80 hover:border-primary/50"
                      }`}
                    >
                      {order === 0 && (
                        <span className="mr-1 rounded bg-white/25 px-1 py-px text-[10px] font-bold">주</span>
                      )}
                      {DOMAIN_LABELS[d]}
                    </button>
                  )
                })}
              </div>

              {/* 문서 형식 — 포스트모템·역기획 등 형식에 따라 평가 기준이 달라진다 */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-1">문서 형식</span>
                {(["original", "reverse", "proposal", "postmortem", "analysis", "table", "pr"] as DocForm[]).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setScanDocForm(f)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      scanDocForm === f ? "bg-primary border-primary text-white font-semibold" : "bg-secondary border-border text-foreground/80 hover:border-primary/50"
                    }`}
                  >
                    {DOC_FORM_LABELS[f]}
                  </button>
                ))}
              </div>

              {/* 직접 적은 주제 */}
              {customTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {customTopics.map((kw) => (
                    <span key={kw} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-accent border border-primary/25 text-accent-foreground rounded-full text-xs">
                      {kw}
                      <button type="button" onClick={() => handleRemoveKeyword(kw)} className="hover:text-red-600 transition-colors" aria-label={`${kw} 삭제`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddKeyword() } }}
                  placeholder="다루는 주제를 직접 적어도 돼요 (예: 보스 패턴, 가챠 확률) — Enter"
                  className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  disabled={!newKeywordInput.trim()}
                  className="px-3 py-2 bg-primary/15 text-primary rounded-lg text-sm hover:bg-primary/25 disabled:opacity-30 transition-colors"
                  aria-label="주제 추가"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                <span className="font-semibold text-foreground/80">주</span> 표시 분야의 채점표로 평가하고, 나머지는 보조로 참고해요. 눌러서 빼거나 바꿀 수 있어요.
              </p>
            </div>

            {/* 지원 회사 — 고르면 결과의 회사별 분석이 그 회사 중심으로 */}
            <div className="mb-5">
              <p className="text-xs text-muted-foreground mb-2">지원 회사</p>
              <div className="flex flex-wrap gap-1.5">
                {[null, ...TARGET_COMPANIES].map((c) => (
                  <button
                    key={c ?? "none"}
                    type="button"
                    onClick={() => setTargetCompany(c)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                      targetCompany === c
                        ? "bg-primary border-primary text-white font-semibold"
                        : "bg-secondary border-border text-foreground/80 hover:border-primary/50"
                    }`}
                  >
                    {c ?? "회사 무관"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                {targetCompany ? `결과에서 ${targetCompany} 기준 분석을 맨 앞에 보여드려요.` : "회사를 고르면 그 회사 기준 분석을 맨 앞에 보여드려요."}
              </p>
            </div>

            {/* 분석 모드 */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">분석 모드</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(MODEL_TIERS) as ModelTier[]).map((tier) => {
                  const info = MODEL_TIERS[tier]
                  const affordable = canAffordTier(tier)
                  const active = selectedTier === tier
                  return (
                    <button
                      key={tier}
                      type="button"
                      disabled={!affordable}
                      onClick={() => setSelectedTier(tier)}
                      className={`text-left p-3 rounded-xl border transition-colors ${
                        active
                          ? "bg-primary/15 border-primary text-foreground"
                          : "bg-secondary border-border text-foreground/80 hover:border-primary/50"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">{info.label}</span>
                        <span className={`text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
                          {isUnlimitedUser ? "무제한" : `${tierCost(tier)}크레딧`}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">{info.description}</p>
                      {!affordable && (
                        <p className="text-[11px] text-amber-600 mt-1">크레딧 {tierCost(tier)}개 필요</p>
                      )}
                    </button>
                  )
                })}
              </div>
              {pageExtra > 0 && !isUnlimitedUser && (
                <p className="text-[11px] text-primary mt-2">
                  이 문서는 {docPages}쪽이라 {PAGES_PER_CREDIT}쪽마다 {pageExtra > 1 ? `1크레딧, 총 ${pageExtra}크레딧이` : "1크레딧이"} 더해졌어요.
                </p>
              )}
            </div>

            {/* 크레딧 — 이 창 하나에서 차감까지 확인한다 */}
            {!isUnlimitedUser && (
              <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  보유 <span className="font-bold text-foreground">{remainingCredits}</span> → 분석 후{" "}
                  <span className={`font-bold ${canAffordTier(selectedTier) ? "text-primary" : "text-red-600"}`}>
                    {Math.max(remainingCredits - selectedTierCost, 0)}
                  </span>
                  크레딧
                </span>
                {!canAffordTier(selectedTier) ? (
                  <Link href="/payment/credits" className="shrink-0 text-xs font-semibold text-primary hover:underline">충전하기</Link>
                ) : remainingCredits - selectedTierCost === 0 ? (
                  <span className="shrink-0 text-xs text-muted-foreground">이번이 마지막 크레딧이에요</span>
                ) : null}
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={handleKeywordCancel}
                className="flex-1 py-3 border border-border text-foreground/80 rounded-xl font-medium hover:bg-secondary transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleStartComparison}
                disabled={!canAffordTier(selectedTier)}
                className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                {MODEL_TIERS[selectedTier].label} 시작{isUnlimitedUser ? "" : ` (${selectedTierCost}크레딧)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 크레딧 한도 초과 팝업 */}
      {showCreditError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl">
            <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">서비스 일시 점검 중</h3>
            <p className="text-muted-foreground text-sm mb-6">
              현재 AI 분석 서비스가 일시적으로 중단되었습니다.<br />
              관리자에게 문의해 주세요.
            </p>
            <button
              onClick={() => setShowCreditError(false)}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
