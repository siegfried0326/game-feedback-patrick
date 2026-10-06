// 분석 엔진 단독 테스트 (로그인·크레딧·이력 저장 없이 runAnalysis와 같은 경로로 1회 분석)
//
// 사용: npx tsx --env-file=.env.local scripts/test-analysis.mts <PDF 경로> [domain] [tier]
//   domain: level|combat|system|economy|uiux|narrative|data|general (생략 시 Haiku 스캔 결과)
//   tier:   basic|precision (기본 basic)
// 출력: 콘솔 요약 + 전체 JSON을 같은 폴더에 <파일명>.analysis.json으로 저장
//
// app/actions/analyze.ts의 runAnalysis는 서버 액션(쿠키 인증)이라 스크립트에서 못 부른다.
// 같은 lib/analysis 모듈로 같은 프롬프트를 만들어 같은 방식(Files API → 실패 시 base64)으로 호출한다.

import fs from "node:fs"
import path from "node:path"
import Anthropic, { toFile } from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"
import { classifyHeuristically, isDesignDomain, DOMAIN_LABELS, type DesignDomain } from "../lib/analysis/domains"
import { MODEL_TIERS, isModelTier, resolveModelId } from "../lib/analysis/model"
import { loadReferenceSet } from "../lib/analysis/reference"
import { buildSystemBlocks, buildUserInstruction } from "../lib/analysis/prompt"
import { formatBenchmarkForPrompt } from "../lib/analysis/benchmark"
import { scanDocumentWithClaude } from "../lib/analysis/classify"
import { extractJsonBlock, safeParseJSON } from "../lib/analysis/json"
import { summarizeUsage, logUsage } from "../lib/analysis/usage"
import { maskForPrompt, scrubOutput } from "../lib/analysis/anonymize"

const args = process.argv.slice(2)
const excludeArg = args.find(a => a.startsWith("--exclude="))
const [pdfPath, domainArg, tierArg] = args.filter(a => !a.startsWith("--"))
// --exclude=<portfolio id>: 합격 문서로 검증할 때 비교군·발췌에서 자기 자신과 그 사본을 뺀다
const excludeIds: string[] = []
if (!pdfPath || !fs.existsSync(pdfPath)) {
  console.error("사용: npx tsx --env-file=.env.local scripts/test-analysis.mts <PDF 경로> [domain] [tier]")
  process.exit(1)
}

const apiKey = process.env.ANTHROPIC_API_KEY!
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const fileName = path.basename(pdfPath)
const buffer = fs.readFileSync(pdfPath)

// 1) 텍스트 추출 (스캔·벡터 검색용) — pdfjs legacy
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, disableFontFace: true }).promise
let text = ""
for (let i = 1; i <= doc.numPages; i++) {
  const tc = await (await doc.getPage(i)).getTextContent()
  text += `\n--- 페이지 ${i}/${doc.numPages} ---\n` + tc.items.map(it => ("str" in it ? it.str : "")).join(" ")
}
console.log(`[1] ${fileName}: ${doc.numPages}p, 텍스트 ${text.length}자`)

// 2) 직군 스캔
let domain: DesignDomain
let secondary: DesignDomain[] = []
let docForm = classifyHeuristically({ fileName, text }).docForm
if (isDesignDomain(domainArg)) {
  domain = domainArg
} else {
  const scan = await scanDocumentWithClaude({ fileName, text, apiKey })
  domain = scan.domain; secondary = scan.secondary; docForm = scan.docForm
  console.log(`[2] 스캔(${scan.method}): ${DOMAIN_LABELS[domain]} (${Math.round(scan.confidence * 100)}%) 형식=${docForm} 키워드=${scan.keywords.join(", ")}`)
}
const tier = isModelTier(tierArg) ? tierArg : "basic"
const model = resolveModelId(tier)

// 3) 비교군 + 벡터 검색
if (excludeArg) {
  const selfId = excludeArg.split("=")[1]
  const { data: rel } = await supabase.from("portfolios").select("id").or(`id.eq.${selfId},duplicate_of.eq.${selfId}`)
  excludeIds.push(...(rel ?? []).map(r => r.id))
}
const reference = await loadReferenceSet(supabase, domain, excludeIds)
console.log(`[3] 비교군: ${DOMAIN_LABELS[domain]} ${reference.sameDomainCount}건 (카드 ${reference.cardedCount}건)${reference.insufficient ? " ⚠️표본 부족" : ""}`)

