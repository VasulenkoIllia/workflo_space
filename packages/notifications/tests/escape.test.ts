import { describe, expect, it } from 'vitest'
import { bold, code, escapeHtml, italic, link } from '../src/telegram/escape.js'

describe('telegram escape', () => {
  it('escapes only <, >, & per Telegram HTML parse_mode spec', () => {
    expect(escapeHtml('< & >')).toBe('&lt; &amp; &gt;')
  })

  it('does NOT escape quotes (Telegram allows them)', () => {
    expect(escapeHtml('"x"')).toBe('"x"')
    expect(escapeHtml("'x'")).toBe("'x'")
  })

  it('bold wraps escaped text in <b>', () => {
    expect(bold('a & b')).toBe('<b>a &amp; b</b>')
  })

  it('italic wraps escaped text in <i>', () => {
    expect(italic('<x>')).toBe('<i>&lt;x&gt;</i>')
  })

  it('code wraps escaped text in <code>', () => {
    expect(code('a < b')).toBe('<code>a &lt; b</code>')
  })

  it('link escapes label but not URL', () => {
    expect(link('open <here>', 'https://example.com')).toBe(
      '<a href="https://example.com">open &lt;here&gt;</a>'
    )
  })
})
