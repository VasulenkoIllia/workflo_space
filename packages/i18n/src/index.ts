import enAuth from './en/auth.js'
import enCommon from './en/common.js'
import enNav from './en/nav.js'
import enValidation from './en/validation.js'
import ukAuth from './uk/auth.js'
import ukCommon from './uk/common.js'
import ukNav from './uk/nav.js'
import ukValidation from './uk/validation.js'

export type Locale = 'uk' | 'en'

export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ['uk', 'en']
export const DEFAULT_LOCALE: Locale = 'uk'

export const i18nDictionary = {
  uk: {
    common: ukCommon,
    auth: ukAuth,
    nav: ukNav,
    validation: ukValidation,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    nav: enNav,
    validation: enValidation,
  },
} as const

export type Namespace = keyof (typeof i18nDictionary)['uk']

/** True if the given string is a supported locale. */
export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(value)
}

/** Resolve a usable locale, falling back to the default. */
export function resolveLocale(value: string | null | undefined): Locale {
  return value && isLocale(value) ? value : DEFAULT_LOCALE
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = vars[name]
    return v === undefined ? match : String(v)
  })
}

/**
 * Translate a dotted key `"<namespace>.<key>"` for a locale.
 * Falls back: requested locale → default locale → the key itself.
 * `vars` performs `{name}` interpolation.
 */
export function translate(
  locale: Locale,
  key: string,
  vars: Record<string, string | number> = {}
): string {
  const parts = key.split('.')
  const ns = parts[0] ?? ''
  const leaf = parts.slice(1).join('.')

  const lookup = (loc: Locale): string | undefined => {
    const namespace = (i18nDictionary[loc] as Record<string, Record<string, string>>)[ns]
    return namespace?.[leaf]
  }

  const raw = lookup(locale) ?? lookup(DEFAULT_LOCALE) ?? key
  return interpolate(raw, vars)
}

/** Bind a translator to a locale (handy in React components). */
export function createTranslator(locale: Locale) {
  return (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars)
}
