import { prisma } from '@workflo/db'
import { buildApp } from './app.js'
import { validateRuntimeEnv } from './config/env.js'
import { startChatListener, stopChatListener } from './services/chatListener.js'

const port = Number(process.env.API_PORT ?? 4000)
const host = process.env.API_HOST ?? '0.0.0.0'

validateRuntimeEnv()

const app = buildApp()

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Received shutdown signal')

  await stopChatListener()
  app.log.info('Chat listener stopped')

  await app.close()
  app.log.info('HTTP server closed')

  await prisma.$disconnect()
  app.log.info('Database disconnected')

  process.exit(0)
}

const start = async () => {
  try {
    await app.listen({ port, host })
    // SSE shared bus: one LISTEN connection feeds all chat streams on this instance.
    startChatListener(app.log)
    app.log.info({ port, host, env: process.env.NODE_ENV ?? 'development' }, 'API started')
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

void start()
