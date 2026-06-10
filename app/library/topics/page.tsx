/**
 * /library/topics — 주제별 분류 인덱스
 */

import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getLibraryStats } from "@/lib/library/loader"
import { Topic, TOPIC_COLORS, TOPIC_LABELS, TOPIC_ORDER } from "@/lib/library/types"

export const metadata: Metadata = {
  title: "주제별 분류 | 라이브러리 | Archive187",
}

const TOPIC_BLURBS: Record<Topic, string> = {
  combat: "히트스톱 · 콤보 · 보스전 · 스킬 설계 — 손맛과 응답성의 영역.",
  ui: "HUD · 메뉴 · 튜토리얼 · 가독성 — 정보 전달과 사용성의 영역.",
  character: "주인공 · 동반자 · NPC · 페르소나 — 인물 설계의 영역.",
  narrative: "스토리 · 대화 · 분기 · 환경 서사 — 의미와 정서의 영역.",
  enemy_ai: "보스 · 디렉터 · 절차적 NPC · 네메시스 — 대결 상대의 영역.",
  level: "맵 · 공간 · 탐험 · 메트로배니아 — 흐름과 공간의 영역.",
  system: "메카닉 · 루프 · 시너지 · 선택 — 게임을 게임답게 만드는 영역.",
  balance: "수치 · 경제 · 성장 · 난이도 — 튜닝의 영역.",
  live_service: "MMO · 운영 · 이벤트 · 메타 회전 — 시간을 살아남는 게임의 영역.",
  production: "팀 · 출시 · 디렉션 · 사전 제작 — 만들어내는 영역.",
}

export default async function TopicsIndexPage() {
  const stats = await getLibraryStats()

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-xs text-slate-500">라이브러리</div>
        <h1 className="text-3xl font-bold text-white">주제별 분류</h1>
        <p className="text-sm text-slate-400">
          5개 도메인을 넘어 실제 직무 영역으로 재분류. 한 원칙은 여러 주제에 속할 수 있다.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOPIC_ORDER.map((t) => {
          const count = stats.byTopic?.[t] || 0
          return (
            <Link
              key={t}
              href={`/library/topics/${t}`}
              className="group rounded-2xl border bg-slate-900/60 hover:bg-slate-900/80 p-5 transition-all"
              style={{ borderColor: TOPIC_COLORS[t] + "33" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-3xl font-bold" style={{ color: TOPIC_COLORS[t] }}>
                  {count}
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#5B8DEF] transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{TOPIC_LABELS[t]}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{TOPIC_BLURBS[t]}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
