import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

// Re-export Prisma runtime + types so consumers don't need a direct
// @prisma/client dependency (keeps the generated client a db-package concern).
export { Prisma, PrismaClient } from '@prisma/client'
