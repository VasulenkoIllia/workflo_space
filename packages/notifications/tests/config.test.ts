import { describe, expect, it } from 'vitest'
import { loadConfig, loadEmailConfig, loadTelegramConfig } from '../src/config.js'

describe('config', () => {
  it('parses a complete env block', () => {
    const cfg = loadConfig({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'noreply@example.com',
      SMTP_PASS: 'secret',
      SMTP_FROM: 'noreply@example.com',
      SMTP_FROM_NAME: 'Test',
      BOT_TOKEN: '123:abc',
      BOT_WEBHOOK_SECRET: 'a-very-long-secret-value',
    })
    expect(cfg.SMTP_HOST).toBe('smtp.example.com')
    expect(cfg.SMTP_PORT).toBe(587)
    expect(cfg.SMTP_SECURE).toBe(false)
    expect(cfg.BOT_TOKEN).toBe('123:abc')
  })

  it('throws when SMTP_HOST is missing', () => {
    expect(() => loadEmailConfig({})).toThrow(/SMTP_HOST/)
  })

  it('telegram config without BOT_TOKEN is valid', () => {
    const cfg = loadTelegramConfig({})
    expect(cfg.BOT_TOKEN).toBeUndefined()
    expect(cfg.BOT_WEBHOOK_SECRET).toBeUndefined()
  })

  it('rejects BOT_WEBHOOK_SECRET that is too short', () => {
    expect(() => loadTelegramConfig({ BOT_WEBHOOK_SECRET: 'short' })).toThrow()
  })

  it('SMTP_SECURE coerces string "true" to boolean', () => {
    const cfg = loadEmailConfig({ SMTP_HOST: 'x', SMTP_SECURE: 'true' })
    expect(cfg.SMTP_SECURE).toBe(true)
  })

  it('SMTP_PORT defaults to 587', () => {
    const cfg = loadEmailConfig({ SMTP_HOST: 'x' })
    expect(cfg.SMTP_PORT).toBe(587)
  })
})
