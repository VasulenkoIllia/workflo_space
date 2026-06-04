import type { Preview } from '@storybook/react'
import { ThemeProvider } from '../src/providers/ThemeProvider'
import type { AccentKey, ThemeMode } from '../src/providers/ThemeProvider'
import '../src/styles/index.css'

const ACCENTS: { value: AccentKey; title: string }[] = [
  { value: 'lime', title: 'Lime' },
  { value: 'amber', title: 'Amber CRT' },
  { value: 'green', title: 'Phosphor' },
  { value: 'cyan', title: 'Cyan' },
  { value: 'magenta', title: 'Magenta' },
  { value: 'orange', title: 'Orange' },
]

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disable: true }, // .wfp-root paints var(--wf-bg) itself
    layout: 'fullscreen',
  },
  initialGlobals: { theme: 'light', accent: 'lime', aesthetic: 'A' },
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        dynamicTitle: true,
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
    accent: {
      description: 'Accent preset (swappable palette)',
      toolbar: { title: 'Accent', icon: 'paintbrush', dynamicTitle: true, items: ACCENTS },
    },
    aesthetic: {
      description: 'Shell aesthetic',
      toolbar: {
        title: 'Aesthetic',
        icon: 'browser',
        dynamicTitle: true,
        items: [
          { value: 'A', title: 'A · Terminal' },
          { value: 'B', title: 'B · Studio' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as ThemeMode
      const accent = context.globals.accent as AccentKey
      const aes = context.globals.aesthetic as 'A' | 'B'
      return (
        // key forces a remount when theme/accent change (ThemeProvider reads defaults at init)
        <ThemeProvider defaultTheme={theme} defaultAccent={accent} persist={false} key={`${theme}-${accent}`}>
          <div className={`wfp-aes${aes}`} style={{ minHeight: '100vh', padding: '28px' }}>
            <Story />
          </div>
        </ThemeProvider>
      )
    },
  ],
}

export default preview