const embRes = await fetch("https://api.openai.com/v1/embeddings", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 2000), dimensions: 1536 }),
}).then(r => r.json())
const { data: chunks } = await supabase.rpc("match_portfolio_chunks", {
  query_embedding: JSON.stringify(embRes.data[0].embedding), match_threshold: 0.4, match_count: 15,
})
const companiesById = new Map(reference.all.map(p => [p.id, p.companies]))
const chunksFiltered = ((chunks ?? []) as { portfolio_id: string; chunk_text: string }[]).filter(c => !excludeIds.includes(c.portfolio_id))
const vectorSectionRaw = chunksFiltered.length
  ? `## 📝 유사 합격 포트폴리오 실제 내용 발췌\n\n${chunksFiltered.map((c, i) => `### 유사 사례 ${i + 1} (${(companiesById.get(c.portfolio_id) ?? []).join(", ")} 합격)\n${c.chunk_text}`).join("\n\n")}\n\n---\n단, 발췌에 나오는 게임 제목·고유명사·사람 이름은 응답에 절대 옮기지 마세요. 합격작은 구조로만 가리키세요.`
  : ""
const vectorSection = maskForPrompt(vectorSectionRaw, text)
console.log(`[3] 유사 발췌 ${chunksFiltered.length}청크${excludeIds.length ? ` (자기 자신·사본 ${excludeIds.length}건 제외)` : ""}`)

// 4) 모델 호출 (Files API → base64 폴백)
const system = buildSystemBlocks({ domain, secondary, docForm, mode: "pdf", reference, benchmarkSection: formatBenchmarkForPrompt(true), vectorSection, librarySection: "", keywords: [] })
const client = new Anthropic({ apiKey, maxRetries: 1 })
let fileId: string | null = null
let source: Anthropic.Beta.BetaContentBlockParam
try {
  const up = await client.beta.files.upload({ file: await toFile(buffer, fileName, { type: "application/pdf" }), betas: ["files-api-2025-04-14"] })
  fileId = up.id
  source = { type: "document", source: { type: "file", file_id: up.id } }
  console.log(`[4] Files API 업로드 OK`)
} catch (e) {
  console.log(`[4] Files API 실패 → base64: ${e instanceof Error ? e.message : e}`)
  source = { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } }
}
const started = Date.now()
const message = await client.beta.messages.stream({
  model,
  max_tokens: 32000,
  system,
  messages: [{ role: "user", content: [source, { type: "text", text: buildUserInstruction("pdf", fileName, `${(buffer.length / 1048576).toFixed(1)}MB`) }] }],
  ...(fileId ? { betas: ["files-api-2025-04-14"] } : {}),
  output_config: { effort: MODEL_TIERS[tier].effort },
}).finalMessage()
if (fileId) await client.beta.files.delete(fileId, { betas: ["files-api-2025-04-14"] }).catch(() => {})

const usage = summarizeUsage(model, message.usage, Date.now() - started)
logUsage(`테스트-${tier}`, usage)
console.log(`[4] stop_reason=${message.stop_reason}`)

// 5) 결과
const responseText = message.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map(b => b.text).join("")
const rawAnalysis = safeParseJSON(extractJsonBlock(responseText))
// 띄어쓰기 무시 비교 (anonymize.ts와 같은 기준 — PDF 추출 텍스트는 공백이 원본과 다르다)
const sq = (s: string) => s.replace(/\s+/g, "").toLowerCase()
const rawLeaks = (JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/standards/banned-terms.json"), "utf8")).games as string[]).filter(w => sq(JSON.stringify(rawAnalysis)).includes(sq(w)) && !sq(text).includes(sq(w)))
const { value: analysis, removed } = scrubOutput(rawAnalysis, text)
console.log(`[5] 모델 원응답 고유명: ${rawLeaks.length ? rawLeaks.join(", ") : "없음"} → 출력 단계에서 ${removed}건 제거`)
const outPath = pdfPath.replace(/\.pdf$/i, "") + ".analysis.json"
fs.writeFileSync(outPath, JSON.stringify({ domain, tier, model, usage, analysis }, null, 2))

const leakWords: string[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/standards/banned-terms.json"), "utf8")).games
// 사용자 문서 자체가 다루는 게임명은 누출이 아니다 — 사용자 문서 텍스트에 있는 단어는 제외
const flat = sq(JSON.stringify(analysis))
const ownText = sq(text)
const leaks = leakWords.filter(w => flat.includes(sq(w)) && !ownText.includes(sq(w)))
console.log(`\n=== 결과 (${outPath}) ===`)
console.log(`점수 ${analysis.score} | ${analysis.domainFit ?? ""}`)
console.log(`고유명 누출 검사: ${leaks.length ? "⚠️ " + leaks.join(", ") : "없음"}`)
