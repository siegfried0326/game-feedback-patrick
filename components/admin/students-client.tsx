/**
 * 수강생 크레딧 지급 — 클라이언트 컴포넌트
 *
 * 검색(이메일) → 사용자 행마다 지급량 입력 + 지급/회수 + 수강생 토글.
 * 하단에 최근 지급 이력 50건.
 */
"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, Search, GraduationCap, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  searchUsers,
  grantCredits,
  setStudentStatus,
  getRecentGrants,
  type StudentUserRow,
  type GrantHistoryRow,
} from "@/app/actions/student-admin"
import { STUDENT_MONTHLY_CREDITS } from "@/lib/tutoring-config"

function formatDate(iso: string | null) {
  if (!iso) return "-"
  return new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" })
}

export function StudentsAdminClient() {
  const [query, setQuery] = useState("")
  const [users, setUsers] = useState<StudentUserRow[]>([])
  const [grants, setGrants] = useState<GrantHistoryRow[]>([])
  const [message, setMessage] = useState("")
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function refresh(q: string = query) {
    startTransition(async () => {
      const [userResult, grantResult] = await Promise.all([searchUsers(q), getRecentGrants()])
      if (userResult.error) setMessage(userResult.error)
      else setUsers(userResult.users || [])
      if (grantResult.grants) setGrants(grantResult.grants)
    })
  }

  useEffect(() => { refresh("") }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleGrant(userId: string, sign: 1 | -1) {
    const raw = amounts[userId] ?? String(STUDENT_MONTHLY_CREDITS)
    const amount = parseInt(raw, 10)
    if (Number.isNaN(amount) || amount <= 0) {
      setMessage("지급량은 1 이상의 숫자여야 합니다.")
      return
    }
    startTransition(async () => {
      const result = await grantCredits(userId, sign * amount, notes[userId] || undefined)
      if (result.error) setMessage(result.error)
      else {
        setMessage(`✅ ${sign > 0 ? "지급" : "회수"} 완료 (현재 잔액: ${result.credits}크레딧)`)
        refresh()
      }
    })
  }

  function handleToggleStudent(userId: string, next: boolean) {
    startTransition(async () => {
      const result = await setStudentStatus(userId, next)
      if (result.error) setMessage(result.error)
      else refresh()
    })
  }

  return (
    <div className="space-y-8">
      {/* 검색 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") refresh() }}
            placeholder="이메일 검색 (비워두면 수강생 전체)"
            className="w-full bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#5B8DEF]"
          />
        </div>
        <Button onClick={() => refresh()} disabled={isPending} className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "검색"}
        </Button>
      </div>

      {message && (
        <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5">
          {message}
        </div>
      )}

      {/* 사용자 목록 */}
      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0d1f3c] text-slate-400 text-xs">
            <tr>
              <th className="text-left px-4 py-3 font-medium">이메일</th>
              <th className="text-center px-2 py-3 font-medium">수강생</th>
              <th className="text-right px-2 py-3 font-medium">잔여 크레딧</th>
              <th className="text-center px-2 py-3 font-medium">최근 지급</th>
              <th className="text-right px-4 py-3 font-medium">지급</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e3a5f]">
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {isPending ? "불러오는 중..." : "결과 없음 — 이메일로 검색하거나, 수강생을 지정하세요."}
                </td>
              </tr>
            )}
            {users.map(u => (
              <tr key={u.userId} className="bg-slate-900/40">
                <td className="px-4 py-3 text-white">{u.email}</td>
                <td className="px-2 py-3 text-center">
                  <button
                    onClick={() => handleToggleStudent(u.userId, !u.isStudent)}
                    disabled={isPending}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                      u.isStudent
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                        : "bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300"
                    }`}
                    title={u.isStudent ? "클릭하여 수강생 해제" : "클릭하여 수강생 지정"}
                  >
                    <GraduationCap className="w-3 h-3" />
                    {u.isStudent ? "수강생" : "일반"}
                  </button>
                </td>
                <td className="px-2 py-3 text-right text-white font-medium">{u.credits}</td>
                <td className="px-2 py-3 text-center text-slate-400 text-xs">{formatDate(u.lastGrantAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <input
                      value={amounts[u.userId] ?? String(STUDENT_MONTHLY_CREDITS)}
                      onChange={e => setAmounts(prev => ({ ...prev, [u.userId]: e.target.value.replace(/\D/g, "") }))}
                      className="w-14 bg-[#0d1f3c] border border-[#1e3a5f] rounded px-2 py-1 text-right text-white text-xs focus:outline-none focus:border-[#5B8DEF]"
                    />
                    <input
                      value={notes[u.userId] ?? ""}
                      onChange={e => setNotes(prev => ({ ...prev, [u.userId]: e.target.value }))}
                      placeholder="메모"
                      className="w-24 bg-[#0d1f3c] border border-[#1e3a5f] rounded px-2 py-1 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-[#5B8DEF]"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleGrant(u.userId, 1)}
                      disabled={isPending}
                      className="h-7 px-2.5 text-xs bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white"
                    >
                      지급
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGrant(u.userId, -1)}
                      disabled={isPending}
                      className="h-7 px-2 text-xs border-[#1e3a5f] text-slate-400 hover:text-red-400"
                    >
                      회수
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 지급 이력 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">최근 지급 이력</h2>
          <button onClick={() => refresh()} className="text-xs text-slate-500 hover:text-slate-300 inline-flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> 새로고침
          </button>
        </div>
        <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0d1f3c] text-slate-400 text-xs">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">일시</th>
                <th className="text-left px-2 py-2.5 font-medium">이메일</th>
                <th className="text-right px-2 py-2.5 font-medium">크레딧</th>
                <th className="text-left px-4 py-2.5 font-medium">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3a5f]">
              {grants.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">지급 이력이 없습니다.</td></tr>
              )}
              {grants.map(g => (
                <tr key={g.id} className="bg-slate-900/40">
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{new Date(g.createdAt).toLocaleString("ko-KR")}</td>
                  <td className="px-2 py-2.5 text-white">{g.email}</td>
                  <td className={`px-2 py-2.5 text-right font-medium ${g.credits > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {g.credits > 0 ? `+${g.credits}` : g.credits}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{g.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
