import { prisma } from '@workflo/db'
import { buildApp } from './app.js'

const port = Number(process.env.API_PORT ?? 4000)
const host = process.env.API_HOST ?? '0.0.0.0'

const app = buildApp()

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Received shutdown signal')

  await app.close()
  app.log.info('HTTP server closed')

  await prisma.$disconnect()
  app.log.info('Database disconnected')

  process.exit(0)
}

const start = async () => {
  try {
    await app.listen({ port, host })
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
