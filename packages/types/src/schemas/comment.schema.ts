import { z } from 'zod'
import { REACTION_EMOJIS } from '../constants.js'

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
export const createCommentSchema = z
  .object({
    // Порожній текст дозволений ЛИШЕ разом із вкладеннями (refine нижче).
    content: z.string().max(10_000).default(''),
    isInternal: z.boolean().optional().default(false),
    // 03-чат (03.07): відповідь на повідомлення цього ж замовлення.
    replyToId: z.string().uuid().nullish(),
    // Вкладення: id вже завантажених OrderFile-ів цього замовлення (без commentId).
    fileIds: z.array(z.string().uuid()).max(10).optional(),
    // S10 @mention: profile-ids, вибрані в автокомпліті композера. Сервер лишає
    // тільки валідних УЧАСНИКІВ, яким це повідомлення видиме.
    mentionIds: z.array(z.string().uuid()).max(20).optional(),
  })
  .refine((d) => d.content.trim().length > 0 || (d.fileIds?.length ?? 0) > 0, {
    message: 'Повідомлення порожнє',
    path: ['content'],
  })

/** PATCH /orders/:id/comments/:commentId — редагування власного повідомлення (канон: 15хв, owner — будь-коли). */
export const updateCommentSchema = z.object({
  content: z.string().trim().min(1, 'Повідомлення порожнє').max(10_000),
})

/** POST/DELETE .../reactions — емодзі строго з дозволеного набору (REACTION_EMOJIS). */
export const reactionSchema = z.object({
  emoji: z.enum(REACTION_EMOJIS),
})
