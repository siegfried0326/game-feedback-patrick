// 합격 포트폴리오 DB 재구축: 원문 텍스트 + 기준 카드 → portfolios
//
// 사용:
//   node --env-file=.env.local scripts/seed-standards.mjs            # 미리보기 (DB 안 건드림)
//   node --env-file=.env.local scripts/seed-standards.mjs --apply    # 실제 반영 (SUPABASE_SERVICE_ROLE_KEY 필요)
//
// 입력:
//   ~/Dev-local/portfolios-source/text/<id>.txt   — 원문 추출 텍스트 (extract.mjs)
//   ~/Dev-local/portfolios-source/index.json      — 수강생 이름 목록(개인정보 제거용)
//   data/standards/cards/<id>.json                — 기준 카드
//
// 하는 일 (행마다):
//   - content_text  ← 원문 텍스트에서 작성자 이름·이메일·전화번호 제거 (최대 60,000자)
//   - standard_card ← 카드 JSON에서 내부 식별 필드(file_name, student, gameTitle, notes) 제외
//   - anon_label, design_domain, card_status, duplicate_of, content_source
//   - strengths/weaknesses/summary(Gemini)는 건드리지 않는다 — 코드가 더 이상 weaknesses를 쓰지 않음
//
// 원문 텍스트는 수강생 저작물이라 리포지토리에 두지 않는다 (로컬 폴더 → DB 직행).

import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const APPLY = process.argv.includes("--apply")
const SRC = path.join(os.homedir(), "Dev-local/portfolios-source")
const CARDS = path.join(process.cwd(), "data/standards/cards")
const MAX_CHARS = 60_000

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (APPLY && !key) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY가 .env.local에 없습니다. Supabase 대시보드 → Settings → API → service_role 키를 추가하세요.")
  process.exit(1)
}

// ── 개인정보 제거 ──
const index = JSON.parse(fs.readFileSync(path.join(SRC, "index.json"), "utf8"))
const NOT_NAMES = new Set(["기획서", "몬스터", "분석서", "시스템", "제안서", "테이블"])
const names = new Set(["류천복"])
for (const r of index) {
  const s = r.student.replace(/\(.*?\)/g, "").trim()
  if (/^[가-힣]{2,4}$/.test(s)) names.add(s)
  const m = r.file_name.normalize("NFC").match(/_([가-힣]{3})(?:\s*복사본)?(?:\(\d+\))?\.(pdf|xlsx)/)
  if (m && !NOT_NAMES.has(m[1])) names.add(m[1])
}
for (const n of NOT_NAMES) names.delete(n)
// 이름은 글자 사이 공백도 허용 ("이 선 민" — PDF 추출 시 자간이 넓으면 이렇게 나옴)
const nameRx = new RegExp(
  [...names].sort((a, b) => b.length - a.length).map(n => [...n].join("\\s*")).join("|"),
  "g"
)
const emailRx = /[\w.+-]+@[\w-]+\.[\w.]+/g
// 전화번호: 구분자 양옆 공백 허용 ("010 - 2964 - 9051"), 국가번호 +82 포함
const phoneRx = /(\+82[\s-]*)?0?1[016789]\s*[-.)\s]\s*\d{3,4}\s*[-.\s]\s*\d{4}/g
const authorLineRx = /^(작성자|성명|이름|Name)\s*[:：]?\s*\[?(작성자)\]?\s*$/gm

function scrub(text) {
  return text
    // PostgreSQL text는 NULL(\u0000)과 기타 제어문자를 받지 않는다 (일부 PDF 추출 결과에 섞여 있음)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(emailRx, "[이메일]")
    .replace(phoneRx, "[전화번호]")
    .replace(nameRx, "[작성자]")
    .replace(authorLineRx, "")
}

// ── 카드 ──
const cards = new Map()
for (const f of fs.readdirSync(CARDS).filter(f => f.endsWith(".json"))) {
  const c = JSON.parse(fs.readFileSync(path.join(CARDS, f), "utf8"))
  cards.set(c.id, c)
}
const INTERNAL_FIELDS = ["file_name", "student", "gameTitle", "notes", "companies", "id", "status", "anon_label", "duplicate_of"]
function publicCard(c) {
  const out = {}
  for (const [k, v] of Object.entries(c)) if (!INTERNAL_FIELDS.includes(k)) out[k] = v
  // why_it_works 안의 고유명사 방지: 카드 작성 규약상 게임명은 쓰지 않지만 한 번 더 이름 제거
  if (Array.isArray(out.why_it_works)) out.why_it_works = out.why_it_works.map(scrub)
  if (Array.isArray(out.structure)) out.structure = out.structure.map(scrub)
  return out
}

// ── 행 구성 ──
const rows = []
for (const r of index) {
  const tp = path.join(SRC, "text", `${r.id}.txt`)
  const raw = fs.existsSync(tp) ? fs.readFileSync(tp, "utf8") : ""
  const text = scrub(raw).slice(0, MAX_CHARS)
  const card = cards.get(r.id)
  const primary = card?.duplicate_of ? cards.get(card.duplicate_of) : card
  const row = {
    id: r.id,
    content_text: text.length >= 50 ? text : null,
    content_source: text.length >= 50 ? "original_2026-10" : null,
    card_status: card ? (card.status === "reviewed" ? "reviewed" : "draft") : "none",
    duplicate_of: card?.duplicate_of ?? null,
  }
  if (primary && !primary.duplicate_of) {
    row.standard_card = publicCard(primary)
    row.anon_label = primary.anon_label ?? null
    row.design_domain = primary.domain ?? null
  }
  rows.push({ row, file_name: r.file_name, rawLen: raw.length })
}

// ── 미리보기 ──
const withText = rows.filter(x => x.row.content_text).length
const withCard = rows.filter(x => x.row.standard_card).length
const dups = rows.filter(x => x.row.duplicate_of).length
const leaks = rows.filter(x => {
  const t = x.row.content_text
  return t && (new RegExp(nameRx.source).test(t) || new RegExp(emailRx.source).test(t))
}).length
console.log(`대상 ${rows.length}건 | 원문 ${withText}건 | 카드 ${withCard}건 | 중복 표시 ${dups}건 | 제거 후 이름·이메일 잔존 ${leaks}건`)
console.log(`제거 대상 이름 ${names.size}명`)
const sample = rows.find(x => x.row.standard_card)
if (sample) console.log("카드 예시:", sample.file_name, "→", sample.row.anon_label)

if (!APPLY) {
  console.log("\n미리보기만 했습니다. 반영하려면 --apply (SUPABASE_SERVICE_ROLE_KEY 필요)")
  process.exit(0)
}

// ── 반영 (REST PATCH, 행 단위) ──
let ok = 0, fail = 0
for (const { row, file_name } of rows) {
  const { id, ...body } = row
  const res = await fetch(`${url}/rest/v1/portfolios?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      // 레거시 service_role(JWT, eyJ…)만 Authorization에 실어 보낸다. 새 형식 sb_secret_ 키는 apikey 헤더만 쓴다.
      ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  })
  if (res.ok) ok++
  else { fail++; console.error(`❌ ${file_name}: ${res.status} ${await res.text()}`) }
}
console.log(`\n완료: 성공 ${ok}, 실패 ${fail}`)
console.log("다음: SQL Editor에서 DELETE FROM public.portfolio_chunks; → 관리자 페이지 '임베딩 생성'(force)로 원문 기준 재임베딩")
