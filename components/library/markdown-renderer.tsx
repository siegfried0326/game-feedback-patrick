/**
 * 라이브러리 마크다운 렌더러 — 사이트 스타일에 맞춘 prose
 *
 * 입력은 위키링크가 이미 [text](/library/...) 마크다운 링크로 치환된 본문.
 * (lib/library/markdown.tsx 의 expandWikilinks 결과)
 */
"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import Link from "next/link"
import { Components } from "react-markdown"

const components: Components = {
  a({ href, children, ...rest }) {
    if (href && href.startsWith("/library")) {
      return (
        <Link href={href} className="text-[#5B8DEF] hover:underline">
          {children}
        </Link>
      )
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#5B8DEF] hover:underline"
        {...rest}
      >
        {children}
      </a>
    )
  },
  h1({ children, ...rest }) {
    return (
      <h1 className="text-3xl font-bold text-white mt-10 mb-4" {...rest}>
        {children}
      </h1>
    )
  },
  h2({ children, ...rest }) {
    return (
      <h2 className="text-2xl font-bold text-white mt-10 mb-3 pb-2 border-b border-[#1e3a5f]" {...rest}>
        {children}
      </h2>
    )
  },
  h3({ children, ...rest }) {
    return (
      <h3 className="text-xl font-semibold text-white mt-8 mb-2" {...rest}>
        {children}
      </h3>
    )
  },
  h4({ children, ...rest }) {
    return (
      <h4 className="text-lg font-semibold text-slate-100 mt-6 mb-2" {...rest}>
        {children}
      </h4>
    )
  },
  p({ children, ...rest }) {
    return (
      <p className="text-slate-300 leading-relaxed my-4" {...rest}>
        {children}
      </p>
    )
  },
  ul({ children, ...rest }) {
    return (
      <ul className="list-disc list-outside ml-6 my-4 space-y-1 text-slate-300" {...rest}>
        {children}
      </ul>
    )
  },
  ol({ children, ...rest }) {
    return (
      <ol className="list-decimal list-outside ml-6 my-4 space-y-1 text-slate-300" {...rest}>
        {children}
      </ol>
    )
  },
  li({ children, ...rest }) {
    return (
      <li className="leading-relaxed" {...rest}>
        {children}
      </li>
    )
  },
  blockquote({ children, ...rest }) {
    return (
      <blockquote
        className="border-l-4 border-[#5B8DEF] bg-slate-900/50 px-4 py-2 my-4 text-slate-300 italic"
        {...rest}
      >
        {children}
      </blockquote>
    )
  },
  code({ className, children, ...rest }) {
    const isInline = !className
    if (isInline) {
      return (
        <code className="bg-slate-800 text-[#5B8DEF] px-1.5 py-0.5 rounded text-[0.9em] font-mono" {...rest}>
          {children}
        </code>
      )
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    )
  },
  pre({ children, ...rest }) {
    return (
      <pre className="bg-slate-900 border border-[#1e3a5f] rounded-lg p-4 my-4 overflow-x-auto text-sm" {...rest}>
        {children}
      </pre>
    )
  },
  table({ children, ...rest }) {
    return (
      <div className="overflow-x-auto my-4">
        <table className="w-full border-collapse text-sm" {...rest}>
          {children}
        </table>
      </div>
    )
  },
  th({ children, ...rest }) {
    return (
      <th className="border border-[#1e3a5f] px-3 py-2 text-left text-slate-200 bg-slate-900/60 font-semibold" {...rest}>
        {children}
      </th>
    )
  },
  td({ children, ...rest }) {
    return (
      <td className="border border-[#1e3a5f] px-3 py-2 text-slate-300" {...rest}>
        {children}
      </td>
    )
  },
  hr({ ...rest }) {
    return <hr className="border-[#1e3a5f] my-8" {...rest} />
  },
  strong({ children, ...rest }) {
    return (
      <strong className="text-white font-semibold" {...rest}>
        {children}
      </strong>
    )
  },
  img({ src, alt, ...rest }) {
    if (!src) return null
    // 이미지는 외부 URL만 (라이브러리는 이미지 임베드 없음)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt || ""} className="rounded-lg my-4" {...rest} />
  },
}

export function MarkdownRenderer({ source }: { source: string }) {
  return (
    <div className="library-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, [rehypeAutolinkHeadings, { behavior: "append" }]]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
