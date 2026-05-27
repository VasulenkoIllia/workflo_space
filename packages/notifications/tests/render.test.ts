import { describe, expect, it } from 'vitest'
import {
  escapeAttr,
  escapeText,
  renderButton,
  renderHeading,
  renderLayout,
  renderParagraph,
} from '../src/email/render.js'

describe('render — escape helpers', () => {
  it('escapes &, <, >, ", \'', () => {
    expect(escapeText('a & b')).toBe('a &amp; b')
    expect(escapeText('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;')
    expect(escapeText('"hi"')).toBe('&quot;hi&quot;')
    expect(escapeText("it's")).toBe('it&#39;s')
  })

  it('escapeAttr is alias for escapeText', () => {
    expect(escapeAttr('<x>')).toBe('&lt;x&gt;')
  })
})

describe('render — components', () => {
  it('renderButton escapes URL in href', () => {
    const html = renderButton('https://example.com?x="evil"', 'Click')
    expect(html).toContain('href="https://example.com?x=&quot;evil&quot;"')
    expect(html).toContain('>Click</a>')
  })

  it('renderHeading escapes text', () => {
    expect(renderHeading('<script>x</script>')).toContain('&lt;script&gt;')
  })

  it('renderParagraph escapes text', () => {
    expect(renderParagraph('a & b')).toContain('a &amp; b')
  })
})

describe('render — layout', () => {
  it('produces a complete HTML document', () => {
    const html = renderLayout({
      locale: 'uk',
      title: 'Test',
      preheader: 'Preheader text',
      bodyHtml: '<p>body</p>',
    })
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<html lang="uk">')
    expect(html).toContain('<title>Test</title>')
    expect(html).toContain('Preheader text')
    expect(html).toContain('<p>body</p>')
    expect(html).toContain('Workflo') // brand
  })

  it('does NOT escape the bodyHtml fragment (caller responsibility)', () => {
    const html = renderLayout({
      locale: 'uk',
      title: 'T',
      bodyHtml: '<a href="https://example.com">link</a>',
    })
    expect(html).toContain('<a href="https://example.com">link</a>')
  })
})
