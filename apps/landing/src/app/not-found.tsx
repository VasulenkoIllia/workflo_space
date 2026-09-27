import type { Metadata } from 'next'
import { TermPageShell } from '@/components/TermPageShell'

export const metadata: Metadata = { title: '404 — workflo.space', robots: { index: false } }

/** DSN-8 · design-v2 terminal-variant.jsx → Terminal404: брендований «сторінки немає». */
export default function NotFound() {
  return (
    <TermPageShell
      cwd="~/illia/workflo"
      cmd="cd /pages/this-doesnt-exist"
      statusLeft={
        <>
          <span className="wf-tm-sb-branch">
            <span className="wf-tm-status-dot" /> 404
          </span>
          <span className="wf-tm-sb-sep">·</span>
          <span>page not found</span>
        </>
      }
    >
      <div className="wf-tm-404-wrap" style={{ margin: '0 auto' }}>
        <div className="wf-tm-404-err">
          bash: cd: /pages/this-doesnt-exist:{' '}
          <span className="wf-tm-404-err-msg">No such file or directory</span>
        </div>
        <pre className="wf-tm-404-ascii" aria-hidden="true">{`       /\\___/\\
      ( -    - )       404
       >  ^  <         /pages/this-doesnt-exist
      ──────────
       u     u`}</pre>
        <div className="wf-tm-404-tag">
          <span className="wf-tm-status-dot" />
          <span>статус: page not found</span>
        </div>
        <div className="wf-tm-404-headline">
          цієї сторінки немає. <span className="wf-tm-404-yet">поки що.</span>
        </div>
        <div className="wf-tm-404-suggest">
          <div className="wf-tm-404-suggest-head"># спробуйте натомість:</div>
          <div className="wf-tm-404-suggest-list">
            {[
              ['/', 'cd ~', 'на головну'],
              ['/cases', 'ls ~/work', 'кейси з реальними цифрами'],
              ['/services', 'cat ~/services', 'що я роблю'],
              ['/contact', 'contact --help', 'написати напряму'],
            ].map(([href, cmd, label]) => (
              <a key={href} href={href} className="wf-tm-404-link">
                <span className="wf-tm-sigil">$</span>
                <span className="wf-tm-cmd">{cmd}</span>
                <span className="wf-tm-bullet">→</span>
                <span>{label}</span>
              </a>
            ))}
          </div>
        </div>
        <div className="wf-tm-404-ctas">
          <a className="wf-tm-btn wf-tm-btn--primary" href="/">
            [ ← на головну ]
          </a>
          <a className="wf-tm-btn" href="/contact">
            [ написати → ]
          </a>
        </div>
      </div>
    </TermPageShell>
  )
}
