import { Bot } from 'grammy'
import { loadTelegramConfig } from '../config.js'

let _bot: Bot | null = null

/**
 * Singleton grammY Bot instance. Returns null if BOT_TOKEN is not configured —
 * the TelegramAdapter checks for null and returns `{ status: 'skipped' }` so
 * production deployments without Telegram still work.
 *
 * Use `setBotForTest` in tests to inject a mock.
 */
export function getBot(): Bot | null {
  if (_bot) return _bot

  const cfg = loadTelegramConfig()
  if (!cfg.BOT_TOKEN) return null

  _bot = new Bot(cfg.BOT_TOKEN)
  return _bot
}

/** Override singleton — for tests only. */
export function setBotForTest(bot: Bot | null): void {
  _bot = bot
}

/** Reset singleton — for tests only. */
export function resetBot(): void {
  _bot = null
}
