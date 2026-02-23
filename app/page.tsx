import { AuthHeader } from "@/components/auth-header"
import { HeroSection } from "@/components/hero-section"
import { WhyChooseUs } from "@/components/why-choose-us"
import { AIComparison } from "@/components/ai-comparison"
import { ServiceIntro } from "@/components/service-intro"
import { HowItWorks } from "@/components/how-it-works"
import { PricingSection } from "@/components/pricing-section"
import { FAQSection } from "@/components/faq-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"
import { MarketingBreak } from "@/components/marketing-break"

export default function FeedbackLandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <AuthHeader />
      <HeroSection />

      <MarketingBreak
        headline="187개의 합격. 그 안에 답이 있습니다."
        accent="blue"
      />

      <WhyChooseUs />

      <MarketingBreak
        headline="칭찬은 GPT에게. 합격은 여기서."
        sub="어떤 기획서를 넣어도 &quot;구조가 좋다&quot;는 AI 말고, 당신이 왜 떨어지는지 말해주는 AI."
        accent="white"
      />

      <AIComparison />

      <MarketingBreak
        headline="같은 AI. 다른 데이터. 완전히 다른 결과."
        accent="blue"
      />

      <ServiceIntro />
      <HowItWorks />

      <MarketingBreak
        headline="시작은 무료. 결과는 확실하게."
        sub="첫 2회 분석은 무료입니다. 직접 확인해보세요."
        accent="white"
      />

      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </main>
  )
}
