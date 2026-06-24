/* eslint-disable no-console -- bot process entrypoint: stdout/stderr is its logging surface */
import { Bot } from 'grammy'

/**
 * Workflo Service Bot (15-bot, S6-05/06). Thin: it owns no data — on `/start <code>` it forwards
 * the deep-link code + the chat id to the API (`POST /telegram/link`, shared-secret auth), which
 * stamps the chat onto the user's NotificationSettings so notify()'s telegram channel reaches them.
 *
 * Long-polling (grammY `bot.start()`) dedupes updates by offset, so a redelivered update is never
 * processed twice — covering the S6-05 "update-id dedup" requirement without extra storage.
 * Webhook mode is a deployment follow-up.
 */
const token = process.env.BOT_TOKEN
const apiUrl = process.env.BOT_API_URL ?? 'http://localhost:4000'
const linkSecret = process.env.BOT_LINK_SECRET

if (!token) {
  console.warn('BOT_TOKEN is not set. Bot is running in idle mode.')
  setInterval(() => {}, 60_000)
} else {
  const bot = new Bot(token)

  bot.command('start', async (ctx) => {
    const code = typeof ctx.match === 'string' ? ctx.match.trim() : ''
    if (!code) {
      await ctx.reply(
        'Вітаю! Це сервісний бот Workflo для сповіщень.\n\n' +
          'Щоб підключити: відкрийте Workflo → Налаштування → «Підключити Telegram» і перейдіть за посиланням звідти.'
      )
      return
    }
    if (!linkSecret) {
      await ctx.reply('Підключення тимчасово недоступне. Спробуйте пізніше.')
      return
    }
    try {
      const res = await fetch(`${apiUrl}/telegram/link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-bot-secret': linkSecret },
        body: JSON.stringify({ code, chatId: String(ctx.chat.id) }),
      })
      const body = (await res.json().catch(() => null)) as {
        success?: boolean
        data?: { profileName?: string }
      } | null

      if (res.ok && body?.success) {
        const who = body.data?.profileName ? ` (${body.data.profileName})` : ''
        await ctx.reply(
          `✅ Готово! Telegram підключено до Workflo${who}.\nТепер сповіщення про замовлення приходитимуть сюди.`
        )
      } else if (res.status === 400) {
        await ctx.reply(
          'Посилання недійсне або застаріле ⏳\nЗгенеруйте нове в налаштуваннях Workflo.'
        )
      } else {
        await ctx.reply('Не вдалося підключити. Спробуйте трохи згодом.')
      }
    } catch (err) {
      console.error('telegram link request failed', err)
      await ctx.reply('Сталася помилка підключення. Спробуйте пізніше.')
    }
  })

  bot.command('help', (ctx) =>
    ctx.reply(
      'Workflo Service Bot — сповіщення про ваші замовлення. Підключення — у налаштуваннях Workflo.'
    )
  )

  bot.catch((err) => console.error('bot error', err))

  void bot.start({
    onStart: (info) => console.log(`Workflo bot @${info.username} online (long-polling)`),
  })
}
