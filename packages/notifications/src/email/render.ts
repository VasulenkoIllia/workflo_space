import { bindTranslator, type LocaleKey } from './i18n.js'

/**
 * HTML email layout primitives + safe escape helpers.
 *
 * No external HTML library to keep package light. Email-client safe (no <style> with
 * cascading rules; everything is inline). Tested with Mailpit + Gmail rendering.
 */

// Brand palette — design-v2 light theme, email-safe inline hex (CSS vars don't render
// in most email clients). Warm stone neutrals + lime accent; replaces the old
// IBM-Carbon blue (#0F62FE) + cool-grey that diverged from the brand.
const BRAND_COLOR = '#0C0A09' // wordmark / strong text (warm near-black)
const ACCENT_COLOR = '#A3D90D' // lime CTA background (--wf-accent, light)
const ACCENT_TEXT = '#0C0A09' // text on the lime button (dark, for contrast)
const TEXT_COLOR = '#1C1917' // body text (warm stone)
const MUTED_COLOR = '#78716C' // muted / footer (warm stone)
const BORDER_COLOR = '#E7E5E4' // warm stone border
const PAGE_BG = '#FAFAF9' // page background (warm stone)

/** Escape for HTML text node — converts < > & " ' */
export function escapeText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escape for HTML attribute value (URLs, etc.) */
export function escapeAttr(input: string): string {
  return escapeText(input)
}

export interface LayoutOptions {
  locale: LocaleKey
  title: string
  preheader?: string
  /** Pre-rendered HTML body fragment (already escaped where needed). */
  bodyHtml: string
}

/** Wrap a body fragment in a responsive email layout. */
export function renderLayout(opts: LayoutOptions): string {
  const t = bindTranslator(opts.locale)
  const brand = escapeText(t('common.brand'))
  const noReply = escapeText(t('common.no_reply'))
  const preheader = opts.preheader ? escapeText(opts.preheader) : ''
  const title = escapeText(opts.title)

  return `<!doctype html>
<html lang="${escapeAttr(opts.locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:${PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT_COLOR};">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${PAGE_BG};padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#FFFFFF;border:1px solid ${BORDER_COLOR};border-radius:12px;overflow:hidden;">
          <tr><td style="padding:24px 32px;border-bottom:1px solid ${BORDER_COLOR};">
            <div style="font-size:18px;font-weight:600;color:${BRAND_COLOR};">${brand}</div>
          </td></tr>
          <tr><td style="padding:32px;font-size:15px;line-height:1.55;color:${TEXT_COLOR};">
            ${opts.bodyHtml}
          </td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid ${BORDER_COLOR};font-size:12px;color:${MUTED_COLOR};">
            ${noReply}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

/** Inline button. URL is escaped for the href attribute. */
export function renderButton(url: string, label: string): string {
  return `<p style="margin:24px 0;">
  <a href="${escapeAttr(url)}" style="display:inline-block;padding:12px 24px;background:${ACCENT_COLOR};color:${ACCENT_TEXT};text-decoration:none;border-radius:8px;font-weight:600;">${escapeText(label)}</a>
</p>`
}

/** Heading H1 styled for email. */
export function renderHeading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${TEXT_COLOR};">${escapeText(text)}</h1>`
}

/** Paragraph with safe text. */
export function renderParagraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${TEXT_COLOR};">${escapeText(text)}</p>`
}

/** Muted note (small grey text). */
export function renderMuted(text: string): string {
  return `<p style="margin:24px 0 0;font-size:13px;color:${MUTED_COLOR};">${escapeText(text)}</p>`
}
