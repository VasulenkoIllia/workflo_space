import type { Metadata } from 'next'
import { Fragment, type ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { TermPageShell } from '@/components/TermPageShell'
import { type BlogBlock, type BlogDetail, fetchBlogPost, fmtBlogDate } from '@/data/blog'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await fetchBlogPost(slug)
  return post
    ? { title: `${post.title} — workflo.space`, description: post.excerpt }
    : { title: 'Стаття — workflo.space' }
}

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

function renderBlock(b: BlogBlock, i: number): ReactNode {
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

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post: BlogDetail | null = await fetchBlogPost(slug)
  if (!post) notFound()

  const headings = post.body.map((b, i) => ({ b, i })).filter(({ b }) => b.t === 'h2')

  return (
    <TermPageShell
      cwd={`~/illia/workflo/blog/${post.slug}`}
      crumbs={[{ label: '~', href: '/' }, { label: 'blog', href: '/blog' }, { label: post.slug }]}
      cmd={`cat ~/blog/${post.slug}.md`}
      statusLeft={
        <>
          <span className="wf-tm-sb-branch">
            <span className="wf-tm-status-dot" /> blog/{post.slug}
          </span>
          <span className="wf-tm-sb-sep">·</span>
          <span>{post.reading} читання</span>
        </>
      }
    >
      <div className="wf-tm-project-hero" style={{ marginBottom: 6 }}>
        <div className="wf-tm-blog-tags" style={{ marginBottom: 4 }}>
          {post.tags.map((t) => (
            <span key={t} className="wf-tm-blog-tag">
              {t}
            </span>
          ))}
        </div>
        <h1 className="wf-tm-page-h1">{post.title}</h1>
        <p className="wf-tm-page-lead">{post.excerpt}</p>
        <div className="wf-tm-art-meta">
          <span>Ілля</span>
          <span className="wf-tm-art-meta-dot" />
          <span>{fmtBlogDate(post.date)}</span>
          <span className="wf-tm-art-meta-dot" />
          <span>{post.reading} читання</span>
        </div>
      </div>

      <div className="wf-tm-md-section wf-tm-art">
        <nav className="wf-tm-art-toc">
          <div className="wf-tm-art-toc-h">## зміст</div>
          {headings.map(({ b, i }) => (
            <a key={i} className="wf-tm-art-toc-link" href={`#h-${i}`}>
              {b.v as string}
            </a>
          ))}
        </nav>
        <div className="wf-tm-art-body">
          {post.body.map(renderBlock)}

          <div className="wf-tm-cta-band">
            <div>
              <div className="wf-tm-cta-band-t">Маєте схожу задачу?</div>
              <div className="wf-tm-cta-band-sub">// безкоштовний discovery-дзвінок · 30 хв</div>
            </div>
            <a className="wf-tm-btn wf-tm-btn--primary" href="/#contact">
              [ обговорити → ]
            </a>
          </div>
        </div>
      </div>
    </TermPageShell>
  )
}
