/**
 * 1단계 문서 스캔: 직군·문서 형식·키워드 추출 (서버 전용)
 *
 * Haiku 4.5로 가볍게 호출한다 (크레딧 차감 없음, 약 250원 미만).
 * 실패하면 lib/analysis/domains.ts의 휴리스틱 분류로 폴백한다.
 *
 * 결과는 사용자에게 보여주고(직군 뱃지 + 변경 드롭다운) 확정된 값을 2단계 분석에 넘긴다.
 */

import Anthropic from "@anthropic-ai/sdk"
import {
  ALL_DOMAINS,
  DOMAIN_LABELS,
  DOC_FORM_LABELS,
  classifyHeuristically,
  isDesignDomain,
  isDocForm,
  type DesignDomain,
  type DocForm,
} from "./domains"
import { resolveClassifierModelId } from "./model"
import { extractJsonBlock, safeParseJSON } from "./json"

export interface DocumentScan {
  domain: DesignDomain
  secondary: DesignDomain[]
  docForm: DocForm
  keywords: string[]
  gameTitle: string | null
  /** 0~1. 휴리스틱 폴백이면 0.3 */
  confidence: number
  /** "haiku" | "heuristic" */
  method: "haiku" | "heuristic"
}

const DOMAIN_GUIDE = ALL_DOMAINS.map(d => `- ${d}: ${DOMAIN_LABELS[d]}`).join("\n")
const FORM_GUIDE = (Object.keys(DOC_FORM_LABELS) as DocForm[]).filter(f => f !== "unknown").map(f => `- ${f}: ${DOC_FORM_LABELS[f]}`).join("\n")

export async function scanDocumentWithClaude(input: {
  fileName: string
  text: string
  apiKey: string
}): Promise<DocumentScan> {
  const heuristic = classifyHeuristically({ fileName: input.fileName, text: input.text })
  const fallback: DocumentScan = {
    domain: heuristic.domain,
    secondary: heuristic.secondary,
    docForm: heuristic.docForm,
    keywords: [],
    gameTitle: null,
    confidence: 0.3,
    method: "heuristic",
  }

  if (!input.text || input.text.trim().length < 50) return fallback

  try {
    const client = new Anthropic({ apiKey: input.apiKey, maxRetries: 1 })
    const response = await client.messages.create({
      model: resolveClassifierModelId(),
      max_tokens: 600,
      system: `당신은 게임 기획 문서 분류 전문가입니다. 주어진 문서(파일명 + 본문 앞부분)를 읽고 JSON 하나만 출력하세요.

## 직군(domain) — 문서가 "주로" 다루는 기획 영역 하나
${DOMAIN_GUIDE}
판단 기준:
- 레벨 디자인 문서에 몬스터 배치표가 있어도 주제가 공간·동선이면 level.
- 캐릭터의 스킬·전투 수치가 중심이면 combat, 설정·서사가 중심이면 narrative.
- 여러 영역을 비슷한 비중으로 다루는 제안서·게임 개요·자기 PR은 general.
- 엑셀/시트 형태의 수치 정의가 본체이면 data.

## 문서 형식(docForm)
${FORM_GUIDE}

## keywords
합격 포트폴리오 DB 태그와 매칭할 키워드 5~10개 (문서 유형, 다루는 게임 요소, 게임 타이틀).

## 출력 형식 (JSON만, 다른 텍스트 없이)
{"domain":"level","secondary":["combat","narrative"],"docForm":"reverse","keywords":["레벨디자인","역기획","던전","동선"],"gameTitle":"로스트아크","confidence":0.9}
- secondary: 주 직군 다음으로 관련 깊은 직군 정확히 2개, 관련도 순 (화면에서 사용자에게 3개를 미리 골라 보여준다)
- confidence: 분류 확신도 0~1`,
      messages: [{
        role: "user",
        content: `파일명: ${input.fileName}\n\n본문 앞부분:\n${input.text.slice(0, 6000)}`,
      }],
    })

    const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("")
    const parsed = safeParseJSON(extractJsonBlock(text))

    const domain = isDesignDomain(parsed.domain) ? parsed.domain : heuristic.domain
    const secondary = Array.isArray(parsed.secondary)
      ? parsed.secondary.filter((d): d is DesignDomain => isDesignDomain(d) && d !== domain).slice(0, 2)
      : heuristic.secondary
    const docForm = isDocForm(parsed.docForm) ? parsed.docForm : heuristic.docForm
    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0).map(k => k.trim()).slice(0, 12)
      : []
    const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.6

    return {
      domain,
      secondary,
      docForm,
      keywords,
      gameTitle: typeof parsed.gameTitle === "string" && parsed.gameTitle.trim() ? parsed.gameTitle.trim() : null,
      confidence,
      method: "haiku",
    }
  } catch (err) {
    console.error("[scan] Haiku 분류 실패, 휴리스틱 폴백:", err instanceof Error ? err.message : err)
    return fallback
  }
}
