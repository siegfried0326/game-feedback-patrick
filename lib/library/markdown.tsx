/**
 * 라이브러리 마크다운 렌더링 — 위키링크를 내부 Link로 변환.
 *
 * react-markdown에 입력하기 전에 본문을 전처리:
 *   `[[target|display]]` 또는 `[[target]]` →
 *     해결된 경우: `[display](INTERNAL_URL)`
 *     미해결: `**target**` (Obsidian 외부 링크처럼 처리)
 */

import { resolveWikilink } from "./loader"

/**
 * 본문 내 모든 위키링크를 미리 해석하여 마크다운 링크로 치환.
 * 서버 컴포넌트에서 호출 (async).
 */
export async function expandWikilinks(body: string): Promise<string> {
  const matches: { match: string; target: string; display: string | null }[] = []
  const re = /\[\[([^\]\n]+?)\]\]/g
  let m
  while ((m = re.exec(body)) !== null) {
    const raw = m[1].trim()
    let target = raw
    let display: string | null = null
    if (raw.includes("|")) {
      const [t, d] = raw.split("|", 2)
      target = t.trim()
      display = d.trim()
    }
    if (target.includes("#")) target = target.split("#")[0].trim()
    matches.push({ match: m[0], target, display })
  }

  // 모든 위키링크를 한 번에 해석
  const resolutions = await Promise.all(
    matches.map(async (m) => {
      const r = await resolveWikilink(m.target)
      return { ...m, resolved: r }
    })
  )

  let out = body
  for (const item of resolutions) {
    const label = item.display || item.target
    let replacement: string
    if (item.resolved) {
      replacement = `[${label}](${item.resolved.url})`
    } else {
      // 미해결 — 회색으로 표시 (HTML span으로 처리, rehype-raw 미사용 시 그냥 굵게)
      replacement = `**${label}**`
    }
    // 동일 매치가 본문에 여러 번 등장할 수 있으니 분할-결합
    out = out.split(item.match).join(replacement)
  }

  return out
}
