/**
 * 서비스 소개 섹션 — 랜딩 페이지 (153줄)
 *
 * 5가지 핵심 기능 소개: 15개 영역 분석, 회사별 비교, 맞춤 피드백, 빠른 분석, 이력 관리.
 * 미리보기 이미지 포함.
 * 사용: app/(landing)/page.tsx
 */
import { FileSearch, BarChart3, Target, Zap, History } from "lucide-react"
import Image from "next/image"

const features = [
  {
    icon: FileSearch,
    title: "15개 영역 정밀 분석",
    description: "기본 5개 + 게임디자인 10개 영역을 점수화하여 합격자와 비교합니다."
  },
  {
    icon: BarChart3,
    title: "점수 · 등급 · 회사별 비교",
    description: "종합 점수와 합격 가능성 등급, 넥슨·크래프톤 등 회사별 합격 평균과 비교합니다."
  },
  {
    icon: Target,
    title: "맞춤 개선 피드백",
    description: "각 영역별 강점과 약점을 분석하고, 구체적인 개선 방향을 제시합니다."
  },
  {
    icon: History,
    title: "버전별 점수 추적",
    description: "수정할 때마다 다시 분석하면 점수 변화를 그래프로 추적할 수 있습니다."
  },
  {
    icon: Zap,
    title: "즉시 분석",
    description: "업로드하면 AI가 즉시 분석합니다. 기다릴 필요 없이 바로 결과를 확인하세요."
  }
]

export function ServiceIntro() {
  return (
    <section id="service" className="py-20 px-6 bg-[#0a1628]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-[#5B8DEF] text-sm font-medium tracking-wide uppercase mb-4 block">
            Service
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 text-balance">
            어떤 분석을 받을 수 있나요?
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-pretty">
            합격 포트폴리오 187개를 학습한 <span className="text-[#5B8DEF]">Claude AI</span>가<br className="hidden sm:block" />
            여러분의 기획서를 즉시 정밀 분석합니다.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-slate-900/80 p-6 rounded-2xl border border-[#1e3a5f] hover:border-[#5B8DEF]/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-[#5B8DEF]/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-[#5B8DEF]" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* 버전별 점수 추적 스크린샷 */}
        <div className="mt-12 bg-slate-900/80 rounded-2xl border border-[#1e3a5f] p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
                <History className="w-3 h-3" />
                버전 관리
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">
                수정할 때마다<br />점수가 오르는 걸 확인하세요
              </h3>
              <p className="text-slate-400 leading-relaxed mb-4">
                문서를 수정하고 다시 분석하면, 이전 버전과 점수를 비교할 수 있습니다.
                어떤 수정이 점수를 올렸는지 한눈에 파악하세요.
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5B8DEF]" />
                  종합 점수 변화 그래프
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  영역별 점수 변화 추적
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  버전별 상세 비교 테이블
                </li>
              </ul>
            </div>
            <div className="relative rounded-xl overflow-hidden border border-[#1e3a5f]">
              <Image
                src="/preview-history.png"
                alt="버전별 점수 비교 기능"
                width={2002}
                height={780}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>

        <div className="mt-16 bg-slate-900/80 rounded-2xl border border-[#1e3a5f] p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">
                이런 분들께 추천합니다
              </h3>
              <ul className="space-y-3">
                {[
                  "포트폴리오 준비 중인 취업 준비생",
                  "기획서 작성에 자신이 없는 분",
                  "혼자 준비하며 방향성이 불안한 분",
                  "내 기획서의 객관적인 수준이 궁금한 분",
                  "수정할 때마다 점수 변화를 추적하고 싶은 분"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5B8DEF] mt-2 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-[#5B8DEF]/5 to-[#5B8DEF]/10 rounded-xl p-6 border border-[#5B8DEF]/20">
              <div className="text-center">
                <div className="text-5xl font-bold text-[#5B8DEF] mb-2">187</div>
                <p className="text-slate-400 text-sm">합격 포트폴리오 학습 데이터</p>
              </div>
              <div className="h-px bg-[#1e3a5f] my-6" />
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">즉시</div>
                  <p className="text-slate-400 text-xs">분석 완료 시간</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">15개</div>
                  <p className="text-slate-400 text-xs">분석 영역</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
