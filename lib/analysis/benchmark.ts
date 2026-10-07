/**
 * 회사별 벤치마크 데이터 로드 + 프롬프트 포맷 (서버 전용)
 *
 * data/company-benchmarks.json: 10개사 × (design 10항목 + readability 10항목)
 * - 9개 회사 (2026-10-07 시프트업 추가): 사용자에게 회사별 비교 피드백으로 노출
 * - "일반회사": "업계 공통" 라벨로 주입, 사용자 미노출 (판단 다각화용)
 *
 * 토큰 절약: 항목당 BENCHMARK_MAX_CHARS(150자)로 절삭. 전체 ~72,000자 → ~27,000자.
 * 이 섹션은 요청마다 바뀌지 않으므로 프롬프트 캐시 블록으로 쓴다.
 *
 * 기존 app/actions/analyze.ts에서 그대로 옮겼다.
 */

import fs from "fs"
import path from "path"

interface CompanyBenchmark {
  design: Record<string, string>
  readability: Record<string, string>
}

let cachedBenchmarks: Record<string, CompanyBenchmark> | null = null

export function loadCompanyBenchmarks(): Record<string, CompanyBenchmark> {
  if (cachedBenchmarks) return cachedBenchmarks
  try {
    const filePath = path.join(process.cwd(), "data", "company-benchmarks.json")
    cachedBenchmarks = JSON.parse(fs.readFileSync(filePath, "utf-8"))
    console.log("[벤치마크] 데이터 로드 성공:", Object.keys(cachedBenchmarks!).length, "개사")
    return cachedBenchmarks!
  } catch (err) {
    console.error("[벤치마크] 데이터 로드 실패:", err)
    return {}
  }
}

const BENCHMARK_MAX_CHARS = 150

function truncateBenchmark(text: string): string {
  if (text.length <= BENCHMARK_MAX_CHARS) return text
  const cut = text.substring(0, BENCHMARK_MAX_CHARS)
  const lastPeriod = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("다"))
  if (lastPeriod > BENCHMARK_MAX_CHARS * 0.5) return cut.substring(0, lastPeriod + 1)
  return cut + "…"
}

export const BENCHMARK_COMPANIES = ["넥슨", "네오위즈", "넷마블", "엔씨소프트", "크래프톤", "펄어비스", "스마일게이트", "웹젠", "시프트업"]
const DESIGN_ITEMS = ["핵심반복구조", "콘텐츠분류", "재화흐름", "플레이경험", "수치데이터", "기능연결", "동기부여", "난이도균형", "화면조작", "개발일정"]
const READABILITY_ITEMS = ["글자크기구분", "문단나누기", "여백활용", "색상활용", "표와그림배치", "페이지구성", "읽는순서", "강조표현", "목차와번호", "전체통일감"]

/**
 * @param includeReadability readability 벤치마크 포함 여부 (PDF 원본 분석에만 true)
 */
export function formatBenchmarkForPrompt(includeReadability: boolean): string {
  const benchmarks = loadCompanyBenchmarks()
  if (Object.keys(benchmarks).length === 0) return ""
  const generalData = benchmarks["일반회사"]

  let result = `## 🏢 회사별 합격 포트폴리오 벤치마크 (187개 합격 사례 기반)\n\n`
  result += `### 게임 디자인 역량 — 회사별 합격자 특징\n`
  result += `각 평가 항목의 feedback 작성 시, 아래 벤치마크를 참고하여 "합격자들은 ~하는데, 이 문서는 ~하다"는 비교를 제공하세요.\n`
  result += `"업계 공통"은 특정 회사에 국한되지 않는 전반적인 합격 기준이므로, 회사별 판단과 함께 종합적으로 참고하세요.\n`
  result += `단, 이 문서의 직군에서 "해당 없음"으로 지정된 항목의 벤치마크는 인용하지 마세요.\n\n`

  for (const item of DESIGN_ITEMS) {
    result += `[${item}]\n`
    for (const company of BENCHMARK_COMPANIES) {
      const text = benchmarks[company]?.design?.[item]
      if (text) result += `- ${company}: ${truncateBenchmark(text)}\n`
    }
    if (generalData?.design?.[item]) result += `- 업계 공통: ${truncateBenchmark(generalData.design[item])}\n`
    result += `\n`
  }

  if (includeReadability) {
    result += `### 문서 가독성 — 회사별 합격자 특징\n\n`
    for (const item of READABILITY_ITEMS) {
      result += `[${item}]\n`
      for (const company of BENCHMARK_COMPANIES) {
        const text = benchmarks[company]?.readability?.[item]
        if (text) result += `- ${company}: ${truncateBenchmark(text)}\n`
      }
      if (generalData?.readability?.[item]) result += `- 업계 공통: ${truncateBenchmark(generalData.readability[item])}\n`
      result += `\n`
    }
  }

  result += `### companyFeedback 작성 시 벤치마크 활용\n`
  result += `- 9개 회사(넥슨~시프트업)에 대해 각각 위 벤치마크를 근거로 비교 피드백 작성\n`
  result += `- 각 회사 피드백에서 해당 회사 벤치마크 + 업계 공통 벤치마크를 종합 참고\n`
  result += `- "일반회사" 또는 "업계 공통"이라는 명칭은 사용자에게 노출하지 않음\n`
  return result
}
