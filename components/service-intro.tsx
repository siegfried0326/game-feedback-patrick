import { FileSearch, MessageSquareText, Target, Zap } from "lucide-react"

const features = [
  {
    icon: FileSearch,
    title: "문서 구조 분석",
    description: "기획서의 논리적 흐름과 구조를 분석하여 면접관 관점에서의 개선점을 제안합니다."
  },
  {
    icon: MessageSquareText,
    title: "상세한 코멘트",
    description: "단순한 수정 제안이 아닌, 왜 그렇게 해야 하는지 이유와 함께 설명드립니다."
  },
  {
    icon: Target,
    title: "포지션별 맞춤 피드백",
    description: "시스템, 콘텐츠, 레벨디자인 등 지원 포지션에 맞는 관점으로 피드백합니다."
  },
  {
    icon: Zap,
    title: "빠른 응답",
    description: "업로드 후 24시간 내에 피드백을 받아보실 수 있습니다."
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
            어떤 피드백을 받을 수 있나요?
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-pretty">
            PATRICK 강의에서 제공하는 동일한 품질의 피드백을<br className="hidden sm:block" />
            구독 서비스로 언제든지 받아보실 수 있습니다.
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
                  "빠른 피드백으로 효율적인 준비를 원하는 분",
                  "현업 기획자의 관점이 궁금한 분"
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
                <div className="text-5xl font-bold text-[#5B8DEF] mb-2">300+</div>
                <p className="text-slate-400 text-sm">누적 피드백 문서</p>
              </div>
              <div className="h-px bg-[#1e3a5f] my-6" />
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">24h</div>
                  <p className="text-slate-400 text-xs">평균 응답 시간</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">4.9</div>
                  <p className="text-slate-400 text-xs">만족도 평점</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
