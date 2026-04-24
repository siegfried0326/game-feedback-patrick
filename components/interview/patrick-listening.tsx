import { Mic } from "lucide-react"

export default function PatrickListening() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative">
        {/* Character placeholder with pulse animation */}
        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium shadow-lg">
          <div className="text-center">
            <Mic className="w-8 h-8 mx-auto mb-2" />
            <div className="text-xs">듣는 중</div>
          </div>
        </div>

        {/* Pulse animation rings */}
        <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
        <div
          className="absolute inset-0 rounded-full bg-blue-500/20 animate-pulse"
          style={{ animationDelay: "0.5s" }}
        />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Patrick이 답변을 듣고 있습니다...</p>
    </div>
  )
}
