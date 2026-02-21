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

export default function FeedbackLandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <AuthHeader />
      <HeroSection />
      <WhyChooseUs />
      <AIComparison />
      <ServiceIntro />
      <HowItWorks />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </main>
  )
}
