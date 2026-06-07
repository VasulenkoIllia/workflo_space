'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PropsWithChildren,
} from 'react'
import { cn } from '../lib/cn.js'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type AccentKey = 'lime' | 'amber' | 'green' | 'cyan' | 'magenta' | 'orange'

export interface AccentPreset {
  name: string
  light: string
  dark: string
  soft: string
  softDark: string
}

/** Swappable accent palette. Source of truth: design/project/product-shell.jsx +
 * docs/DESIGN_SYSTEM.md §3.3. Applied at runtime as inline --wf-* (see ThemeProvider). */
export const ACCENT_PRESETS: Record<AccentKey, AccentPreset> = {
  lime: { name: 'Lime', light: '#A3D90D', dark: '#C5F82A', soft: '#ECFCC4', softDark: '#3F4F0F' },
  amber: {
    name: 'Amber CRT',
    light: '#D97706',
    dark: '#FFB000',
    soft: '#FEF3C7',
    softDark: '#3F2A0F',
  },
  green: {
    name: 'Phosphor',
    light: '#16A34A',
    dark: '#22C55E',
    soft: '#DCFCE7',
    softDark: '#0F3F1F',
  },
  cyan: { name: 'Cyan', light: '#0891B2', dark: '#22D3EE', soft: '#CFFAFE', softDark: '#0F353F' },
  magenta: {
    name: 'Magenta',
    light: '#C026D3',
    dark: '#E879F9',
    soft: '#FAE8FF',
    softDark: '#3F0F3F',
  },
  orange: {
    name: 'Orange',
    light: '#EA580C',
    dark: '#FB923C',
    soft: '#FFEDD5',
    softDark: '#3F1F0F',
  },
}

export interface ThemeContextValue {
  /** The requested mode (may be 'system'). */
  theme: ThemeMode
  /** The actual applied theme after resolving 'system'. */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemeMode) => void
  accent: AccentKey
  setAccent: (accent: AccentKey) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const THEME_KEY = 'wf-theme'
const ACCENT_KEY = 'wf-accent'

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const v = window.localStorage.getItem(key)
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

/** Compute the inline accent CSS variables for the active preset + resolved theme,
 * mirroring design/project/product-shell.jsx. */
export function accentVars(accent: AccentKey, resolvedTheme: ResolvedTheme): CSSProperties {
  const p = ACCENT_PRESETS[accent]
  return {
    '--wf-accent': resolvedTheme === 'dark' ? p.dark : p.light,
    '--wf-accent-bg': p.dark,
    '--wf-accent-soft': resolvedTheme === 'dark' ? p.softDark : p.soft,
  } as CSSProperties
}

/**
 * Per-tenant white-label branding (SAAS.md / SAAS_CONFIG.md). Injected at runtime as
 * inline `--wf-*` overrides on `.wfp-root`, so a tenant can override the accent AND
 * neutrals/fonts — not just the 6 accent presets. `tokens` is an arbitrary
 * `--wf-*` → value map (e.g. `--wf-bg`, `--wf-font-sans`); it wins over the preset.
 * Fetch it host→tenant at bootstrap (GET /tenant/branding) and pass here.
 */
export interface TenantBranding {
  /** Direct accent hex override (light/dark); takes precedence over the preset for --wf-accent. */
  accent?: { light: string; dark: string; soft?: string; softDark?: string }
  /** Raw --wf-* token overrides (neutrals, fonts, radii…). Applied last → highest priority. */
  tokens?: Record<`--wf-${string}`, string>
}

/** Merge accent preset vars + optional per-tenant branding into one inline style. */
export function brandingVars(
  accent: AccentKey,
  resolvedTheme: ResolvedTheme,
  branding?: TenantBranding
): CSSProperties {
  const base = accentVars(accent, resolvedTheme) as Record<string, string>
  if (branding?.accent) {
    const a = branding.accent
    base['--wf-accent'] = resolvedTheme === 'dark' ? a.dark : a.light
    base['--wf-accent-bg'] = a.dark
    const soft = resolvedTheme === 'dark' ? (a.softDark ?? a.soft) : (a.soft ?? a.softDark)
    if (soft) base['--wf-accent-soft'] = soft
  }
  if (branding?.tokens) Object.assign(base, branding.tokens)
  return base as CSSProperties
}

export interface ThemeProviderProps extends PropsWithChildren {
  defaultTheme?: ThemeMode
  defaultAccent?: AccentKey
  /** Extra class names merged onto the .wfp-root scope element. */
  className?: string
  /** When false, do not persist to localStorage (useful for Storybook/tests). */
  persist?: boolean
  /** Per-tenant white-label overrides (accent + neutrals + fonts). White-label seam. */
  branding?: TenantBranding
}

/**
 * Renders the `.wfp-root` design-system scope and drives theme + accent.
 * Sets `data-theme` (resolved light|dark), `data-accent`, and inline --wf-accent*
 * so every descendant resolves tokens correctly. Wrap your app once near the root.
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  defaultAccent = 'lime',
  className,
  persist = true,
  branding,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    readStored<ThemeMode>(THEME_KEY, ['light', 'dark', 'system'], defaultTheme)
  )
  const [accent, setAccentState] = useState<AccentKey>(() =>
    readStored<AccentKey>(ACCENT_KEY, Object.keys(ACCENT_PRESETS) as AccentKey[], defaultAccent)
  )
  const [systemDark, setSystemDark] = useState<boolean>(prefersDark)

  // Track the OS preference while in 'system' mode.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mql.addEventListener('change', handler)
    setSystemDark(mql.matches)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const resolvedTheme: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  const setTheme = useCallback(
    (next: ThemeMode) => {
      setThemeState(next)
      if (persist && typeof window !== 'undefined') window.localStorage.setItem(THEME_KEY, next)
    },
    [persist]
  )

  const setAccent = useCallback(
    (next: AccentKey) => {
      setAccentState(next)
      if (persist && typeof window !== 'undefined') window.localStorage.setItem(ACCENT_KEY, next)
    },
    [persist]
  )

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, accent, setAccent }),
    [theme, resolvedTheme, setTheme, accent, setAccent]
  )

  return (
    <ThemeContext.Provider value={value}>
      <div
        className={cn('wfp-root', className)}
        data-theme={resolvedTheme}
        data-accent={accent}
        style={brandingVars(accent, resolvedTheme, branding)}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

/** Access theme + accent controls. Must be used within a <ThemeProvider>. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>')
  return ctx
}
