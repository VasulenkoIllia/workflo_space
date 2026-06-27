'use client'

import { type FormEvent, useState } from 'react'
import { CONTACT_PAGE } from '@/data/pages'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://dev-api.workflo.space'

/** /contact form (name/contact/budget/task) → POST /content/contact. Budget is folded into
 * the message; honeypot + states mirror the homepage Contact section. */
export function ContactForm() {
  const [vals, setVals] = useState<Record<string, string>>({})
  const [website, setWebsite] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const set = (id: string, v: string) => setVals((s) => ({ ...s, [id]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (state === 'sending' || state === 'sent') return
    setState('sending')
    const budget = vals.budget ? `\n\nБюджет: ${vals.budget}` : ''
    try {
      const res = await fetch(`${API_URL}/content/contact`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: vals.name ?? '',
          email: vals.contact ?? '',
          message: (vals.task ?? '') + budget,
          source: 'landing-contact',
          website,
        }),
      })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  const label =
    state === 'sent'
      ? 'надіслано ✓'
      : state === 'sending'
        ? '...'
        : state === 'error'
          ? 'помилка — ще раз'
          : 'надіслати →'

  return (
    <form
      className="wf-tm-contact-form"
      onSubmit={(e) => {
        void submit(e)
      }}
    >
      <div className="wf-tm-contact-form-h">// напишіть задачу</div>
      {CONTACT_PAGE.fields.map((fld) => (
        <div className="wf-tm-field" key={fld.id}>
          <label className="wf-tm-field-label">{fld.label}</label>
          {fld.type === 'textarea' ? (
            <textarea
              className="wf-tm-field-input wf-tm-field-textarea"
              placeholder={fld.placeholder}
              rows={4}
              required
              value={vals[fld.id] ?? ''}
              onChange={(e) => set(fld.id, e.target.value)}
            />
          ) : fld.type === 'select' ? (
            <select
              className="wf-tm-field-input"
              value={vals[fld.id] ?? ''}
              onChange={(e) => set(fld.id, e.target.value)}
            >
              {(fld.options ?? []).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              className="wf-tm-field-input"
              placeholder={fld.placeholder}
              required
              value={vals[fld.id] ?? ''}
              onChange={(e) => set(fld.id, e.target.value)}
            />
          )}
        </div>
      ))}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />
      <button
        className="wf-tm-btn wf-tm-btn--primary wf-tm-contact-submit"
        type="submit"
        disabled={state === 'sending' || state === 'sent'}
      >
        [ {label} ]
      </button>
      <div className="wf-tm-contact-reasons">
        {CONTACT_PAGE.reasons.map((r) => (
          <span className="wf-tm-contact-reason" key={r}>
            <span className="wf-tm-bullet" style={{ color: 'var(--wf-accent)' }}>
              ✓
            </span>{' '}
            {r}
          </span>
        ))}
      </div>
    </form>
  )
}
