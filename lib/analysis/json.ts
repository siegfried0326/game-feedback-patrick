/**
 * Claude 응답 JSON 추출·복구 유틸리티 (서버 전용)
 *
 * - extractJsonBlock(): 응답 텍스트에서 ```json 펜스 또는 첫 { ... } 블록을 꺼낸다
 * - repairJSON(): max_tokens로 잘리거나 괄호가 안 닫힌 JSON을 최대한 복구한다
 * - safeParseJSON(): 1차 파싱 실패 시 복구 후 재시도
 *
 * 기존 app/actions/analyze.ts에 있던 로직을 그대로 옮겼다.
 */

export function extractJsonBlock(responseText: string): string {
  const fenced = responseText.match(/```json\s*([\s\S]*?)\s*```/)
  if (fenced) return fenced[1]
  const objectMatch = responseText.match(/\{[\s\S]*\}/)
  return objectMatch ? objectMatch[0] : responseText
}

export function repairJSON(jsonStr: string): string {
  // 1단계: trailing comma 제거 (배열/객체 끝의 불필요한 쉼표)
  let repaired = jsonStr.replace(/,\s*([\]}])/g, "$1")

  // 2단계: 마지막 유효한 닫는 괄호 이후의 불완전한 조각 제거
  const lastBrace = Math.max(repaired.lastIndexOf("}"), repaired.lastIndexOf("]"))
  if (lastBrace > 0) {
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

  if (inString) repaired += '"'
  repaired = repaired.replace(/,\s*$/gm, "")
  while (openBrackets > 0) { repaired += "]"; openBrackets-- }
  while (openBraces > 0) { repaired += "}"; openBraces-- }

  return repaired
}

export function safeParseJSON(jsonStr: string): Record<string, unknown> {
  try {
    return JSON.parse(jsonStr)
  } catch {
    console.log("[분석] JSON 파싱 실패, 복구 시도 중...")
    try {
      const result = JSON.parse(repairJSON(jsonStr))
      console.log("[분석] JSON 복구 성공")
      return result
    } catch (repairError) {
      console.error("[분석] JSON 복구도 실패:", repairError)
      throw new Error("AI 응답을 파싱할 수 없습니다. 다시 시도해 주세요.")
    }
  }
}
