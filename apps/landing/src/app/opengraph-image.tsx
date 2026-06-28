import { ImageResponse } from 'next/og'

// Default OG/Twitter image for the whole site (inherited by every route unless overridden).
// ASCII-only text on purpose: ImageResponse's embedded font covers Latin, so the build needs
// no dynamic font download — keeps CI network-free. Cyrillic/glyphs would trigger a fetch that
// fails offline, so the brand copy here stays Latin.
export const alt = 'workflo.space — automations for teams that outgrew Excel'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#0c0a09',
        padding: 72,
        color: '#fafaf9',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30 }}>
        <span style={{ color: '#84cc16' }}>&gt;_</span>
        <span style={{ color: '#a8a29e' }}>~/illia/workflo</span>
        <span style={{ color: '#57534e' }}>|</span>
        <span style={{ color: '#a8a29e' }}>zsh</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 34, color: '#84cc16' }}>
          <span style={{ color: '#a8a29e' }}>$</span>
          <span style={{ marginLeft: 16 }}>cat workflo.space</span>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 24,
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -1,
          }}
        >
          Automations for teams that outgrew Excel
        </div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 32, color: '#a8a29e' }}>
          Telegram bots / AI agents / integrations / custom CRM
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28 }}>
        <span style={{ color: '#84cc16' }}>workflo.space</span>
        <span style={{ color: '#78716c' }}>Lutsk, Ukraine</span>
      </div>
    </div>,
    size
  )
}
