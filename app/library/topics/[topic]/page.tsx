/**
 * /library/topics/[topic] — 토픽별 문서 목록
 */

import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getAllSummaries } from "@/lib/library/loader"
import { TopicFilterClient } from "@/components/library/topic-filter-client"
import { Topic, TOPIC_COLORS, TOPIC_LABELS, TOPIC_ORDER } from "@/lib/library/types"

interface Props {
  params: Promise<{ topic: string }>
}

export async function generateStaticParams() {
  return TOPIC_ORDER.map((topic) => ({ topic }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params
  if (!TOPIC_ORDER.includes(topic as Topic)) return { title: "Not found" }
  return { title: `${TOPIC_LABELS[topic as Topic]} | 주제 | 라이브러리 | 문라이트 아카이브` }
}

export default async function TopicDetailPage({ params }: Props) {
  const { topic } = await params
  if (!TOPIC_ORDER.includes(topic as Topic)) notFound()
  const t = topic as Topic
  const all = await getAllSummaries()
  const docs = all.filter((d) => d.topics?.includes(t))

  return (
    <div className="space-y-6">
      <Link
        href="/library/topics"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        주제별 분류
      </Link>

      <header className="space-y-2 pb-4 border-b" style={{ borderColor: TOPIC_COLORS[t] + "33" }}>
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: TOPIC_COLORS[t] }}
          />
          <span className="text-xs text-muted-foreground">주제</span>
        </div>
        <h1 className="text-3xl font-black" style={{ color: TOPIC_COLORS[t] }}>
          {TOPIC_LABELS[t]}
        </h1>
        <p className="text-sm text-muted-foreground">
          이 주제에 속한 문서 {docs.length}편
        </p>
      </header>

      <TopicFilterClient documents={docs} />
    </div>
  )
}
