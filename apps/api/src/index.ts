import { prisma } from '@workflo/db'
import { buildApp } from './app.js'
import { validateRuntimeEnv } from './config/env.js'
import { shouldRunWorkersInline, startWorkers, stopWorkers } from './workers.js'

const port = Number(process.env.API_PORT ?? 4000)
const host = process.env.API_HOST ?? '0.0.0.0'

validateRuntimeEnv()

const app = buildApp()

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Received shutdown signal')

  if (shouldRunWorkersInline()) {
    await stopWorkers()
    app.log.info('Background workers stopped')
  }

  await app.close()
  app.log.info('HTTP server closed')

  await prisma.$disconnect()
  app.log.info('Database disconnected')

  process.exit(0)
}

const start = async () => {
  try {
    await app.listen({ port, host })
    if (process.env.RLS_ENFORCED === 'true') {
      app.log.warn(
        'RLS_ENFORCED=on — the web process MUST connect as the non-superuser workflo_app ' +
          'role for policies to apply (superuser/owner bypass RLS). Interactive writes go ' +
          'through tenantTransaction (GUC). Misconfiguration → empty results / permission ' +
          'errors. See docs/ENGINEERING_STANDARDS.md → "RLS rollout".'
      )
    }
    // ADR-006: run workers inline unless a dedicated worker container owns them.
    if (shouldRunWorkersInline()) {
      startWorkers(app.log)
      app.log.info('Background workers started inline (RUN_WORKERS_INLINE)')
    } else {
      app.log.info('Workers NOT inline — expecting a dedicated worker process')
    }
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
