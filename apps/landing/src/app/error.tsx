'use client'

import { useEffect } from 'react'
import { TermPageShell } from '@/components/TermPageShell'

/** DSN-8 · design-v2 landing-marketing.jsx → Error500: брендована помилка рендера сторінки. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // лишаємо слід у консолі браузера (серверні помилки — у логах Next)
    console.error(error)
  }, [error])

  return (
    <TermPageShell
      cwd="~/illia/workflo"
      cmd="curl -I workflo.space"
      statusLeft={
        <>
          <span className="wf-tm-sb-branch">
            <span className="wf-tm-status-dot" style={{ background: '#D97706' }} /> 500
          </span>
          <span className="wf-tm-sb-sep">·</span>
          <span>internal error</span>
        </>
      }
    >
      <div className="wf-tm-err">
        <div className="wf-tm-err-code">HTTP/1.1 500</div>
        <pre className="wf-tm-err-art">{`  500  ~  щось зламалось у нас
  ──────────────────────────
  $ tail -f /var/log/workflo.log
  [error] unexpected — не ваша провина${error.digest ? `\n  digest: ${error.digest}` : ''}`}</pre>
        <h1 className="wf-tm-page-h1">Внутрішня помилка</h1>
        <p className="wf-tm-page-lead" style={{ maxWidth: '54ch' }}>
          Це збій на нашому боці, не ваш. Спробуйте ще раз за хвилину — або напишіть нам, якщо
          повторюється.
        </p>
        <div className="wf-tm-page-ctas">
          <button type="button" className="wf-tm-btn" onClick={() => reset()}>
            [ ↻ спробувати ще раз ]
          </button>
          <a className="wf-tm-btn wf-tm-btn--primary" href="/contact">
            [ написати в підтримку → ]
          </a>
        </div>
      </div>
    </TermPageShell>
  )
}
