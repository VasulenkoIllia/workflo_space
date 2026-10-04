import type { FastifyPluginAsync } from 'fastify'
import companyDocumentsRoute from './companyDocuments.js'
import contractsRoute from './contracts.js'
import orderDocumentsRoute from './orderDocuments.js'
import publicInvoiceRoute from './publicInvoice.js'

/** Document generation + listing (06). All require authentication, except the
 * 06-Д public invoice page — token-only access, registered in publicInvoice.ts.
 * R2 (аудит r6): колишній documents.ts розбито за концернами — order-scoped
 * (orderDocuments), зовнішні договори (contracts), company-scoped/портал
 * (companyDocuments); нумерація — services/documentNumber.ts. */
const documentRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(orderDocumentsRoute)
  await fastify.register(contractsRoute)
  await fastify.register(companyDocumentsRoute)
  await fastify.register(publicInvoiceRoute)
}

export default documentRoutes
