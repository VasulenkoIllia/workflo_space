import { Bot } from 'grammy'

const token = process.env.BOT_TOKEN

if (!token) {
  console.warn('BOT_TOKEN is not set. Bot skeleton started without polling.')
  process.exit(0)
}

const bot = new Bot(token)

bot.command('start', (ctx) => ctx.reply('Workflo bot skeleton is online.'))

void bot.start()
