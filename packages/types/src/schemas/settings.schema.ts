import { z } from 'zod'
import { Language, NotificationCategory, NotificationChannel, Theme } from '../enums.js'

export const updateProfileSettingsSchema = z.object({
  displayName: z.string().min(2).optional(),
  preferredLanguage: z.nativeEnum(Language).optional(),
})

/** PATCH /profile — partial update of self-service profile fields. */
export const updateProfileSchema = z
  .object({
    displayName: z.string().min(2).max(120).optional(),
    language: z.nativeEnum(Language).optional(),
    theme: z.nativeEnum(Theme).optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Потрібно вказати хоча б одне поле для оновлення',
  })

/** PATCH /profile/password — change password while authenticated. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

/** PATCH /profile/notifications — bulk-update the preference matrix. */
export const updateNotificationPreferencesSchema = z.object({
  preferences: z
    .array(
      z.object({
        category: z.nativeEnum(NotificationCategory),
        channel: z.nativeEnum(NotificationChannel),
        enabled: z.boolean(),
      })
    )
    .min(1)
    .max(42), // 7 categories × 6 channels ceiling
})
