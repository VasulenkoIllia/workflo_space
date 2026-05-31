import { z } from 'zod'

/**
 * GET /orders/:id/comments — cursor pagination. `before` is an ISO timestamp;
 * the server returns the page of comments strictly older than it (newest-first
 * on the wire, the handler reverses to ascending for display).
 */
export const listCommentsQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

/**
 * POST /orders/:id/comments — a new chat message. `isInternal` marks a
 * team-only note; the handler force-clears it for clients (leak guard).
 */
export const createCommentSchema = z.object({
  content: z.string().min(1).max(10_000),
  isInternal: z.boolean().optional().default(false),
})
