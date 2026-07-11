import type { FastifyPluginAsync } from 'fastify'
import documentsRoute from './documents.js'
import publicInvoiceRoute from './publicInvoice.js'

/** Document generation + listing (06). All require authentication, except the
 * 06-Д public invoice page — token-only access, registered in publicInvoice.ts. */
const documentRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(documentsRoute)
  await fastify.register(publicInvoiceRoute)
}

export default documentRoutes
