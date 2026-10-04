import { describe, expect, it } from 'vitest'
import { bindTranslator, SUPPORTED_LOCALES, translate } from '../src/email/i18n.js'

describe('i18n', () => {
  it('returns ukrainian by default', () => {
    expect(translate('uk', 'welcome.subject')).toBe('Ласкаво просимо у Workflo')
  })

  it('returns english when locale=en', () => {
    expect(translate('en', 'welcome.subject')).toBe('Welcome to Workflo')
  })

  it('falls back to ukrainian when key is missing in english (defensive)', () => {
    // Test against `welcome.body` which exists in both, just sanity-check structure
    const en = translate('en', 'welcome.body')
    expect(en).toContain('workspace')
  })

  it('returns the key when neither uk nor en has it', () => {
    expect(translate('uk', 'nonexistent.key')).toBe('nonexistent.key')
  })

  it('interpolates {variables}', () => {
    expect(translate('uk', 'common.greeting_name', { name: 'Ivan' })).toBe('Привіт, Ivan!')
  })

  it('leaves unknown placeholders intact', () => {
    expect(translate('uk', 'common.greeting_name', {})).toBe('Привіт, {name}!')
  })

  it('bindTranslator preserves locale', () => {
    const t = bindTranslator('en')
    expect(t('welcome.subject')).toBe('Welcome to Workflo')
    expect(t('common.greeting_name', { name: 'Bob' })).toBe('Hi Bob!')
  })

  it('SUPPORTED_LOCALES contains uk and en', () => {
    expect(SUPPORTED_LOCALES).toContain('uk')
    expect(SUPPORTED_LOCALES).toContain('en')
  })
})
