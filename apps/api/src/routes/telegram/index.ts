import type { FastifyPluginAsync } from 'fastify'
import telegramRoutes from './telegram.js'

/** Telegram account linking (15-bot). Mixed auth: /profile/telegram/* are user-authed,
 * /telegram/link is bot-authed via X-Bot-Secret (handled inside the route). */
const telegramLinkRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(telegramRoutes)
}

export default telegramLinkRoutes
