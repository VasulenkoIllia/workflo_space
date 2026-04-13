import { z } from 'zod'
import { Language } from '../enums.js'

export const updateProfileSettingsSchema = z.object({
  displayName: z.string().min(2).optional(),
  preferredLanguage: z.nativeEnum(Language).optional(),
})
