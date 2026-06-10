/**
 * 통합 서비스 3축 소개 — 분석 + 면접 + 라이브러리
 *   랜딩 페이지 hero 다음에 배치
 *
 * 🔒 면접·라이브러리는 현재 관리자 전용(준비 중)이므로,
 *    3축 소개 섹션도 관리자에게만 노출한다. 비관리자에겐 렌더하지 않음.
 */

import Link from "next/link"
import { FileSearch, Mic, Library, ArrowRight } from "lucide-react"
import { getLibraryStats } from "@/lib/library/loader"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"

export async function TripleFeatureSection() {
  // 면접·라이브러리가 포함된 섹션 — 관리자에게만 노출
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return null
  }

  const stats = await getLibraryStats()

  const cards = [
    {
      icon: <FileSearch className="w-7 h-7" />,
      tag: "포트폴리오 분석",
      title: "187명 합격 데이터로 점수·랭킹·피드백",
      desc: "Claude AI가 15개 카테고리로 분석. 8개 게임사 기준 비교. 문서에 없는 내용은 절대 칭찬하지 않습니다.",
      stat: "15개 카테고리",
      sub: "187명 합격 데이터",
      href: "/analyze",
      cta: "분석하기",
      accent: "#5B8DEF",
    },
    {
      icon: <Mic className="w-7 h-7" />,
      tag: "면접 연습",
      title: "현업 기획자가 만든 600문항으로 실전 연습",
      desc: "공통·시스템·UI·전투·캐릭터·레벨디자인 6개 카테고리. AI가 답변을 평가하고 꼬리 질문을 던집니다.",
      stat: "600문항",
      sub: "6개 카테고리",
      href: "/interview",
      cta: "면접 연습",
      accent: "#a855f7",
    },
    {
      icon: <Library className="w-7 h-7" />,
      tag: "게임 디자인 라이브러리",
      title: "사쿠라이·팀 케인 등 100+ 디자이너의 강연·인터뷰",
      desc: "원칙·패턴·안티패턴·학습경로·계보·장르 가이드를 주제별·디자이너별로 큐레이션. 분석 시 자동 인용됩니다.",
      stat: `${stats.totalDocuments.toLocaleString()}편`,
      sub: `${Object.keys(stats.byDesigner || {}).length}명 디자이너`,
      href: "/library",
      cta: "라이브러리 열기",
      accent: "#10b981",
    },
  ]

  return (
    <section className="bg-[#0a1628] py-16 md:py-24 border-t border-[#1e3a5f]">
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-[#5B8DEF]/10 border border-[#5B8DEF]/30 text-[#5B8DEF] mb-4">
            한 사이트, 3가지 도구
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-balance mb-3">
            포트폴리오부터 면접, 디자인 원칙 학습까지
          </h2>
          <p className="text-slate-400 text-lg">
            게임 기획자 지망생이 필요한 도구를 한 곳에.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group relative rounded-2xl border bg-slate-900/60 hover:bg-slate-900/80 p-6 md:p-7 transition-all overflow-hidden"
              style={{ borderColor: c.accent + "33" }}
            >
              <div
                className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-10 blur-3xl"
                style={{ background: c.accent }}
              />

              <div
                className="relative w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: c.accent + "1a", color: c.accent }}
              >
                {c.icon}
              </div>

              <div
                className="relative text-[10px] uppercase tracking-wider mb-2"
                style={{ color: c.accent }}
              >
                {c.tag}
              </div>
              <h3 className="relative text-xl font-bold text-white mb-3 leading-snug">{c.title}</h3>
              <p className="relative text-sm text-slate-400 leading-relaxed mb-5">{c.desc}</p>

              <div className="relative flex items-end justify-between pt-4 border-t border-[#1e3a5f]">
                <div>
                  <div className="text-2xl font-bold" style={{ color: c.accent }}>{c.stat}</div>
                  <div className="text-[11px] text-slate-500">{c.sub}</div>
                </div>
                <div
                  className="flex items-center gap-1 text-xs font-semibold group-hover:translate-x-0.5 transition-transform"
                  style={{ color: c.accent }}
                >
                  {c.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
