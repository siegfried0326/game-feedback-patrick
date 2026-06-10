/**
 * 면접 질문 관리 클라이언트 — 카테고리 탭 + 검색 + 행별 삭제 + 일괄 삭제
 */
"use client"

import { useMemo, useState, useTransition } from "react"
import { Trash2, Search, AlertTriangle, CheckSquare, Square } from "lucide-react"
import {
  deleteInterviewQuestion,
  bulkDeleteInterviewQuestions,
  InterviewQuestionRow,
} from "@/app/actions/interview-admin"

const DIFFICULTY_COLOR: Record<string, string> = {
  초급: "#10b981",
  중급: "#f59e0b",
  고급: "#ef4444",
}

interface Props {
  byCategory: Record<string, InterviewQuestionRow[]>
}

export function InterviewAdminClient({ byCategory: initialByCategory }: Props) {
  const [byCategory, setByCategory] = useState(initialByCategory)
  const categories = Object.keys(byCategory)
  const [category, setCategory] = useState(categories[0] || "")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const rows = byCategory[category] || []
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.question.toLowerCase().includes(q))
  }, [rows, query])

  function toggleSelect(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function selectAllVisible() {
    const next = new Set(selected)
    for (const r of filtered) next.add(r.id)
    setSelected(next)
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function handleDelete(id: number) {
    if (!confirm("이 질문을 삭제할까요? 복원하려면 시드 SQL을 다시 실행해야 합니다.")) return
    startTransition(async () => {
      setError(null)
      const res = await deleteInterviewQuestion(id)
      if (!res.success) {
        setError(res.error || "삭제 실패")
        return
      }
      setByCategory((prev) => ({
        ...prev,
        [category]: (prev[category] || []).filter((r) => r.id !== id),
      }))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    })
  }

  function handleBulkDelete() {
    const ids = Array.from(selected)
    if (!ids.length) return
    if (!confirm(`${ids.length}개 질문을 일괄 삭제할까요?`)) return
    startTransition(async () => {
      setError(null)
      const res = await bulkDeleteInterviewQuestions(ids)
      if (!res.success) {
        setError(res.error || "삭제 실패")
        return
      }
      setByCategory((prev) => ({
        ...prev,
        [category]: (prev[category] || []).filter((r) => !selected.has(r.id)),
      }))
      setSelected(new Set())
    })
  }

  return (
    <div className="space-y-4">
      {/* 카테고리 탭 */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => {
          const count = byCategory[c]?.length || 0
          const active = c === category
          return (
            <button
              key={c}
              onClick={() => { setCategory(c); clearSelection() }}
              className={
                "text-sm px-4 py-2 rounded-lg border transition-colors " +
                (active
                  ? "bg-amber-500 border-amber-500 text-slate-900 font-semibold"
                  : "bg-slate-900/60 border-[#1e3a5f] text-slate-400 hover:text-white")
              }
            >
              {c} <span className="text-xs opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* 검색 + 일괄 액션 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder={`${category} 안에서 검색`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-900/80 border border-[#1e3a5f] rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
        <button
          onClick={selectAllVisible}
          className="text-xs px-3 py-2 rounded-lg border border-[#1e3a5f] bg-slate-900/60 text-slate-300 hover:text-white flex items-center gap-1.5"
        >
          <CheckSquare className="w-3.5 h-3.5" />
          현재 보이는 것 모두 선택
        </button>
        <button
          onClick={clearSelection}
          disabled={selected.size === 0}
          className="text-xs px-3 py-2 rounded-lg border border-[#1e3a5f] bg-slate-900/60 text-slate-300 hover:text-white flex items-center gap-1.5 disabled:opacity-40"
        >
          <Square className="w-3.5 h-3.5" />
          선택 해제
        </button>
        <button
          onClick={handleBulkDelete}
          disabled={selected.size === 0 || pending}
          className="text-xs px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center gap-1.5 disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" />
          선택 {selected.size}개 삭제
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="text-xs text-slate-500">
        {filtered.length}개 표시 / 카테고리 전체 {rows.length}개
      </div>

      {/* 질문 행 */}
      <div className="rounded-2xl border border-[#1e3a5f] overflow-hidden divide-y divide-[#1e3a5f]">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">표시할 질문이 없습니다.</div>
        ) : (
          filtered.map((r) => {
            const isSelected = selected.has(r.id)
            return (
              <div
                key={r.id}
                className={
                  "flex items-start gap-3 p-3 hover:bg-slate-900/40 transition-colors " +
                  (isSelected ? "bg-amber-500/5" : "bg-slate-900/20")
                }
              >
                <button
                  onClick={() => toggleSelect(r.id)}
                  className="mt-0.5 shrink-0 text-slate-500 hover:text-amber-400"
                >
                  {isSelected ? <CheckSquare className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4" />}
                </button>
                <div className="text-xs text-slate-600 font-mono w-12 mt-0.5 shrink-0">#{r.id}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 leading-relaxed">{r.question}</p>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full border shrink-0 mt-0.5"
                  style={{
                    borderColor: (DIFFICULTY_COLOR[r.difficulty] || "#94a3b8") + "55",
                    color: DIFFICULTY_COLOR[r.difficulty] || "#94a3b8",
                    background: (DIFFICULTY_COLOR[r.difficulty] || "#94a3b8") + "11",
                  }}
                >
                  {r.difficulty}
                </span>
                <button
                  onClick={() => handleDelete(r.id)}
                  disabled={pending}
                  className="shrink-0 text-slate-500 hover:text-red-400 disabled:opacity-30 mt-0.5"
                  title="삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
