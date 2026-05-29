import { describe, expect, it } from 'vitest'
import {
  createTranslator,
  DEFAULT_LOCALE,
  isLocale,
  resolveLocale,
  SUPPORTED_LOCALES,
  translate,
} from '../src/index.js'

describe('@workflo/i18n', () => {
  it('translates a dotted key in uk and en', () => {
    expect(translate('uk', 'auth.signIn')).toBe('Увійти')
    expect(translate('en', 'auth.signIn')).toBe('Sign in')
  })

  it('interpolates variables', () => {
    expect(translate('uk', 'auth.welcomeBack', { name: 'Іван' })).toBe('З поверненням, Іван!')
    expect(translate('en', 'validation.passwordTooShort', { min: 8 })).toBe(
      'Password must be at least 8 characters'
    )
  })

  it('falls back to default locale, then the key itself', () => {
    // 'auth.signIn' exists; an unknown key returns the key
    expect(translate('en', 'auth.unknownKey')).toBe('auth.unknownKey')
    expect(translate('uk', 'nope.missing')).toBe('nope.missing')
  })

  it('leaves unknown placeholders intact', () => {
    expect(translate('uk', 'auth.welcomeBack', {})).toBe('З поверненням, {name}!')
  })

  it('isLocale + resolveLocale', () => {
    expect(isLocale('uk')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(resolveLocale('en')).toBe('en')
    expect(resolveLocale('zz')).toBe(DEFAULT_LOCALE)
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE)
  })

  it('createTranslator binds a locale', () => {
    const t = createTranslator('en')
    expect(t('nav.orders')).toBe('Orders')
    expect(t('common.save')).toBe('Save')
  })

  it('SUPPORTED_LOCALES has uk + en', () => {
    expect(SUPPORTED_LOCALES).toEqual(['uk', 'en'])
  })
})
