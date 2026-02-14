import { Upload, Clock, MessageCircle, RotateCcw } from "lucide-react"

const steps = [
  {
    icon: Upload,
    step: "01",
    title: "문서 업로드",
    description: "시스템 기획서, 콘텐츠 기획서, 레벨 디자인 문서 등 피드백 받고 싶은 문서를 업로드합니다."
  },
  {
    icon: Clock,
    step: "02",
    title: "검토 진행",
    description: "현업 기획자가 직접 문서를 검토하고 상세한 피드백을 작성합니다."
  },
  {
    icon: MessageCircle,
    step: "03",
    title: "피드백 확인",
    description: "24시간 내에 상세한 피드백과 함께 개선 방향을 전달받습니다."
  },
  {
    icon: RotateCcw,
    step: "04",
    title: "수정 후 재업로드",
    description: "피드백을 반영하여 수정한 문서를 다시 업로드하면 추가 피드백을 받을 수 있습니다."
  }
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6 bg-[#0d1f3c]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-[#5B8DEF] text-sm font-medium tracking-wide uppercase mb-4 block">
            How it works
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 text-balance">
            이용 방법
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            간단한 4단계로 전문적인 피드백을 받아보세요
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-px border-t-2 border-dashed border-[#1e3a5f]" />
              )}
              <div className="relative bg-slate-900/80 rounded-2xl p-6 border border-[#1e3a5f] hover:border-[#5B8DEF]/30 transition-colors">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-[#5B8DEF] flex items-center justify-center shrink-0">
                    <step.icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-4xl font-bold text-[#5B8DEF]/20">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-slate-400 mb-4">
            구독 기간 동안 <span className="text-white font-medium">무제한</span>으로 문서를 업로드하고 피드백을 받을 수 있습니다.
          </p>
        </div>
      </div>
    </section>
  )
}
