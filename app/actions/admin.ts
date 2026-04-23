/**
 * 관리자 학습 데이터 관리 서버 액션
 *
 * 합격자 포트폴리오를 업로드/분석/저장하여 사용자 분석 시 비교 기준으로 활용.
 *
 * 핵심 기능:
 * - uploadAdminFile(): Supabase Storage에 파일 업로드 (500MB 제한)
 * - analyzeAndSavePortfolio(): Gemini 2.0 Flash AI 분석 → portfolios 테이블 저장
 *   - Excel/CSV: 텍스트 변환 후 분석 + content_text 저장
 *   - 15MB 미만: inline_data (base64)
 *   - 15MB 이상: Gemini File API 업로드 → 폴링 → 분석 → 파일 삭제
 * - embedExistingPortfolios(): 기존 포트폴리오 일괄 벡터 임베딩 (벡터 서치용)
 * - getPortfolioStats/getCompanyStats: 통계 조회
 * - deletePortfolio/deleteMultiplePortfolios: 삭제
 * - reclassifyAllCompanies: 파일명 기준 회사명 일괄 재분류
 *
 * 프롬프트:
 * - portfolioPrompt: PDF/이미지용 (문서 구조, 강점 패턴, 수치/데이터 분석)
 * - dataTablePrompt: Excel/CSV용 (어트리뷰트 설계, 밸런스, 확장성 분석)
 *
 * 벡터 서치:
 * - 포트폴리오 저장 후 자동으로 텍스트 청킹 + OpenAI 임베딩 생성
 * - 스프레드시트: parseExcelToText() 결과를 content_text로 저장
 * - PDF: pdf-parse로 텍스트 추출 → content_text 저장 → 전문 임베딩
 * - 이미지: 메타데이터(요약+강점+약점) 기반 임베딩
 * - rebuildAllPortfolioChunks(): 전체 포트폴리오 청크 재구성 + 재임베딩
 *
 * 보안: 모든 함수에서 관리자 이메일 이중 확인 (미들웨어 + 서버 액션)
 *
 * 환경변수: GOOGLE_GENERATIVE_AI_API_KEY, ADMIN_EMAILS, OPENAI_API_KEY
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import Anthropic from "@anthropic-ai/sdk"
import { v4 as uuidv4 } from "uuid"
import { extractCompanyFromFileName } from "@/lib/company-parser"
import { parseExcelToText, parseCsvToText, isSpreadsheetFile } from "@/lib/excel-parser"
import { embedAndStorePortfolio, embedAllPortfolios, chunkText } from "@/lib/vector-search"
import { generateEmbedding, generateEmbeddings } from "@/lib/openai-embedding"
import { validateFileSignature } from "@/lib/file-validation"
import pdfParse from "pdf-parse"

interface PortfolioInput {
  fileName: string
  fileUrl: string      // Supabase Storage public URL
  mimeType: string
  filePath: string     // Storage 경로 (분석 후 삭제용)
  companies: string[]
  year: number
  documentType: string
}

// 보안: 관리자 인증 확인 헬퍼 (모든 관리자 함수에서 사용)
async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("로그인이 필요합니다.")
  }
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
  if (!adminEmails.includes(user.email?.toLowerCase() || "")) {
    throw new Error("관리자 권한이 필요합니다.")
  }
  return { supabase, user }
}

// 관리자용: Supabase Storage에 파일 업로드
export async function uploadAdminFile(formData: FormData) {
  try {
    const supabase = await createClient()

    // 관리자 인증 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: "로그인이 필요합니다." }
    }
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
    if (!adminEmails.includes(user.email?.toLowerCase() || "")) {
      return { error: "관리자 권한이 필요합니다." }
    }

    const file = formData.get("file") as File
    if (!file) {
      return { error: "파일이 없습니다." }
    }

    // 파일 크기 제한 (500MB)
    const maxSize = 500 * 1024 * 1024
    if (file.size > maxSize) {
      return { error: `파일 크기는 ${Math.round(maxSize / 1024 / 1024)}MB를 초과할 수 없습니다. (현재: ${Math.round(file.size / 1024 / 1024)}MB)` }
    }

    // 매직 바이트 검증 — 관리자 업로드에도 파일 위변조 방지 적용
    const sigResult = await validateFileSignature(file)
    if (!sigResult.valid) {
      console.warn("[uploadAdminFile] 파일 시그니처 검증 실패:", { name: file.name, type: file.type, reason: sigResult.reason })
      return { error: sigResult.reason || "파일 형식이 올바르지 않습니다. 허용된 파일만 업로드해 주세요." }
    }

    const fileExt = file.name.split(".").pop()
    const uniqueFileName = `${uuidv4()}.${fileExt}`
    const filePath = `admin/${uniqueFileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

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

    const { data: urlData } = supabase.storage
      .from("resumes")
      .getPublicUrl(filePath)

    // 파일명에서 회사명 자동 추출
    const extractedCompanies = extractCompanyFromFileName(file.name)
    
    console.log('📁 파일명:', file.name)
    console.log('🏢 추출된 회사:', extractedCompanies)

    return {
      data: {
        fileName: file.name,
        filePath: filePath,
        fileUrl: urlData.publicUrl,
        mimeType: file.type,
        size: file.size,
        extractedCompanies: extractedCompanies, // 자동 추출된 회사명
      }
    }
  } catch (error) {
    console.error("Upload error:", error)
    return { error: "파일 업로드 중 오류가 발생했습니다." }
  }
}

// 포트폴리오 분석 및 저장 (inline_data 사용 - 파일시스템 불필요)
export async function analyzeAndSavePortfolio(input: PortfolioInput) {
  try {
    // 보안: 관리자 인증 확인
    await verifyAdmin()

    // 파일명에서 회사명 직접 추출 (폴백)
    if (input.companies.length === 0) {
      const fileName = input.fileName.normalize('NFC')
      const detectedCompanies: string[] = []
      
      // 정규식으로 매칭
      if (/넷마블/u.test(fileName)) detectedCompanies.push('넷마블')
      if (/넥슨/u.test(fileName)) detectedCompanies.push('넥슨')
      if (/네오위즈/u.test(fileName)) detectedCompanies.push('네오위즈')
      if (/엔씨소프트/u.test(fileName)) detectedCompanies.push('엔씨소프트')
      else if (/엔씨/u.test(fileName)) detectedCompanies.push('엔씨소프트')
      if (/스마일게이트/u.test(fileName)) detectedCompanies.push('스마일게이트')
      if (/크래프톤/u.test(fileName)) detectedCompanies.push('크래프톤')
      if (/펄어비스/u.test(fileName)) detectedCompanies.push('펄어비스')
      if (/라이온하트/u.test(fileName)) detectedCompanies.push('라이온하트')
      if (/매드엔진/u.test(fileName)) detectedCompanies.push('매드엔진')
      if (/웹젠/u.test(fileName)) detectedCompanies.push('웹젠')
      if (/컴투스/u.test(fileName)) detectedCompanies.push('컴투스')
      if (/위메이드/u.test(fileName)) detectedCompanies.push('위메이드')
      if (/카카오/u.test(fileName)) detectedCompanies.push('카카오게임즈')
      if (/데브시스터즈/u.test(fileName)) detectedCompanies.push('데브시스터즈')
      if (/시프트업/u.test(fileName)) detectedCompanies.push('시프트업')
      
      if (detectedCompanies.length > 0) {
        input.companies = detectedCompanies
      }
    }
    
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY가 설정되지 않았습니다.")
    }

    const supabase = await createClient()

    const isSpreadsheet = isSpreadsheetFile(input.mimeType, input.fileName)

    const portfolioPrompt = `당신은 11년 경력의 게임 기획 포트폴리오 전문가이자 채용 담당자입니다.
이 문서는 **실제로 게임 회사에 합격한 포트폴리오**입니다.
학습 데이터로 활용되므로, 이 문서의 **성공 요인을 면밀히 분석**해주세요.

## 🎯 분석 목표
이 문서를 한 장 한 장 **꼼꼼히 읽고** 다음을 파악하세요:
1. **문서 구조**: 어떤 흐름으로 구성되었나? (목차, 섹션 구성)
2. **강점 패턴**: 무엇이 이 문서를 돋보이게 만들었나?
3. **수치/데이터**: 얼마나 구체적인가? 어떤 데이터를 사용했나?
4. **시각 자료**: 다이어그램, 표, 차트는 어떻게 활용했나?
5. **기술 이해도**: 게임 개발 용어, 기술 스택 언급 정도
6. **차별화**: 다른 일반적 포트폴리오와 차별화되는 요소는?

## 점수 기준 (합격 문서이므로 80점 이상 권장)
- 95-100점: 레벨디자인/시스템 기획서 (상세 스펙, 플로우차트, 수치 테이블 풍부)
- 88-94점: 게임 제안서/컨셉 문서 (방향성 명확, 시장분석, 설득력)
- 80-87점: 밸런싱/테이블 설계서 (수식, 데이터 구조)
- 75-79점: 자기PR/소개 문서
- 70점 이하: 개선 필요 (합격 문서이므로 드물어야 함)

## 평가 항목 (각 0-100점)
1. **논리력 (logic_score)**: 문제 정의 → 가설 → 해결 → 결과의 논리 흐름
2. **구체성 (specificity_score)**: 수치, 데이터, KPI, 구체적 사례 (예: "30% 증가", "DAU 5000")
3. **가독성 (readability_score)**: 문서 구조, 시각적 정리, 다이어그램/표 활용
4. **기술이해 (technical_score)**: 게임 개발 기술, 용어, 파이프라인 이해도
5. **창의성 (creativity_score)**: 독창적 아이디어, 차별화 요소

## 추출할 정보 (매우 구체적으로)
- **핵심 키워드/태그**: 문서에 등장한 주요 개념 (최대 12개)
- **문서 요약**: 이 문서가 무엇을 다루는지 명확히 (250자 이내)
- **강점 4가지**: "왜 이 문서가 합격했는가?"에 대한 구체적 분석
  예: "플로우차트 5개로 시스템 흐름 명확히 시각화"
       "KPI 수치를 3개 섹션에 걸쳐 구체적으로 제시"
- **개선 가능 점 3가지**: 완벽한 문서는 없으므로, 더 좋아질 수 있는 부분
  예: "결론 섹션에 A/B 테스트 결과 추가 가능"

## 응답 형식 (반드시 JSON만 출력, 다른 텍스트 없이)
{
  "scores": {
    "logic_score": 92,
    "specificity_score": 90,
    "readability_score": 93,
    "technical_score": 88,
    "creativity_score": 91
  },
  "overall_score": 91,
  "tags": ["시스템기획", "밸런스", "레벨디자인", "KPI", "플로우차트"],
  "summary": "신규 RPG 게임의 전투 시스템 기획서. 스킬 밸런싱 수치 설계와 플로우차트로 시스템 흐름을 명확히 제시. KPI 목표치(DAU 5000, 매출 30% 증가) 명시.",
  "strengths": [
    "플로우차트 5개로 전투 시스템 흐름을 단계별로 시각화",
    "스킬 밸런싱 수치 테이블에 DPS, 쿨타임, 마나 소모량 등 구체적 수치 제시",
    "경쟁작 3개 분석하여 차별화 요소 명확히 정리",
    "A/B 테스트 결과 데이터(전투 만족도 85%)를 근거로 제시"
  ],
  "weaknesses": [
    "결론 섹션에서 향후 확장성(추가 스킬, 밸런스 패치) 언급 부족",
    "UI/UX 목업이 없어 실제 구현 이미지 상상 어려움",
    "개발 일정 및 리소스 계획 부재"
  ]
}

**중요**: 이 문서를 읽고, 성공 요인을 구체적으로 분석하세요. 나중에 다른 포트폴리오 평가 시 이 패턴을 참고할 것입니다.`

    const dataTablePrompt = `당신은 11년 경력의 게임 기획자이자 데이터테이블 설계 전문가입니다.
이 엑셀/CSV 파일은 **실제로 게임 회사에 합격한 포트폴리오의 데이터테이블**입니다.
학습 데이터로 활용되므로, 이 테이블의 **설계 의도와 성공 요인을 면밀히 분석**해주세요.

## 🎯 분석 관점 (값 자체보다 설계 의도 중심)
1. **어트리뷰트 설계**: 각 컬럼(어트리뷰트)이 게임플레이에 어떤 의도를 갖는지
2. **인스턴스 구성**: 행(인스턴스)들의 분포, 등급 체계, 성장 곡선이 적절한지
3. **밸런스 설계**: 수치 간의 관계, 트레이드오프, 보상/비용 균형
4. **게임플레이 의도**: 이 데이터가 플레이어에게 어떤 경험을 유도하는지
5. **확장성**: 콘텐츠 추가 시 테이블 구조가 유연하게 대응할 수 있는지
6. **수식/참조 관계**: 어트리뷰트 간의 계산식, 의존 관계

## 점수 기준 (합격 데이터이므로 80점 이상 권장)
- 95-100점: 체계적 밸런스 수식, 성장곡선 설계, 확장성 뛰어남
- 88-94점: 명확한 설계 의도, 트레이드오프 잘 잡힘
- 80-87점: 기본 구조 탄탄, 일부 확장성 아쉬움
- 70-79점: 구조는 있으나 밸런스 근거 부족

## 평가 항목 (각 0-100점)
1. **논리력 (logic_score)**: 어트리뷰트 간 관계의 논리성, 계산 근거
2. **구체성 (specificity_score)**: 수치의 세밀함, 등급/레벨별 차이, 구체적 수식
3. **가독성 (readability_score)**: 테이블 구조, 컬럼 네이밍, 시트 분리
4. **기술이해 (technical_score)**: 게임 시스템 이해도, 적절한 파라미터 설계
5. **창의성 (creativity_score)**: 독창적 밸런스 설계, 차별화된 구조

## 응답 형식 (반드시 JSON만 출력, 다른 텍스트 없이)
{
  "scores": {
    "logic_score": 90,
    "specificity_score": 92,
    "readability_score": 88,
    "technical_score": 91,
    "creativity_score": 85
  },
  "overall_score": 89,
  "tags": ["밸런스테이블", "스킬데이터", "성장곡선", "트레이드오프"],
  "summary": "RPG 스킬 밸런스 테이블. 100개 이상의 스킬 인스턴스를 DPS/쿨타임/마나 축으로 설계. 등급별 성장곡선과 트레이드오프 관계가 명확.",
  "strengths": [
    "DPS = (공격력 * 배율) / 쿨타임 수식으로 밸런스 근거 명확",
    "5등급 체계에서 등급 간 약 1.3배 성장률로 일관된 곡선",
    "시트별 분리(스킬/아이템/몬스터)로 참조 관계 파악 용이",
    "확장성: 새 등급/속성 추가 시 기존 구조 변경 불필요"
  ],
  "weaknesses": [
    "최종 밸런스 검증용 시뮬레이션 결과 시트 부재",
    "일부 수치의 산출 근거(왜 1.3배인지) 주석 미비",
    "엔드콘텐츠 레벨 구간 데이터 부족"
  ]
}

**중요**: 값 자체에 몰두하지 말고, 각 어트리뷰트의 게임플레이 의도와 밸런스 철학, 확장성 있는 설계를 중심으로 분석하세요.`

    const prompt = isSpreadsheet ? dataTablePrompt : portfolioPrompt

    // 파일 다운로드
    const response = await fetch(input.fileUrl, {
      signal: AbortSignal.timeout(180000) // 3분 타임아웃
    })
    if (!response.ok) {
      throw new Error("파일을 다운로드할 수 없습니다.")
    }
    const fileBuffer = Buffer.from(await response.arrayBuffer())
    const fileSizeMB = fileBuffer.length / (1024 * 1024)

    console.log(`📏 파일 크기: ${fileSizeMB.toFixed(2)}MB`)

    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      })

      let result
      // 스프레드시트에서 추출한 텍스트 (벡터 임베딩용 — content_text로 DB에 저장)
      let extractedContentText: string | null = null

      // 엑셀/CSV 파일: 텍스트로 변환해서 분석
      if (isSpreadsheet) {
        console.log('📊 엑셀/CSV 파일 - 텍스트 변환 후 분석')
        const ext = input.fileName.split(".").pop()?.toLowerCase()
        let tableText: string

        if (ext === "csv") {
          tableText = parseCsvToText(fileBuffer, input.fileName)
        } else {
          tableText = parseExcelToText(fileBuffer, input.fileName)
        }

        console.log(`📊 변환된 텍스트 길이: ${tableText.length}자`)
        // 스프레드시트 텍스트를 content_text로 보존 (벡터 서치용)
        extractedContentText = tableText

        result = await model.generateContent([
          { text: prompt + "\n\n--- 아래는 데이터테이블 내용입니다 ---\n\n" + tableText },
        ])

      } else if (fileSizeMB > 15) {
        // 큰 파일: Gemini File API로 업로드 후 참조
        console.log('📤 큰 파일 - Gemini File API 사용')

        // 1. Gemini File API에 업로드 (REST 직접 호출)
        const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'X-Goog-Upload-Command': 'upload, finalize',
            'X-Goog-Upload-Header-Content-Length': String(fileBuffer.length),
            'X-Goog-Upload-Header-Content-Type': input.mimeType,
            'Content-Type': input.mimeType,
          },
          body: fileBuffer,
          signal: AbortSignal.timeout(300000) // 5분 타임아웃
        })

        if (!uploadResponse.ok) {
          const errText = await uploadResponse.text()
          console.error('Gemini File API upload error:', errText)
          throw new Error(`Gemini 파일 업로드 실패: ${uploadResponse.status}`)
        }

        const uploadResult = await uploadResponse.json()
        const fileUri = uploadResult.file?.uri

        if (!fileUri) {
          throw new Error('Gemini 파일 업로드 후 URI를 받지 못했습니다.')
        }

        console.log('✅ Gemini File URI:', fileUri)

        // 파일 처리 대기 (ACTIVE 상태가 될 때까지)
        let fileState = uploadResult.file?.state
        const fileName = uploadResult.file?.name
        let retries = 0
        while (fileState === 'PROCESSING' && retries < 30) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          const statusResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
          )
          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            fileState = statusData.state
            console.log(`⏳ 파일 상태: ${fileState} (${retries + 1}/30)`)
          }
          retries++
        }

        if (fileState !== 'ACTIVE') {
          throw new Error(`Gemini 파일 처리 실패 (상태: ${fileState})`)
        }

        // 2. fileData 참조로 generateContent 호출
        result = await model.generateContent([
          { text: prompt },
          {
            fileData: {
              mimeType: input.mimeType,
              fileUri: fileUri,
            },
          },
        ])

        // 3. Gemini에서 파일 삭제 (정리)
        await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`,
          { method: 'DELETE' }
        ).catch(() => {})

      } else {
        // 작은 파일: 기존 inline_data 방식
        console.log('📎 작은 파일 - inline_data 사용')
        const base64Data = fileBuffer.toString("base64")

        result = await model.generateContent([
          { text: prompt },
          {
            inlineData: {
              mimeType: input.mimeType,
              data: base64Data,
            },
          },
        ])
      }

      // PDF 파일: pdf-parse로 텍스트 추출 → content_text에 저장 (벡터 서치용)
      if (!isSpreadsheet && input.mimeType === 'application/pdf') {
        try {
          const pdfData = await pdfParse(fileBuffer)
          if (pdfData.text && pdfData.text.trim().length > 50) {
            extractedContentText = pdfData.text.trim()
            console.log(`📄 PDF 텍스트 추출 성공: ${extractedContentText.length}자`)
          } else {
            console.log('📄 PDF 텍스트 추출 결과 너무 짧음 — 메타데이터 폴백')
          }
        } catch (pdfErr) {
          console.error('📄 PDF 텍스트 추출 실패 (무시):', pdfErr)
        }
      }

      const responseText = result.response.text()

      // JSON 추출
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

      // 점수를 정수로 변환 (소수점 반올림)
      const convertToInt = (value: any): number => {
        if (typeof value === 'string') {
          return Math.round(parseFloat(value))
        }
        if (typeof value === 'number') {
          return Math.round(value)
        }
        return 0
      }

      // DB에 저장 (content_text 포함 — 벡터 서치용)
      const { data: savedPortfolio, error: dbError } = await supabase
        .from("portfolios")
        .insert({
          file_name: input.fileName,
          file_url: input.fileUrl,
          companies: input.companies,
          year: input.year,
          document_type: input.documentType,
          overall_score: convertToInt(analysis.overall_score),
          logic_score: convertToInt(analysis.scores?.logic_score),
          specificity_score: convertToInt(analysis.scores?.specificity_score),
          readability_score: convertToInt(analysis.scores?.readability_score),
          technical_score: convertToInt(analysis.scores?.technical_score),
          creativity_score: convertToInt(analysis.scores?.creativity_score),
          tags: analysis.tags,
          summary: analysis.summary,
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          // 스프레드시트는 추출된 텍스트 저장, 그 외는 null (향후 개선)
          content_text: extractedContentText,
        })
        .select()
        .single()

      if (dbError) {
        throw new Error(`DB 저장 실패: ${dbError.message}`)
      }

      // [벡터 서치] 저장된 포트폴리오에 대해 임베딩 생성 (비동기, 실패해도 분석 성공)
      if (savedPortfolio?.id) {
        // 임베딩용 텍스트: content_text 있으면 사용, 없으면 구조화된 메타데이터
        const embeddingText = extractedContentText ||
          buildRichPortfolioText({
            file_name: input.fileName,
            companies: input.companies,
            document_type: input.documentType,
            overall_score: convertToInt(analysis.overall_score),
            logic_score: convertToInt(analysis.scores?.logic_score),
            specificity_score: convertToInt(analysis.scores?.specificity_score),
            readability_score: convertToInt(analysis.scores?.readability_score),
            technical_score: convertToInt(analysis.scores?.technical_score),
            creativity_score: convertToInt(analysis.scores?.creativity_score),
            summary: analysis.summary,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            tags: analysis.tags,
          })

        embedAndStorePortfolio(savedPortfolio.id, embeddingText, {
          companies: input.companies,
          documentType: input.documentType,
          fileName: input.fileName,
        }).catch(err => {
          // 임베딩 실패해도 포트폴리오 저장은 성공 처리
          console.error("[admin] 임베딩 생성 실패 (무시):", err)
        })
      }

      return {
        success: true,
        score: analysis.overall_score,
        analysisData: analysis
      }

    } finally {
      // Supabase Storage에서 파일 삭제 (학습 데이터는 보관하지 않음)
      await supabase.storage.from("resumes").remove([input.filePath]).catch(() => {})
    }

  } catch (error) {
    console.error("Portfolio analysis error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "분석 중 오류가 발생했습니다."
    }
  }
}

// 포트폴리오 통계 조회
export async function getPortfolioStats() {
  try {
    // 보안: 관리자 인증 확인
    const { supabase } = await verifyAdmin()

    const { data: companyData, error } = await supabase
      .from("portfolios")
      .select("companies")

    if (error) throw error

    const companyCount: Record<string, number> = {}
    companyData?.forEach(row => {
      row.companies?.forEach((company: string) => {
        companyCount[company] = (companyCount[company] || 0) + 1
      })
    })

    const sortedCompanies = Object.entries(companyCount)
      .sort((a, b) => b[1] - a[1])
      .map(([company]) => company)

    return {
      success: true,
      data: {
        total: companyData?.length || 0,
        companies: sortedCompanies
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "통계 조회 실패"
    }
  }
}

// 회사별 평균 점수 조회
export async function getCompanyAverages(company: string) {
  try {
    // 보안: 관리자 인증 확인
    const { supabase } = await verifyAdmin()

    const { data: portfolioData, error } = await supabase
      .from("portfolios")
      .select("*")
      .contains("companies", [company])

    if (error) throw error

    if (!portfolioData || portfolioData.length === 0) {
      return { success: true, data: null }
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

    return {
      success: true,
      data: {
        count: portfolioData.length,
        overall_avg: Math.round(avg(portfolioData.map(d => d.overall_score))),
        logic_avg: Math.round(avg(portfolioData.map(d => d.logic_score))),
        specificity_avg: Math.round(avg(portfolioData.map(d => d.specificity_score))),
        readability_avg: Math.round(avg(portfolioData.map(d => d.readability_score))),
        technical_avg: Math.round(avg(portfolioData.map(d => d.technical_score))),
        creativity_avg: Math.round(avg(portfolioData.map(d => d.creativity_score)))
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "조회 실패"
    }
  }
}

// 전체 포트폴리오 데이터 조회
export async function getAllPortfoliosForComparison() {
  try {
    // 보안: 관리자 인증 확인
    const { supabase } = await verifyAdmin()

    const { data: portfolioData, error } = await supabase
      .from("portfolios")
      .select("*")
      .order("overall_score", { ascending: false })

    if (error) throw error

    return { success: true, data: portfolioData }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "조회 실패"
    }
  }
}

// 학습된 포트폴리오 목록 조회
export async function getPortfolioList() {
  try {
    // 보안: 관리자 인증 확인
    const { supabase } = await verifyAdmin()

    const { data: portfolioList, error } = await supabase
      .from("portfolios")
      .select("id, file_name, companies, year, document_type, overall_score, logic_score, specificity_score, readability_score, tags, file_url, created_at")
      .order("created_at", { ascending: false })

    if (error) throw error

    return { success: true, data: portfolioList }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "목록 조회 실패"
    }
  }
}

// 포트폴리오 삭제
export async function deletePortfolio(id: string) {
  try {
    // 보안: 관리자 인증 확인
    const { supabase } = await verifyAdmin()

    const { error } = await supabase
      .from("portfolios")
      .delete()
      .eq("id", id)

    if (error) throw error

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "삭제 실패"
    }
  }
}

// 포트폴리오 일괄 삭제
export async function deleteMultiplePortfolios(ids: string[]) {
  try {
    // 보안: 관리자 인증 확인
    const { supabase } = await verifyAdmin()

    const { error } = await supabase
      .from("portfolios")
      .delete()
      .in("id", ids)

    if (error) throw error

    return { success: true, count: ids.length }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "일괄 삭제 실패"
    }
  }
}

// 회사별 학습 데이터 통계 (실제 데이터에서 동적으로 추출)
export async function getCompanyStats() {
  try {
    // 보안: 관리자 인증 확인
    const { supabase } = await verifyAdmin()

    // 전체 포트폴리오 가져오기
    const { data: portfolios, error } = await supabase
      .from("portfolios")
      .select("companies")

    if (error) {
      console.error("Company stats error:", error)
      return { error: error.message }
    }

    // 회사별 카운트 — 실제 데이터에서 동적 추출
    const stats: Record<string, number> = {}

    portfolios?.forEach(portfolio => {
      if (portfolio.companies && Array.isArray(portfolio.companies) && portfolio.companies.length > 0) {
        portfolio.companies.forEach((company: string) => {
          if (company && company.trim()) {
            stats[company] = (stats[company] || 0) + 1
          }
        })
      }
    })

    // 전체 합격자 = 전체 포트폴리오 수
    stats["전체 합격자"] = portfolios?.length || 0

    return { data: stats, total: portfolios?.length || 0 }
  } catch (error) {
    console.error("Get company stats error:", error)
    return { error: error instanceof Error ? error.message : "회사별 통계 조회 실패" }
  }
}

// 전체 포트폴리오 회사 재분류 (파일명 기준 — 모든 회사 대상)
export async function reclassifyAllCompanies() {
  try {
    // 보안: 관리자 인증 확인
    const { supabase } = await verifyAdmin()

    const { data: portfolios, error } = await supabase
      .from("portfolios")
      .select("id, file_name, companies")

    if (error) throw error
    if (!portfolios || portfolios.length === 0) return { success: true, updated: 0 }

    let updated = 0
    const changes: { fileName: string; before: string[]; after: string[] }[] = []

    for (const p of portfolios) {
      const extracted = extractCompanyFromFileName(p.file_name)
      const currentCompanies = (p.companies as string[]) || []

      // 달라졌으면 업데이트
      const isDifferent =
        extracted.length !== currentCompanies.length ||
        extracted.some(c => !currentCompanies.includes(c))

      if (isDifferent) {
        const { error: updateError } = await supabase
          .from("portfolios")
          .update({ companies: extracted.length > 0 ? extracted : [] })
          .eq("id", p.id)

        if (!updateError) {
          updated++
          changes.push({
            fileName: p.file_name,
            before: currentCompanies,
            after: extracted,
          })
        }
      }
    }

    return { success: true, total: portfolios.length, updated, changes: changes.slice(0, 50) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "재분류 실패" }
  }
}

// ========== 벡터 서치 (임베딩) ==========

/**
 * 기존 포트폴리오 일괄 벡터 임베딩
 *
 * content_text가 있으면 실제 텍스트로, 없으면 메타데이터(요약+강점+약점) 기반.
 * 이미 임베딩된 포트폴리오는 건너뜀 (force=true로 재처리 가능).
 *
 * 호출 방법: 관리자 페이지에서 버튼 클릭 또는 직접 호출
 * 소요 시간: 포트폴리오 1개당 ~2초 (OpenAI API 호출 + DB 저장)
 */
