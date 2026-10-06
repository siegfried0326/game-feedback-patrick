// 기준 카드 검증: 형식 · 표준 어휘 · 익명성 (DB 반영 전 실행)
//
// 사용: node scripts/validate-cards.mjs [--fix-vocab]
//   --fix-vocab: 표준 어휘에 없는 artifacts/standard_elements 키를 제거
//
// 익명성 검사: anon_label / structure / why_it_works 에
//   - 모든 카드의 gameTitle에서 뽑은 게임·프로젝트명
//   - 회사명, 수강생 이름 (~/Dev-local/portfolios-source/index.json)
// 이 들어 있으면 실패로 보고한다. (사용자 피드백에 합격작을 특정하면 안 됨 — data/standards/README.md)

import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const DIR = path.join(process.cwd(), "data/standards/cards")
const README = fs.readFileSync(path.join(process.cwd(), "data/standards/README.md"), "utf8")
const FIX = process.argv.includes("--fix-vocab")

// README의 표준 어휘 섹션에서 `key` 추출
function vocab(sectionTitle) {
  const start = README.indexOf(sectionTitle)
  const end = README.indexOf("\n### ", start + 1) > -1 ? README.indexOf("\n### ", start + 1) : README.indexOf("\n## ", start + 1)
  const body = README.slice(start, end > -1 ? end : undefined)
  return new Set([...body.matchAll(/`([a-z_]+)`/g)].map(m => m[1]))
}
const ARTIFACTS = vocab("### artifacts 표준 어휘")
const ELEMENTS = vocab("### standard_elements 표준 어휘")
const DOMAINS = new Set(["level", "combat", "system", "economy", "uiux", "narrative", "data", "general"])
const FORMS = new Set(["reverse", "original", "proposal", "analysis", "table", "pr"])
const REQUIRED = ["id", "domain", "docForm", "anon_label", "structure", "depth", "why_it_works", "standard_elements"]  // artifacts는 얇은 문서(1~2p)에서 비어 있을 수 있음

const cards = fs.readdirSync(DIR).filter(f => f.endsWith(".json")).map(f => ({ f, c: JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) }))

// 금지어: 큐레이션된 게임·IP·고유 콘텐츠명(data/standards/banned-terms.json) + 회사명 + 수강생 이름
const banned = new Set(["넥슨", "엔씨", "엔씨소프트", "넷마블", "크래프톤", "스마일게이트", "펄어비스", "네오위즈", "웹젠", "매드엔진"])
for (const t of JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/standards/banned-terms.json"), "utf8")).games) banned.add(t)
try {
  const idx = JSON.parse(fs.readFileSync(path.join(os.homedir(), "Dev-local/portfolios-source/index.json"), "utf8"))
  for (const r of idx) {
    const s = r.student.replace(/\(.*?\)/g, "").trim()
    if (/^[가-힣]{2,4}$/.test(s)) banned.add(s)
  }
} catch { /* 로컬 색인 없으면 이름 검사 생략 */ }

let errors = 0, fixed = 0
const byDomain = {}
for (const { f, c } of cards) {
  if (c.duplicate_of) {
    if (!cards.some(x => x.c.id === c.duplicate_of)) console.log(`⚠️ ${f}: 원본 카드 없음 (${c.duplicate_of})`)
    continue
  }
  const problems = []
  for (const k of REQUIRED) if (c[k] === undefined || c[k] === null || (Array.isArray(c[k]) && c[k].length === 0)) problems.push(`필드 누락: ${k}`)
  if (!DOMAINS.has(c.domain)) problems.push(`domain 오류: ${c.domain}`)
  if (!FORMS.has(c.docForm)) problems.push(`docForm 오류: ${c.docForm}`)
  if ("student" in c) problems.push("student 필드 존재")
  const badA = (c.artifacts ?? []).filter(k => !ARTIFACTS.has(k))
  const badE = (c.standard_elements ?? []).filter(k => !ELEMENTS.has(k))
  if (badA.length || badE.length) {
    if (FIX) {
      c.artifacts = (c.artifacts ?? []).filter(k => ARTIFACTS.has(k))
      c.standard_elements = (c.standard_elements ?? []).filter(k => ELEMENTS.has(k))
      fs.writeFileSync(path.join(DIR, f), JSON.stringify(c, null, 1))
      fixed++
    } else problems.push(`어휘 밖 키: ${[...badA, ...badE].join(", ")}`)
  }
  const publicText = [c.anon_label, ...(c.structure ?? []), ...(c.why_it_works ?? [])].join(" ")
  const leaks = [...banned].filter(w => publicText.includes(w))
  if (leaks.length) problems.push(`🚫 고유명 누출: ${leaks.join(", ")}`)
  if (problems.length) { errors++; console.log(`❌ ${f.slice(0, 8)} ${c.file_name ?? ""}\n   ${problems.join("\n   ")}`) }
  byDomain[c.domain] = (byDomain[c.domain] ?? 0) + 1
}
console.log(`\n카드 ${cards.filter(x => !x.c.duplicate_of).length}건 + 사본 ${cards.filter(x => x.c.duplicate_of).length}건 | 문제 ${errors}건${FIX ? ` | 어휘 자동 정리 ${fixed}건` : ""}`)
console.log("직군별:", Object.entries(byDomain).sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d} ${n}`).join(" · "))
process.exit(errors ? 1 : 0)
