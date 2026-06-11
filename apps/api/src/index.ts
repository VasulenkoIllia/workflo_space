import { prisma } from '@workflo/db'
import { buildApp } from './app.js'
import { validateRuntimeEnv } from './config/env.js'
import { flushSentry, initSentry } from './observability/sentry.js'
import { closeAllChatStreams } from './routes/orders/commentsStream.js'
import { shouldRunWorkersInline, startWorkers, stopWorkers } from './workers.js'

const port = Number(process.env.API_PORT ?? 4000)
const host = process.env.API_HOST ?? '0.0.0.0'

validateRuntimeEnv()
initSentry() // no-op unless SENTRY_DSN is set

const app = buildApp()

// AR-30: idempotent (a second SIGTERM must not re-run the teardown) + watchdog
// (the process may NEVER hang in shutdown — if anything stalls past 10s, exit
// hard; the orchestrator's SIGKILL did this anyway, but skipped the logs).
let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) {
    app.log.warn({ signal }, 'Shutdown already in progress — ignoring repeat signal')
    return
  }
  shuttingDown = true
  app.log.info({ signal }, 'Received shutdown signal')

  const watchdog = setTimeout(() => {
    app.log.error('Shutdown watchdog fired (10s) — forcing exit')
    process.exit(1)
  }, 10_000)
  watchdog.unref()

  if (shouldRunWorkersInline()) {
    await stopWorkers()
    app.log.info('Background workers stopped')
  }

  // Live SSE sockets keep server.close() pending forever — end them first.
  const sseClosed = closeAllChatStreams()
  if (sseClosed > 0) app.log.info({ sseClosed }, 'Live SSE streams closed')

  await app.close()
  app.log.info('HTTP server closed')

  await prisma.$disconnect()
  app.log.info('Database disconnected')

  await flushSentry()

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
