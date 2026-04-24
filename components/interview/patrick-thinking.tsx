import { Brain } from "lucide-react"

export default function PatrickThinking() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        {/* Character placeholder with floating animation */}
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-medium shadow-lg animate-float">
          <div className="text-center">
            <Brain className="w-8 h-8 mx-auto mb-2" />
            <div className="text-xs">평가 중</div>
          </div>
        </div>

        {/* Thinking dots animation */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Patrick이 답변을 분석하고 있습니다...</p>
    </div>
  )
}
