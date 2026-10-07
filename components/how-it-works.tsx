/**
 * 이용 방법 섹션 — 랜딩 페이지 (80줄)
 *
 * 4단계 이용 안내: 프로젝트 생성 → 파일 업로드 → AI 분석 → 이력 비교.
 * 각 단계별 아이콘 + 제목 + 설명.
 * 사용: app/(landing)/page.tsx
 */
import { Upload, Zap, BarChart3, FolderKanban } from "lucide-react"

const steps = [
  {
    icon: Upload,
    step: "01",
    title: "프로젝트 생성",
    description: "지원할 회사나 주제별로 프로젝트를 만들고, 기획서를 업로드합니다."
  },
  {
    icon: Zap,
    step: "02",
    title: "AI 즉시 분석",
    description: "합격 포트폴리오 187개를 학습한 AI가 즉시 문서를 분석합니다. 기다릴 필요 없습니다."
  },
  {
    icon: BarChart3,
    step: "03",
    title: "점수 · 등급 확인",
    description: "종합 점수, 합격 문서 기준 위치, 기본 역량 차트, 이전 버전 대비 변화를 확인합니다."
  },
  {
    icon: FolderKanban,
    step: "04",
    title: "수정 후 재분석",
    description: "피드백을 반영해 수정한 문서를 같은 프로젝트에 재업로드하면 점수 변화를 추적할 수 있습니다."
  }
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6 bg-card">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-primary text-sm font-medium tracking-wide uppercase mb-4 block">
            How it works
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4 text-balance">
            이용 방법
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            업로드하면 AI가 즉시 분석합니다. 간단한 4단계로 시작하세요
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-px border-t-2 border-dashed border-border" />
              )}
              <div className="relative bg-card rounded-2xl p-6 border border-border hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center shrink-0">
                    <step.icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-4xl font-bold text-primary/20">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">
            첫 분석은 <span className="text-foreground font-medium">무료</span>, 프로젝트는 <span className="text-foreground font-medium">제한 없이 무료</span>로 만들 수 있어요.
          </p>
        </div>
      </div>
    </section>
  )
}
