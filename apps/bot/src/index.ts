import { Bot } from 'grammy'

const token = process.env.BOT_TOKEN

if (!token) {
  console.warn('BOT_TOKEN is not set. Bot skeleton is running in idle mode.')
  setInterval(() => {}, 60_000)
} else {
  const bot = new Bot(token)

  bot.command('start', (ctx) => ctx.reply('Workflo bot skeleton is online.'))

  void bot.start()
}
