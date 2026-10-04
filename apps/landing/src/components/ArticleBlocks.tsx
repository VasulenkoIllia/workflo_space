import { Fragment, type ReactNode } from 'react'
import type { BlogBlock } from '@/data/blog'

/** Inline **bold** → <strong>, no dangerouslySetInnerHTML. */
function renderInline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      )
    )
}

export function renderBlock(b: BlogBlock, i: number): ReactNode {
  switch (b.t) {
    case 'h2':
      return (
        <h2 key={i} id={`h-${i}`} className="wf-tm-art-h2">
          {b.v as string}
        </h2>
      )
    case 'p':
      return (
        <p key={i} className="wf-tm-art-p">
          {renderInline(b.v as string)}
        </p>
      )
    case 'ul':
      return (
        <ul key={i} className="wf-tm-art-ul">
          {(b.v as string[]).map((li) => (
            <li key={li}>{li}</li>
          ))}
        </ul>
      )
    case 'code':
      return (
        <pre key={i} className="wf-tm-art-code">
          <code>
            <span className="wf-tm-art-code-lang">{b.lang ?? 'bash'}</span>
            {b.v as string}
          </code>
        </pre>
      )
    case 'callout':
      return (
        <div key={i} className="wf-tm-art-callout">
          <span className="wf-tm-art-callout-k">{b.k}</span>
          <span className="wf-tm-art-callout-v">{b.v as string}</span>
        </div>
      )
    case 'quote':
      return (
        <blockquote key={i} className="wf-tm-art-quote">
          “{b.v as string}”<span className="wf-tm-art-quote-author">— {b.author}</span>
        </blockquote>
      )
    default:
      return null
  }
}
