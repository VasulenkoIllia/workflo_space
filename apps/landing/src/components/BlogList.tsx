'use client'

import { useState } from 'react'
import { type BlogListItem, fmtBlogDate } from '@/data/blog'

/** /blog index content (design: BlogIndex) — tag filter + featured card + rows + load-more. */
export function BlogList({ posts, tags }: { posts: BlogListItem[]; tags: string[] }) {
  const [tag, setTag] = useState('усі')
  const [shown, setShown] = useState(4)

  const all = posts.filter((p) => tag === 'усі' || p.tags.includes(tag))
  const featured = all.find((p) => p.featured)
  const rest = all.filter((p) => !p.featured).slice(0, shown)
  const restTotal = all.filter((p) => !p.featured).length

  return (
    <>
      <div className="wf-tm-project-hero" style={{ marginBottom: 18 }}>
        <h1 className="wf-tm-page-h1">Блог</h1>
        <p className="wf-tm-page-lead">
          Нотатки про автоматизацію, AI-агентів та інтеграції — з реальних проєктів, без
          маркетингового шуму.
        </p>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## filter</div>
        <div className="wf-tm-blog-filters">
          {tags.map((tg) => (
            <button
              key={tg}
              className="wf-tm-blog-filter"
              data-on={tag === tg || undefined}
              onClick={() => {
                setTag(tg)
                setShown(4)
              }}
            >
              {tg}
              {tg !== 'усі' ? `(${posts.filter((p) => p.tags.includes(tg)).length})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="wf-tm-md-section">
        <div className="wf-tm-md-h2">## posts</div>

        {all.length === 0 ? (
          <div className="wf-tm-blog-empty">
            <div className="wf-tm-blog-empty-glyph">{'/\\_/\\\n( -.- )  // 0 results\n > ^ <'}</div>
            <div className="wf-tm-blog-empty-t">Поки немає статей за цим тегом</div>
            <div className="wf-tm-blog-empty-sub">Спробуй інший фільтр або зазирни пізніше</div>
            <button className="wf-tm-btn" style={{ marginTop: 6 }} onClick={() => setTag('усі')}>
              [ усі статті ]
            </button>
          </div>
        ) : (
          <div className="wf-tm-blog-list">
            {featured && (
              <a
                className="wf-tm-blog-feature"
                href={`/blog/${featured.slug}`}
                style={{ textDecoration: 'none' }}
              >
                <div className="wf-tm-blog-feature-body">
                  <div className="wf-tm-blog-tags">
                    <span
                      className="wf-tm-blog-tag"
                      style={{
                        borderStyle: 'solid',
                        color: 'var(--wf-accent)',
                        borderColor: 'var(--wf-accent)',
                      }}
                    >
                      ★ обране
                    </span>
                    {featured.tags.map((t) => (
                      <span key={t} className="wf-tm-blog-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                  <h2 className="wf-tm-blog-row-title">{featured.title}</h2>
                  <p className="wf-tm-blog-excerpt">{featured.excerpt}</p>
                  <div className="wf-tm-art-meta" style={{ marginTop: 4 }}>
                    <span>{fmtBlogDate(featured.date)}</span>
                    <span className="wf-tm-art-meta-dot" />
                    <span>{featured.reading} читання</span>
                  </div>
                  <span className="wf-tm-blog-readmore">$ cat {featured.slug}.md →</span>
                </div>
                <div className="wf-tm-blog-feature-thumb">
                  <span className="wf-tm-blog-feature-thumb-glyph">{'{ }'}</span>
                </div>
              </a>
            )}

            {rest.map((p) => (
              <a
                key={p.slug}
                className="wf-tm-blog-row"
                href={`/blog/${p.slug}`}
                style={{ textDecoration: 'none' }}
              >
                <span className="wf-tm-blog-date">{fmtBlogDate(p.date)}</span>
                <div className="wf-tm-blog-row-main">
                  <h3 className="wf-tm-blog-row-title">{p.title}</h3>
                  <p className="wf-tm-blog-excerpt">{p.excerpt}</p>
                  <div className="wf-tm-blog-tags">
                    {p.tags.map((t) => (
                      <span key={t} className="wf-tm-blog-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="wf-tm-blog-reading">{p.reading}</span>
              </a>
            ))}
          </div>
        )}

        {all.length > 0 && rest.length < restTotal && (
          <div className="wf-tm-blog-more">
            <button className="wf-tm-btn" onClick={() => setShown((s) => s + 4)}>
              [ завантажити ще ↓ ]
            </button>
          </div>
        )}
      </div>
    </>
  )
}
