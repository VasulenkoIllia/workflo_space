import { mergeConfig } from 'vite'
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
  docs: { autodocs: 'tag' },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      // keep autodocs tables to OUR props — drop inherited DOM/HTML attributes
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  // Silence benign "use client" directive warnings — the directive is kept for
  // Next.js (landing) consumers; bundlers (Vite/rollup) ignore it.
  viteFinal: (config) =>
    mergeConfig(config, {
      build: {
        rollupOptions: {
          onwarn(warning: { code?: string }, warn: (w: unknown) => void) {
            if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
            warn(warning)
          },
        },
      },
    }),
}

export default config
