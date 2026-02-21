import { FileSearch, BarChart3, Target, Zap } from "lucide-react"

const features = [
  {
    icon: FileSearch,
    title: "5개 영역 정밀 분석",
    description: "구조, 논리, 창의성, 실현성, 표현력 — 5개 핵심 영역을 레이더 차트로 분석합니다."
  },
  {
    icon: BarChart3,
    title: "점수 · 등급 · 랭킹",
    description: "종합 점수와 S~D 등급을 부여하고, 다른 지원자 대비 상위 몇 %인지 보여줍니다."
  },
  {
    icon: Target,
    title: "맞춤 개선 피드백",
    description: "각 영역별 강점과 약점을 분석하고, 구체적인 개선 방향을 제시합니다."
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
            합격 포트폴리오 100개를 학습한 AI가<br className="hidden sm:block" />
            여러분의 기획서를 즉시 정밀 분석합니다.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <div className="text-5xl font-bold text-[#5B8DEF] mb-2">100+</div>
                <p className="text-slate-400 text-sm">합격 포트폴리오 학습 데이터</p>
              </div>
              <div className="h-px bg-[#1e3a5f] my-6" />
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">즉시</div>
                  <p className="text-slate-400 text-xs">분석 완료 시간</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">5개</div>
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
