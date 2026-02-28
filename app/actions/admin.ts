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
 * - PDF/이미지: 메타데이터(요약+강점+약점) 기반 임베딩
 *
 * 보안: 모든 함수에서 관리자 이메일 이중 확인 (미들웨어 + 서버 액션)
 *
 * 환경변수: GOOGLE_GENERATIVE_AI_API_KEY, ADMIN_EMAILS, OPENAI_API_KEY
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { v4 as uuidv4 } from "uuid"
import { extractCompanyFromFileName } from "@/lib/company-parser"
import { parseExcelToText, parseCsvToText, isSpreadsheetFile } from "@/lib/excel-parser"
import { embedAndStorePortfolio, embedAllPortfolios, chunkText } from "@/lib/vector-search"
import { generateEmbeddings } from "@/lib/openai-embedding"

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
        // 임베딩용 텍스트: content_text 있으면 사용, 없으면 메타데이터 조합
        const embeddingText = extractedContentText ||
          [
            `파일: ${input.fileName}`,
            `문서유형: ${input.documentType}`,
            `회사: ${input.companies.join(", ")}`,
            `요약: ${analysis.summary}`,
            `강점: ${(analysis.strengths || []).join(". ")}`,
            `약점: ${(analysis.weaknesses || []).join(". ")}`,
            `키워드: ${(analysis.tags || []).join(", ")}`,
          ].join("\n\n")

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
export async function embedExistingPortfolios(force: boolean = false) {
  try {
    const { supabase } = await verifyAdmin()

    if (!process.env.OPENAI_API_KEY) {
      return { success: false, error: "OPENAI_API_KEY가 Vercel 환경변수에 없습니다." }
    }

    // ── 1단계: 전체 수 + 이미 처리된 ID를 동시에 가져옴 (병렬) ──
    const [countResult, chunkedResult] = await Promise.all([
      supabase.from("portfolios").select("id", { count: "exact", head: true }),
      supabase.from("portfolio_chunks").select("portfolio_id"),
    ])

    const totalCount = countResult.count || 0
    const processedIds = [...new Set((chunkedResult.data || []).map((c: { portfolio_id: string }) => c.portfolio_id))]

    // ── 2단계: 처리 안 된 포트폴리오 1개 찾기 ──
    let query = supabase
      .from("portfolios")
      .select("id, file_name, content_text, summary, strengths, weaknesses, tags, companies, document_type")
      .order("created_at", { ascending: true })
      .limit(1)

    // 이미 처리된 포트폴리오 제외 (force 모드가 아닐 때)
    if (!force && processedIds.length > 0) {
      query = query.not("id", "in", `(${processedIds.join(",")})`)
    }

    const { data: portfolios } = await query

    if (!portfolios || portfolios.length === 0) {
      // 더 이상 처리할 포트폴리오 없음
      return {
        success: true,
        data: { total: totalCount, processed: 0, failed: 0, skipped: processedIds.length, remaining: 0, errors: [] }
      }
    }

    const portfolio = portfolios[0]
    const remaining = Math.max(0, totalCount - processedIds.length - 1)

    // ── 3단계: 텍스트 확보 (content_text 또는 메타데이터 조합) ──
    let text = portfolio.content_text
    if (!text || text.trim().length < 50) {
      const parts: string[] = []
      if (portfolio.file_name) parts.push(`파일: ${portfolio.file_name}`)
      if (portfolio.document_type) parts.push(`문서유형: ${portfolio.document_type}`)
      if (portfolio.companies?.length) parts.push(`회사: ${portfolio.companies.join(", ")}`)
      if (portfolio.summary) parts.push(`요약: ${portfolio.summary}`)
      if (portfolio.strengths?.length) parts.push(`강점: ${portfolio.strengths.join(". ")}`)
      if (portfolio.weaknesses?.length) parts.push(`약점: ${portfolio.weaknesses.join(". ")}`)
      if (portfolio.tags?.length) parts.push(`키워드: ${portfolio.tags.join(", ")}`)
      text = parts.join("\n\n")
    }

    if (!text || text.trim().length < 30) {
      return {
        success: true,
        data: { total: totalCount, processed: 0, failed: 0, skipped: processedIds.length + 1, remaining, errors: [`${portfolio.file_name}: 텍스트 부족`] }
      }
    }

    // ── 4단계: 텍스트 → 청크 분할 (최대 20개 = OpenAI 1회 호출) ──
    const chunks = chunkText(text).slice(0, 20)
    if (chunks.length === 0) {
      return {
        success: true,
        data: { total: totalCount, processed: 0, failed: 0, skipped: processedIds.length + 1, remaining, errors: [`${portfolio.file_name}: 텍스트 부족`] }
      }
    }

    // ── 5단계: force 모드면 기존 청크 삭제 ──
    if (force) {
      await supabase.from("portfolio_chunks").delete().eq("portfolio_id", portfolio.id)
    }

    // ── 6단계: OpenAI 임베딩 생성 (1회 API 호출) ──
    const embeddings = await generateEmbeddings(chunks)

    // ── 7단계: DB에 저장 (1회 insert) ──
    const rows = chunks.map((chunk, idx) => ({
      portfolio_id: portfolio.id,
      chunk_index: idx,
      chunk_text: chunk,
      embedding: JSON.stringify(embeddings[idx]),
      metadata: {
        companies: portfolio.companies,
        documentType: portfolio.document_type,
        fileName: portfolio.file_name,
      },
    }))

    const { error: insertError } = await supabase.from("portfolio_chunks").insert(rows)

    if (insertError) {
      return {
        success: true,
        data: { total: totalCount, processed: 0, failed: 1, skipped: processedIds.length, remaining, errors: [`${portfolio.file_name}: DB 저장 실패 — ${insertError.message}`] }
      }
    }

    return {
      success: true,
      data: { total: totalCount, processed: 1, failed: 0, skipped: processedIds.length, remaining, errors: [] }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "처리 실패"
    }
  }
}