/**
 * 초경량 검색 데이터 생성 (1개씩, Vercel 10초 타임아웃 대응)
 *
 * 기존 embedAllPortfolios를 쓰지 않고 직접 최소 쿼리로 처리.
 * 네트워크 호출 최소화: Supabase 3회(병렬) + OpenAI 1회 + DB저장 1회 = 총 ~4초
 *
 * 프론트에서 반복 호출하여 전체 완료.
 */
// ★ 임베딩 상태 진단 함수 — 진짜 임베딩 vs 스킵 마커 확인
export async function debugEmbeddingStatus() {
  try {
    const { supabase } = await verifyAdmin()

    // 전체 포트폴리오 수
    const { count: totalPortfolios } = await supabase.from("portfolios").select("id", { count: "exact", head: true })

    // 진짜 임베딩 (chunk_index >= 0)
    const { data: realChunks } = await supabase.from("portfolio_chunks").select("portfolio_id, chunk_index").gte("chunk_index", 0)
    const realIds = [...new Set((realChunks || []).map(c => c.portfolio_id))]

    // 스킵 마커 (chunk_index = -1)
    const { data: skipMarkers } = await supabase.from("portfolio_chunks").select("portfolio_id, chunk_text").eq("chunk_index", -1)

    // 스킵된 포트폴리오 5개의 실제 데이터 확인
    const skipIds = (skipMarkers || []).map(m => m.portfolio_id).slice(0, 5)
    let sampleData: string[] = []
    if (skipIds.length > 0) {
      const { data: samples } = await supabase
        .from("portfolios")
        .select("id, file_name, content_text, summary, strengths, weaknesses, tags")
        .in("id", skipIds)
        .limit(5)
      sampleData = (samples || []).map(p => {
        const ct = (p.content_text || "").length
        const sm = (p.summary || "").length
        const st = p.strengths?.length || 0
        const tg = p.tags?.length || 0
        return `${p.file_name}: content_text=${ct}자, summary=${sm}자, strengths=${st}개, tags=${tg}개`
      })
    }

    return {
      success: true,
      data: {
        총포트폴리오: totalPortfolios,
        진짜임베딩: realIds.length,
        스킵마커: (skipMarkers || []).length,
        진짜임베딩청크수: (realChunks || []).length,
        스킵된샘플: sampleData,
      }
    }
  } catch (error) {
    return { success: false, error: `진단 실패: ${error instanceof Error ? error.message : String(error)}` }
  }
}

