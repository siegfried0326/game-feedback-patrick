/**
 * /library — 라이브러리 홈
 *   그래프 메인 + 인스턴트 검색 + 토픽/도메인/타입 필터 + 디자이너 TOP
 */

import type { Metadata } from "next"
import { getAllSummaries, getLibraryStats } from "@/lib/library/loader"
import { LibraryHome } from "@/components/library/library-home"

export const metadata: Metadata = {
  title: "게임 디자인 라이브러리 | Archive187",
  description:
    "사쿠라이·팀 케인·미야자키 등 100+ 디자이너의 강연·인터뷰에서 추출한 1,200+ 게임 디자인 자료. 주제·계보·장르별로 큐레이션된 통합 라이브러리.",
}

export default async function LibraryHomePage() {
  const [summaries, stats] = await Promise.all([
    getAllSummaries(),
    getLibraryStats(),
  ])
  return <LibraryHome summaries={summaries} stats={stats} />
}
