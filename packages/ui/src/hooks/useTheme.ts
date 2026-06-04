// useTheme lives with the provider (it needs the context). Re-exported here for
// convenience / stable deep-import path. Prefer importing from '@workflo/ui'.
export { useTheme } from '../providers/ThemeProvider.js'
export type {
  ThemeContextValue,
  ThemeMode,
  ResolvedTheme,
  AccentKey,
} from '../providers/ThemeProvider.js'