export async function embedExistingPortfolios(force: boolean = false) {
  // ★ 실전 버전: 포트폴리오 배치(20개) 조회 → 텍스트 충분한 1개 임베딩
  // 텍스트 부족한 포트폴리오는 빈 마커 저장 → 다음 호출 시 건너뜀 (무한 루프 방지)

  try {
    // ── 1. 관리자 인증 ──
    const { supabase } = await verifyAdmin()

    // ── 2. API 키 확인 ──
    if (!process.env.OPENAI_API_KEY) {
      return { success: false, error: "OPENAI_API_KEY 없음" }
    }

    // ── 3. 전체 수 + 처리된 ID 조회 ──
    const { count, error: countErr } = await supabase.from("portfolios").select("id", { count: "exact", head: true })
    if (countErr) return { success: false, error: `카운트 실패: ${countErr.message}` }
    const totalCount = count || 0

    const { data: chunkData, error: chunkErr } = await supabase.from("portfolio_chunks").select("portfolio_id")
    if (chunkErr) return { success: false, error: `chunks 조회 실패: ${chunkErr.message}` }
    const processedIds = [...new Set((chunkData || []).map((c: { portfolio_id: string }) => c.portfolio_id))]

    // ── 4. 미처리 포트폴리오 20개 가져오기 (배치) ──
    let query = supabase
      .from("portfolios")
      .select("id, file_name, content_text, summary, strengths, weaknesses, tags, companies, document_type")
      .order("created_at", { ascending: true })
      .limit(20)
    if (!force && processedIds.length > 0) {
      query = query.not("id", "in", `(${processedIds.join(",")})`)
    }

    const { data: portfolios, error: queryError } = await query
    if (queryError) return { success: false, error: `포트폴리오 조회 실패: ${queryError.message}` }

    if (!portfolios || portfolios.length === 0) {
      return {
        success: true,
        data: { total: totalCount, processed: 0, failed: 0, skipped: processedIds.length, remaining: 0, errors: ["모든 포트폴리오 임베딩 완료!"] }
      }
    }

    const errors: string[] = []
    let skippedCount = 0

    // ── 5. 배치 순회: 텍스트 부족한 건 마커 저장, 충분한 건 임베딩 ──
    for (const p of portfolios) {
      // 텍스트 확보 (content_text 없으면 메타데이터로 대체)
      let text = p.content_text || ""
      if (text.trim().length < 50) {
        const parts: string[] = []
        if (p.file_name) parts.push(`파일: ${p.file_name}`)
        if (p.document_type) parts.push(`문서유형: ${p.document_type}`)
        if (p.companies && Array.isArray(p.companies)) parts.push(`회사: ${p.companies.join(", ")}`)
        if (p.summary) parts.push(`요약: ${p.summary}`)
        if (p.strengths && Array.isArray(p.strengths)) parts.push(`강점: ${p.strengths.join(". ")}`)
        if (p.weaknesses && Array.isArray(p.weaknesses)) parts.push(`약점: ${p.weaknesses.join(". ")}`)
        if (p.tags && Array.isArray(p.tags)) parts.push(`키워드: ${p.tags.join(", ")}`)
        text = parts.join("\n\n")
      }

      // 텍스트 부족 → 빈 마커 저장 (다음 호출 시 건너뜀)
      if (text.trim().length < 30) {
        await supabase.from("portfolio_chunks").insert({
          portfolio_id: p.id,
          chunk_index: -1,
          chunk_text: `[스킵] 텍스트 부족 (${text.length}자)`,
          embedding: JSON.stringify(Array(1536).fill(0)),
          metadata: { skipped: true, fileName: p.file_name },
        })
        skippedCount++
        errors.push(`${p.file_name}: 텍스트 부족 (${text.length}자) — 스킵`)
        continue
      }

      // 청크 분할 (최대 5개)
      const chunks = chunkText(text).slice(0, 5)
      if (chunks.length === 0) {
        skippedCount++
        errors.push(`${p.file_name}: 청크 없음 — 스킵`)
        continue
      }

      // force 모드면 기존 청크 삭제
      if (force) {
        await supabase.from("portfolio_chunks").delete().eq("portfolio_id", p.id)
      }

      // OpenAI 임베딩 생성
      const embeddings = await generateEmbeddings(chunks)

      // DB에 저장
      const rows = chunks.map((chunk, idx) => ({
        portfolio_id: p.id,
        chunk_index: idx,
        chunk_text: chunk,
        embedding: JSON.stringify(embeddings[idx]),
        metadata: { companies: p.companies, documentType: p.document_type, fileName: p.file_name },
      }))

      const { error: insertError } = await supabase.from("portfolio_chunks").insert(rows)
      if (insertError) {
        errors.push(`${p.file_name}: DB 저장 실패 — ${insertError.message}`)
        continue
      }

      // 1개 임베딩 성공 → 바로 반환 (타임아웃 방지)
      errors.push(`${p.file_name}: 임베딩 완료 (${chunks.length}청크, ${text.length}자)`)
      const remaining = Math.max(0, totalCount - processedIds.length - skippedCount - 1)
      return {
        success: true,
        data: { total: totalCount, processed: 1, failed: 0, skipped: processedIds.length + skippedCount, remaining, errors }
      }
    }

    // 배치 전체가 스킵/실패된 경우
    const remaining = Math.max(0, totalCount - processedIds.length - skippedCount)
    return {
      success: true,
      data: { total: totalCount, processed: 0, failed: 0, skipped: processedIds.length + skippedCount, remaining, errors }
    }
  } catch (error) {
    return {
      success: false,
      error: `임베딩 실패: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

// ========== 합격자 공통점 추출 ==========

/**
 * 합격자 공통점 100가지 추출 (Claude API 사용)
 *
 * 동작:
 * 1. portfolio_chunks에서 모든 청크 텍스트 + 메타데이터 가져오기
 * 2. N개 배치로 분할 (배치당 ~45개 포트폴리오)
 * 3. 각 배치: Claude API 호출 → 중간 패턴 추출 (포트폴리오당 1000자 분석)
 * 4. 최종 통합: 모든 배치 결과를 Claude에 전달 → 최종 50개 패턴 도출
 * 5. success_patterns 테이블에 저장
 *
 * 배치 분할 이유:
 * - 178개 전체를 1회 호출로 분석하면 포트폴리오당 250자만 가능 (너무 얕음)
 * - 배치 분할하면 포트폴리오당 1000자씩 분석 가능 (4배 깊이)
 * - Vercel 5분 제한 내: 배치 4~5회 + 통합 1회 = 총 5~6회 Claude 호출
 *
 * 호출: 관리자 페이지 버튼 클릭
 * 소요: ~3~4분 (Claude API 5~6회 호출)
 */

// ── 잘린 JSON 복구 헬퍼 ──
// Claude 응답이 max_tokens에 도달해 중간에 끊기면 JSON이 불완전함
// 마지막으로 완성된 패턴 객체까지만 살려서 파싱 시도
interface PatternItem {
  number: number
  category: string
  title: string
  description: string
  importance: string
  example_files: string[]
}

function parseClaudePatternResponse(responseText: string): PatternItem[] {
  let jsonStr = responseText.trim()

  // 코드펜스 제거
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "")
  }

  // { 로 시작하지 않으면 첫 번째 { 부터 추출
  if (!jsonStr.startsWith("{") && !jsonStr.startsWith("[")) {
    const firstBrace = jsonStr.indexOf("{")
    if (firstBrace !== -1) jsonStr = jsonStr.slice(firstBrace)
  }

  // 파싱 시도
  try {
    const parsed = JSON.parse(jsonStr)
    const patterns = parsed.patterns || parsed
    if (Array.isArray(patterns)) return patterns.filter((p: PatternItem) => p.title && p.description)
    return []
  } catch {
    // 1차 복구: 마지막 완전한 } 이후를 잘라내고 배열/객체 닫기
    try {
      const lastCompleteObj = jsonStr.lastIndexOf("}")
      if (lastCompleteObj !== -1) {
        let recovered = jsonStr.slice(0, lastCompleteObj + 1)
        const openBraces = (recovered.match(/{/g) || []).length
        const closeBraces = (recovered.match(/}/g) || []).length
        const openBrackets = (recovered.match(/\[/g) || []).length
        const closeBrackets = (recovered.match(/]/g) || []).length
        for (let i = 0; i < openBrackets - closeBrackets; i++) recovered += "]"
        for (let i = 0; i < openBraces - closeBraces; i++) recovered += "}"
        const parsed = JSON.parse(recovered)
        const patterns = parsed.patterns || parsed
        if (Array.isArray(patterns)) return patterns.filter((p: PatternItem) => p.title && p.description)
      }
    } catch {
      // 2차 복구: 마지막 완전한 },{ 패턴까지만 살리기
      try {
        const lastComma = jsonStr.lastIndexOf("},")
        if (lastComma !== -1) {
          const recovered = jsonStr.slice(0, lastComma + 1) + "]}"
          const parsed = JSON.parse(recovered)
          const patterns = parsed.patterns || parsed
          if (Array.isArray(patterns)) return patterns.filter((p: PatternItem) => p.title && p.description)
        }
      } catch { /* 복구 불가 */ }
    }
  }
  return []
}

export async function extractSuccessPatterns() {
  try {
    // ── 1. 관리자 인증 ──
    const { supabase } = await verifyAdmin()

    // ── 2. Claude API 키 확인 ──
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return { success: false, error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." }
    }

    // ── 3. portfolio_analysis 데이터 우선 사용, 없으면 청크 폴백 ──
    const { data: analyses, error: analysisError } = await supabase
      .from("portfolio_analysis")
      .select("portfolio_id, file_name, companies, overall_score, logic_score, specificity_score, readability_score, technical_score, creativity_score, core_loop_score, content_taxonomy_score, economy_score, player_experience_score, data_design_score, feature_connection_score, motivation_score, difficulty_score, ui_ux_score, dev_plan_score, strengths, weaknesses, key_features, summary, detailed_feedback")

    const hasAnalysis = analyses && analyses.length > 0

    // portfolio_analysis가 있으면 구조화 데이터 활용, 없으면 기존 청크 방식 폴백
    type PortfolioEntry = { text: string; companies: string[]; fileName: string }
    const portfolioTexts: Record<string, PortfolioEntry> = {}

    if (hasAnalysis) {
      // 구조화된 분석 결과 → 훨씬 풍부한 컨텍스트
      for (const a of analyses) {
        const scoreLines = [
          `종합 ${a.overall_score}`,
          `논리력 ${a.logic_score}`, `구체성 ${a.specificity_score}`,
          `가독성 ${a.readability_score}`, `기술이해 ${a.technical_score}`, `창의성 ${a.creativity_score}`,
          `핵심반복 ${a.core_loop_score}`, `콘텐츠분류 ${a.content_taxonomy_score}`,
          `재화설계 ${a.economy_score}`, `플레이경험 ${a.player_experience_score}`,
          `수치데이터 ${a.data_design_score}`, `기능연결 ${a.feature_connection_score}`,
          `동기부여 ${a.motivation_score}`, `난이도 ${a.difficulty_score}`,
          `UI/UX ${a.ui_ux_score}`, `개발계획 ${a.dev_plan_score}`,
        ].join(", ")

        const text = [
          `[${a.file_name}] (${(a.companies || []).join(", ")})`,
          `점수: ${scoreLines}`,
          `강점: ${(a.strengths || []).join(" | ")}`,
          `약점: ${(a.weaknesses || []).join(" | ")}`,
          `특징: ${(a.key_features || []).join(", ")}`,
          a.summary ? `요약: ${a.summary}` : "",
          a.detailed_feedback ? `상세: ${a.detailed_feedback}` : "",
        ].filter(Boolean).join("\n")

        portfolioTexts[a.portfolio_id] = {
          text,
          companies: a.companies || [],
          fileName: a.file_name,
        }
      }
    } else {
      // 폴백: 기존 청크 방식
      const { data: chunks, error: chunksError } = await supabase
        .from("portfolio_chunks")
        .select("portfolio_id, chunk_text, metadata")
        .gte("chunk_index", 0)
        .order("portfolio_id")

      if (chunksError) {
        return { success: false, error: `청크 조회 실패: ${chunksError.message}` }
      }

      if (!chunks || chunks.length === 0) {
        return { success: false, error: "분석 데이터가 없습니다. 먼저 심층 분석 또는 임베딩을 실행하세요." }
      }

      for (const chunk of chunks) {
        const pid = chunk.portfolio_id
        if (!portfolioTexts[pid]) {
          const meta = (chunk.metadata as Record<string, unknown>) || {}
          portfolioTexts[pid] = {
            text: "",
            companies: Array.isArray(meta.companies) ? meta.companies as string[] : [],
            fileName: (meta.fileName as string) || "알 수 없음",
          }
        }
        portfolioTexts[pid].text += chunk.chunk_text + "\n"
      }
    }

    const portfolioEntries = Object.entries(portfolioTexts)
    const totalCount = portfolioEntries.length

    // ── 5. 배치 분할 ──
    // portfolio_analysis 기반: 구조화 데이터라 배치당 70개 가능
    // 청크 기반 폴백: 기존 45개 유지
    const BATCH_SIZE = hasAnalysis ? 70 : 45
    const CHARS_PER_PORTFOLIO = hasAnalysis ? 2000 : 1000
    const batches: typeof portfolioEntries[] = []
    for (let i = 0; i < portfolioEntries.length; i += BATCH_SIZE) {
      batches.push(portfolioEntries.slice(i, i + BATCH_SIZE))
    }

    // 회사별 통계 (전체)
    const companyGroups: Record<string, number> = {}
    for (const [, info] of portfolioEntries) {
      for (const company of info.companies) {
        companyGroups[company] = (companyGroups[company] || 0) + 1
      }
    }
    const majorCompanyNames = Object.entries(companyGroups)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name)

    const companyStatsStr = Object.entries(companyGroups)
      .sort((a, b) => b[1] - a[1])
      .map(([company, count]) => `${company}: ${count}개`)
      .join(", ")

    // ── 6. 배치별 Claude 호출 → 중간 패턴 추출 ──
    const anthropic = new Anthropic({ apiKey })
    const allIntermediatePatterns: PatternItem[] = []

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx]
      const batchStart = batchIdx * BATCH_SIZE + 1
      const batchEnd = Math.min(batchStart + batch.length - 1, totalCount)

      // 배치 컨텍스트 구성 (포트폴리오당 1000자)
      let batchContext = ""
      for (const [, info] of batch) {
        const text = info.text.slice(0, CHARS_PER_PORTFOLIO)
        const companyTag = info.companies.length > 0 ? ` (${info.companies.join(", ")})` : ""
        batchContext += `[${info.fileName}${companyTag}]\n${text}\n---\n`
      }

      const batchPrompt = `당신은 게임 업계 채용 전문 분석가입니다.
아래는 총 ${totalCount}개 합격 포트폴리오 중 ${batchStart}~${batchEnd}번째 (${batch.length}개) 포트폴리오입니다.
${hasAnalysis ? "각 포트폴리오에는 15개 카테고리 점수(논리력, 구체성, 가독성, 기술이해, 창의성, 핵심반복, 콘텐츠분류, 재화설계, 플레이경험, 수치데이터, 기능연결, 동기부여, 난이도, UI/UX, 개발계획)와 강점/약점/핵심특징이 포함되어 있습니다." : ""}

이 ${batch.length}개 포트폴리오에서 발견되는 합격자 공통 특징을 최대한 많이 추출해주세요.

## 분석 요구사항:
- 문서 구조, 시각화, 수치 제시, 기획 방법론, 표현 방식, 레퍼런스 분석, 시스템 설계 등 다양한 관점
- 구체적이고 실용적인 인사이트 (추상적인 말 금지)
- 특정 회사(${majorCompanyNames.join(", ")}) 포트폴리오에서 두드러지는 특징도 별도로

## 응답 형식 (반드시 JSON만):
{"patterns":[{"title":"패턴 제목","description":"구체적 설명 1문장.","category":"general","importance":"high","example_files":["파일명.pdf"]}]}

규칙:
- category: "general" 또는 회사명
- importance: high/medium/low
- description: 1문장 50자 이내
- example_files: 해당 패턴이 보이는 파일명 1개
- 15~25개 추출`

      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 6000,
        system: batchPrompt,
        messages: [{
          role: "user",
          content: `아래 ${batch.length}개 포트폴리오를 분석해서 공통 패턴을 JSON으로 추출하세요. 코드펜스 없이 순수 JSON만.\n\n${batchContext}`
        }]
      })
      const message = await stream.finalMessage()
      const responseText = message.content[0].type === "text" ? message.content[0].text : ""

      const batchPatterns = parseClaudePatternResponse(responseText)
      // 배치 번호 태깅 (통합 시 출처 추적용)
      for (const p of batchPatterns) {
        allIntermediatePatterns.push(p)
      }
    }

    if (allIntermediatePatterns.length === 0) {
      return { success: false, error: "배치 분석에서 패턴을 추출하지 못했습니다." }
    }

    // ── 7. 최종 통합: 모든 배치 결과를 Claude에 전달 → 최종 50개 도출 ──
    // 중간 결과를 중복 제거 + 빈도 기반 정렬하여 최종 50개 선정
    const intermediateJson = allIntermediatePatterns.map((p, i) => (
      `${i + 1}. [${p.category}] ${p.title}: ${p.description} (${p.importance}) ${p.example_files?.length ? `예시: ${p.example_files[0]}` : ""}`
    )).join("\n")

    const consolidationPrompt = `당신은 게임 업계 채용 전문 분석가입니다.

${totalCount}개 합격 포트폴리오를 ${batches.length}개 배치로 나눠 분석한 중간 결과가 총 ${allIntermediatePatterns.length}개 있습니다.
회사 분포: ${companyStatsStr}

이 중간 결과를 통합하여 **최종 50가지** 공통점을 선정해주세요.

## 통합 규칙:
1. **일반 공통점 35가지**: 여러 배치에서 반복 등장한 패턴 우선 (빈도가 높을수록 중요)
2. **회사별 특징 15가지**: 주요 회사(${majorCompanyNames.join(", ")}) 각 2~3개씩
3. 유사한 패턴은 하나로 합쳐서 더 정확한 표현으로
4. 추상적인 패턴은 제거, 구체적인 것만 선별
5. number는 1~50으로 재부여

## 응답 형식 (반드시 JSON만):
{"patterns":[{"number":1,"category":"general","title":"패턴 제목","description":"구체적 설명 1문장.","importance":"high","example_files":["파일명.pdf"]}]}

규칙:
- 정확히 50개 (일반 35 + 회사별 15)
- description: 1문장 50자 이내
- importance: high(핵심)/medium(유용)/low(참고)
- example_files: 파일명 1개 (없으면 빈 배열)`

    const consolidationStream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 12000,
      system: consolidationPrompt,
      messages: [{
        role: "user",
        content: `아래는 ${batches.length}개 배치에서 추출한 ${allIntermediatePatterns.length}개 중간 패턴입니다. 통합하여 최종 50개를 JSON으로 출력하세요. 코드펜스 없이 순수 JSON만.\n\n${intermediateJson}`
      }]
    })
    const finalMessage = await consolidationStream.finalMessage()
    const finalText = finalMessage.content[0].type === "text" ? finalMessage.content[0].text : ""

    const finalPatterns = parseClaudePatternResponse(finalText)

    if (finalPatterns.length === 0) {
      return { success: false, error: `최종 통합 파싱 실패. 중간 패턴 ${allIntermediatePatterns.length}개는 추출됨. 응답: ${finalText.slice(0, 300)}` }
    }

    // ── 8. DB 저장 (기존 데이터 삭제 후 새로 저장) ──
    const batchId = `batch_${Date.now()}`

    await supabase.from("success_patterns").delete().neq("batch_id", batchId)

    const rows = finalPatterns.map((p, idx) => ({
      pattern_number: p.number || idx + 1,
      category: p.category || "general",
      title: p.title,
      description: p.description,
      importance: p.importance || "medium",
      example_files: p.example_files || [],
      batch_id: batchId,
    }))

    for (let i = 0; i < rows.length; i += 50) {
      const dbBatch = rows.slice(i, i + 50)
      const { error: insertError } = await supabase.from("success_patterns").insert(dbBatch)
      if (insertError) {
        return { success: false, error: `DB 저장 실패 (${i}번째~): ${insertError.message}` }
      }
    }

    // ── 9. 결과 반환 ──
    const generalCount = finalPatterns.filter(p => p.category === "general").length
    const companyCount = finalPatterns.filter(p => p.category !== "general").length
    const companies = [...new Set(finalPatterns.filter(p => p.category !== "general").map(p => p.category))]

    return {
      success: true,
      data: {
        total: finalPatterns.length,
        general: generalCount,
        company: companyCount,
        companies,
        batchId,
        // 추가 정보: 분석 범위
        analyzedPortfolios: totalCount,
        batchCount: batches.length,
        intermediatePatterns: allIntermediatePatterns.length,
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `공통점 추출 실패: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 합격자 공통점 목록 조회 (확인 페이지용)
 *
 * 카테고리별로 그룹핑해서 반환
 * 누구나 볼 수 있음 (로그인한 사용자)
 */
export async function getSuccessPatterns() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." }
    }

    const { data: patterns, error } = await supabase
      .from("success_patterns")
      .select("*")
      .order("pattern_number", { ascending: true })

    if (error) {
      return { success: false, error: `조회 실패: ${error.message}` }
    }

    if (!patterns || patterns.length === 0) {
      return { success: true, data: { patterns: [], stats: { total: 0, general: 0, company: 0, companies: [] } } }
    }

    // 카테고리별 그룹핑
    const general = patterns.filter(p => p.category === "general")
    const companyPatterns = patterns.filter(p => p.category !== "general")
    const companies = [...new Set(companyPatterns.map(p => p.category))]

    return {
      success: true,
      data: {
        patterns,
        stats: {
          total: patterns.length,
          general: general.length,
          company: companyPatterns.length,
          companies,
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `조회 실패: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}


// ============================================================
// ■ 전체 포트폴리오 재청킹 + 재임베딩
// ============================================================

/**
 * 기존 포트폴리오의 메타데이터를 풍부한 구조화 텍스트로 재구성하여 재임베딩
 *
 * 기존: PDF 포트폴리오의 임베딩 텍스트 = 파일명+요약+강점+약점 (~500자)
 * 개선: 점수, 카테고리별 점수, 상세 메타데이터를 모두 포함한 구조화 텍스트 (~1500-2000자)
 *
 * content_text가 있으면 그대로 사용 (스프레드시트 등 원본 텍스트 보유),
 * 없으면 DB 메타데이터로 풍부한 텍스트를 재구성.
 *
 * @param batchLimit - 한 번에 처리할 최대 개수 (기본 10, Vercel 타임아웃 방지)
 * @returns 처리 결과
 */
export async function rebuildAllPortfolioChunks(batchLimit: number = 10) {
  try {
    await verifyAdmin()
    const supabase = await createClient()

    // 전체 포트폴리오 조회 (모든 메타데이터 포함)
    const { data: portfolios, error } = await supabase
      .from("portfolios")
      .select(`
        id, file_name, companies, document_type, content_text,
        summary, strengths, weaknesses, tags,
        overall_score, logic_score, specificity_score, readability_score,
        technical_score, creativity_score
      `)
      .order("created_at", { ascending: true })

    if (error || !portfolios) {
      return { success: false, error: `포트폴리오 조회 실패: ${error?.message}` }
    }

    // 이미 재청킹 완료된 포트폴리오 체크 (chunk_text 길이 기준)
    // 기존 청크가 있어도 강제 재처리 (품질 개선이 목적)
    const { data: chunkCounts } = await supabase
      .from("portfolio_chunks")
      .select("portfolio_id")

    const existingChunkIds = new Set((chunkCounts || []).map(c => c.portfolio_id))

    // 아직 재청킹 안 된 포트폴리오 우선 처리
    const unprocessed = portfolios.filter(p => !existingChunkIds.has(p.id))
    const processed = portfolios.filter(p => existingChunkIds.has(p.id))
    const ordered = [...unprocessed, ...processed]

    const batch = ordered.slice(0, batchLimit)
    const remaining = ordered.length - batch.length

    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    for (const portfolio of batch) {
      try {
        // content_text가 있으면 그대로 사용, 없으면 메타데이터로 풍부한 텍스트 재구성
        let text = portfolio.content_text
        if (!text || text.trim().length < 100) {
          text = buildRichPortfolioText(portfolio)
        }

        if (!text || text.trim().length < 50) {
          failCount++
          errors.push(`${portfolio.file_name}: 텍스트 부족`)
          continue
        }

        const result = await embedAndStorePortfolio(
          portfolio.id,
          text,
          {
            companies: portfolio.companies,
            documentType: portfolio.document_type,
            fileName: portfolio.file_name,
          },
        )

        if (result.success) {
          successCount++
        } else {
          failCount++
          errors.push(`${portfolio.file_name}: ${result.error}`)
        }

        // API 속도 제한 방지
        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (err) {
        failCount++
        errors.push(`${portfolio.file_name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return {
      success: true,
      data: {
        total: portfolios.length,
        processed: successCount,
        failed: failCount,
        remaining,
        errors: errors.slice(0, 10),
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `재청킹 실패: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 포트폴리오 메타데이터를 풍부한 구조화 텍스트로 변환
 * content_text가 없는 PDF 포트폴리오용
 */
function buildRichPortfolioText(portfolio: {
  file_name: string
  companies?: string[]
  document_type?: string
  summary?: string
  strengths?: string[]
  weaknesses?: string[]
  tags?: string[]
  overall_score?: number
  logic_score?: number
  specificity_score?: number
  readability_score?: number
  technical_score?: number
  creativity_score?: number
}): string {
  const parts: string[] = []

  parts.push(`[포트폴리오: ${portfolio.file_name}]`)

  if (portfolio.companies?.length) {
    parts.push(`합격 회사: ${portfolio.companies.join(", ")}`)
  }
  if (portfolio.document_type) {
    parts.push(`문서 유형: ${portfolio.document_type}`)
  }

  // 점수 정보
  const scores: string[] = []
  if (portfolio.overall_score) scores.push(`종합 ${portfolio.overall_score}/100`)
  if (portfolio.logic_score) scores.push(`논리력 ${portfolio.logic_score}`)
  if (portfolio.specificity_score) scores.push(`구체성 ${portfolio.specificity_score}`)
  if (portfolio.readability_score) scores.push(`가독성 ${portfolio.readability_score}`)
  if (portfolio.technical_score) scores.push(`기술이해 ${portfolio.technical_score}`)
  if (portfolio.creativity_score) scores.push(`창의성 ${portfolio.creativity_score}`)
  if (scores.length > 0) {
    parts.push(`평가 점수: ${scores.join(", ")}`)
  }

  if (portfolio.summary) {
    parts.push(`\n요약:\n${portfolio.summary}`)
  }

  if (portfolio.strengths?.length) {
    parts.push(`\n강점:`)
    portfolio.strengths.forEach((s, i) => parts.push(`${i + 1}. ${s}`))
  }

  if (portfolio.weaknesses?.length) {
    parts.push(`\n보완점:`)
    portfolio.weaknesses.forEach((w, i) => parts.push(`${i + 1}. ${w}`))
  }

  if (portfolio.tags?.length) {
    parts.push(`\n키워드: ${portfolio.tags.join(", ")}`)
  }

  return parts.join("\n")
}

// ============================================================
// ■ 포트폴리오 개별 심층 분석 (Phase 2)
//   portfolio_analysis 테이블에 15개 카테고리 점수 + 강점/약점/핵심특징 저장
// ============================================================

/**
 * 미분석 포트폴리오를 배치로 심층 분석하여 portfolio_analysis에 저장
 * - 입력: content_text(있으면) + Gemini 메타데이터 + 기존 청크 텍스트
 * - 분석: Claude Sonnet으로 15개 카테고리 점수 + 강점/약점 + 핵심특징
 * - 배치: batchLimit개씩 처리 (Vercel 5분 제한 고려)
 */
export async function analyzePortfoliosBatch(batchLimit: number = 5) {
  try {
    const { supabase } = await verifyAdmin()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return { success: false, error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." }
    }

    // 1. 전체 포트폴리오 조회
    const { data: portfolios, error: pError } = await supabase
      .from("portfolios")
      .select(`
        id, file_name, companies, document_type, content_text,
        summary, strengths, weaknesses, tags,
        overall_score, logic_score, specificity_score, readability_score,
        technical_score, creativity_score
      `)
      .order("created_at", { ascending: true })

    if (pError || !portfolios) {
      return { success: false, error: `포트폴리오 조회 실패: ${pError?.message}` }
    }

    // 2. 이미 분석 완료된 포트폴리오 제외
    const { data: analyzed } = await supabase
      .from("portfolio_analysis")
      .select("portfolio_id")

    const analyzedIds = new Set((analyzed || []).map(a => a.portfolio_id))
    const unanalyzed = portfolios.filter(p => !analyzedIds.has(p.id))

    if (unanalyzed.length === 0) {
      return {
        success: true,
        data: { total: portfolios.length, processed: 0, remaining: 0, errors: [] },
      }
    }

    // 3. 미분석 포트폴리오에 대해 청크 텍스트도 가져오기
    const batchPortfolios = unanalyzed.slice(0, batchLimit)
    const batchIds = batchPortfolios.map(p => p.id)

    const { data: chunks } = await supabase
      .from("portfolio_chunks")
      .select("portfolio_id, chunk_text")
      .in("portfolio_id", batchIds)
      .order("chunk_index")

    // 포트폴리오별 청크 그룹핑
    const chunksByPortfolio: Record<string, string[]> = {}
    for (const c of chunks || []) {
      if (!chunksByPortfolio[c.portfolio_id]) chunksByPortfolio[c.portfolio_id] = []
      chunksByPortfolio[c.portfolio_id].push(c.chunk_text)
    }

    // 4. 배치 분석 실행
    const anthropic = new Anthropic({ apiKey })
    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    for (const portfolio of batchPortfolios) {
      try {
        // 분석 대상 텍스트 구성: content_text > 청크 > 메타데이터
        let analysisText = ""
        if (portfolio.content_text && portfolio.content_text.trim().length > 200) {
          analysisText = portfolio.content_text.slice(0, 15000)
        } else if (chunksByPortfolio[portfolio.id]?.length) {
          analysisText = chunksByPortfolio[portfolio.id].join("\n\n").slice(0, 15000)
        } else {
          analysisText = buildRichPortfolioText(portfolio)
        }

        const prompt = `당신은 게임 업계 11년차 현업 기획자이자 채용 담당자입니다.
아래 합격 포트폴리오를 **15개 카테고리**로 심층 분석해주세요.

## 포트폴리오 정보
- 파일명: ${portfolio.file_name}
- 지원사: ${(portfolio.companies || []).join(", ") || "미상"}
- 문서유형: ${portfolio.document_type || "포트폴리오"}
- Gemini 종합 점수: ${portfolio.overall_score || "없음"}/100

## 평가 카테고리 (15개)
### 기본 역량 5개
1. logic (논리력): 주장-근거-결론의 논리적 연결
2. specificity (구체성): 수치, 데이터, 구체적 사례 제시
3. readability (가독성): 문서 구조, 시각화, 읽기 편의성
4. technical (기술이해): 개발 제약, 기술 구현 가능성 고려
5. creativity (창의성): 차별화된 아이디어, 독창적 접근

### 게임디자인 역량 10개
6. core_loop (핵심반복구조): 코어 루프, 게임 흐름 설계
7. content_taxonomy (콘텐츠분류체계): 콘텐츠 구분, 분류, 체계적 정리
8. economy (재화흐름설계): 재화 획득/소비 구조, 경제 밸런스
9. player_experience (플레이경험목표): 감정 곡선, 플레이어 경험 설계
10. data_design (수치데이터정리): 수치 테이블, 밸런스 데이터 정리
11. feature_connection (기능간연결관계): 시스템 간 연결, 의존 관계 명시
12. motivation (동기부여설계): 보상, 목표, 진행감 설계
13. difficulty (난이도균형): 난이도 곡선, 적절한 도전감
14. ui_ux (화면및조작설계): UI/UX 와이어프레임, 조작 흐름
15. dev_plan (개발일정및산출물): 개발 일정, 마일스톤, 산출물 목록

## 응답 형식 (JSON만, 코드펜스 없이):
{
  "overall_score": 85,
  "logic_score": 80, "specificity_score": 75, "readability_score": 90,
  "technical_score": 70, "creativity_score": 85,
  "core_loop_score": 80, "content_taxonomy_score": 75, "economy_score": 60,
  "player_experience_score": 85, "data_design_score": 70,
  "feature_connection_score": 65, "motivation_score": 80,
  "difficulty_score": 70, "ui_ux_score": 75, "dev_plan_score": 60,
  "strengths": ["강점1", "강점2", "강점3", "강점4"],
  "weaknesses": ["약점1", "약점2", "약점3"],
  "key_features": ["핵심특징1", "핵심특징2", "핵심특징3", "핵심특징4", "핵심특징5"],
  "summary": "200자 이내 종합 분석 요약",
  "detailed_feedback": "카테고리별 1줄씩 총 15줄 피드백"
}

## 주의사항:
- 문서에 해당 카테고리 내용이 없으면 0~30점 부여
- 문서 주제와 무관한 카테고리는 낮게 평가 (시스템기획서에 캐릭터 평가 등)
- 후한 점수 금지. 부족하면 확실히 낮게
- strengths 4~6개, weaknesses 3~4개, key_features 5~8개`

        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: `아래 포트폴리오를 15개 카테고리로 심층 분석해주세요. JSON만 출력.\n\n${analysisText}`
          }],
          system: prompt,
        })

        const responseText = message.content[0].type === "text" ? message.content[0].text : ""

        // JSON 파싱
        let jsonStr = responseText
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) jsonStr = jsonMatch[1]
        else {
          const objMatch = responseText.match(/\{[\s\S]*\}/)
          if (objMatch) jsonStr = objMatch[0]
        }

        const result = JSON.parse(jsonStr)

        // portfolio_analysis에 UPSERT
        const { error: upsertError } = await supabase
          .from("portfolio_analysis")
          .upsert({
            portfolio_id: portfolio.id,
            file_name: portfolio.file_name,
            companies: portfolio.companies || [],
            overall_score: result.overall_score || 0,
            logic_score: result.logic_score || 0,
            specificity_score: result.specificity_score || 0,
            readability_score: result.readability_score || 0,
            technical_score: result.technical_score || 0,
            creativity_score: result.creativity_score || 0,
            core_loop_score: result.core_loop_score || 0,
            content_taxonomy_score: result.content_taxonomy_score || 0,
            economy_score: result.economy_score || 0,
            player_experience_score: result.player_experience_score || 0,
            data_design_score: result.data_design_score || 0,
            feature_connection_score: result.feature_connection_score || 0,
            motivation_score: result.motivation_score || 0,
            difficulty_score: result.difficulty_score || 0,
            ui_ux_score: result.ui_ux_score || 0,
            dev_plan_score: result.dev_plan_score || 0,
            strengths: result.strengths || [],
            weaknesses: result.weaknesses || [],
            key_features: result.key_features || [],
            summary: result.summary || "",
            detailed_feedback: result.detailed_feedback || "",
            analyzed_at: new Date().toISOString(),
          }, { onConflict: "portfolio_id" })

        if (upsertError) {
          failCount++
          errors.push(`${portfolio.file_name}: DB 저장 실패 — ${upsertError.message}`)
        } else {
          successCount++
          console.log(`✅ 심층 분석 완료: ${portfolio.file_name}`)
        }

        // API 속도 제한 방지
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (err) {
        failCount++
        errors.push(`${portfolio.file_name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return {
      success: true,
      data: {
        total: portfolios.length,
        analyzed: analyzedIds.size + successCount,
        processed: successCount,
        failed: failCount,
        remaining: unanalyzed.length - batchPortfolios.length,
        errors: errors.slice(0, 10),
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `심층 분석 실패: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * portfolio_analysis 전체 데이터 조회 (관리자용)
 * 데이터 관리 탭에서 포트폴리오별 심층분석 결과 표시에 사용
 */
export async function getPortfolioAnalysisAll() {
  try {
    const { supabase } = await verifyAdmin()

    const { data, error } = await supabase
      .from("portfolio_analysis")
      .select("*")
      .order("overall_score", { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * portfolio_analysis 통계 조회 (관리자용)
 */
export async function getPortfolioAnalysisStats() {
  try {
    const { supabase } = await verifyAdmin()

    const { data: analyses, error } = await supabase
      .from("portfolio_analysis")
      .select("portfolio_id, overall_score, companies")

    if (error) {
      return { success: false, error: error.message }
    }

    const { data: totalPortfolios } = await supabase
      .from("portfolios")
      .select("id", { count: "exact", head: true })

    return {
      success: true,
      data: {
        analyzed: analyses?.length || 0,
        total: totalPortfolios?.length || 0,
        avgScore: analyses?.length
          ? Math.round(analyses.reduce((a, b) => a + (b.overall_score || 0), 0) / analyses.length)
          : 0,
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
