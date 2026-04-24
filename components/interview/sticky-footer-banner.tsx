"use client"

import { useState, useEffect } from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function StickyFooterBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Show banner after scrolling 100px
      if (window.scrollY > 100) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-black text-white py-3 px-4 md:px-8 shadow-lg transition-all duration-500 ease-out z-50 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="text-sm md:text-base">
          <span className="font-semibold">Created by Patrick.</span>
          <span className="ml-2 text-gray-300">게임 기획의 본질을 배웁니다.</span>
        </div>
        <Button asChild variant="secondary" size="sm" className="bg-white text-black hover:bg-gray-200 font-medium">
          <a href="#" target="_blank" rel="noopener noreferrer">
            강의 알아보기
            <ArrowRight className="w-4 h-4 ml-2" />
          </a>
        </Button>
      </div>
    </div>
  )
}
