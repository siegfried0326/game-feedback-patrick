interface MarketingBreakProps {
  headline: string
  sub?: string
  accent?: "blue" | "red" | "white"
}

export function MarketingBreak({ headline, sub, accent = "white" }: MarketingBreakProps) {
  const accentColor = {
    blue: "text-[#5B8DEF]",
    red: "text-red-400",
    white: "text-white",
  }[accent]

  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-[#0a1628] to-[#0d1f3c]">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <p className={`text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-tight ${accentColor}`}>
          {headline}
        </p>
        {sub && (
          <p className="text-lg md:text-xl text-slate-400 mt-6 leading-relaxed">
            {sub}
          </p>
        )}
      </div>
    </section>
  )
}
