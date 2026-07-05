import {
  ApiErrorCode,
  AppError,
  type VaultField,
  VAULT_FIELD_KINDS,
  type VaultFieldKind,
  VAULT_RESOURCE_TYPES,
  type VaultResourceType,
} from '@workflo/types'
import { z } from 'zod'

/**
 * 17-Д typed secret templates — shared between the agency (`credentials.ts`) and portal
 * (`portalCredentials.ts`) create/reveal paths.
 *
 * A typed card carries `resourceType` + ordered `fields[]` validated against the
 * VAULT_FIELD_KINDS catalog. Non-secret kinds (url/login/email/note) are stored PLAIN in
 * `publicFields` (queryable, shown without reveal); secret kinds (password/api_key/token/
 * secret_w) are serialized to a JSON array and encrypted as ONE envelope payload in the
 * existing ciphertext columns — reveal decrypts the whole card once (one audit entry, one
 * throttle tick), the UI then offers per-field copy.
 *
 * Legacy freeform rows (resourceType = null) keep the old single-string secret behavior.
 */

const RESOURCE_TYPE_KEYS = Object.keys(VAULT_RESOURCE_TYPES) as [
  VaultResourceType,
  ...VaultResourceType[],
]
const FIELD_KIND_KEYS = Object.keys(VAULT_FIELD_KINDS) as [VaultFieldKind, ...VaultFieldKind[]]

const fieldSchema = z.object({
  kind: z.enum(FIELD_KIND_KEYS),
  value: z.string().trim().min(1).max(10000),
})

/** Create-body of a TYPED card (17-Д). Legacy freeform bodies don't carry `resourceType`. */
export const typedCreateSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    resourceType: z.enum(RESOURCE_TYPE_KEYS),
    fields: z.array(fieldSchema).min(1).max(20),
    notes: z.string().trim().max(2000).nullish(),
  })
  .strict()

export type TypedCreateInput = z.infer<typeof typedCreateSchema>

/** True when the create body targets the typed shape (17-Д) rather than legacy freeform. */
export function isTypedCreateBody(body: unknown): boolean {
  return typeof (body as { resourceType?: unknown } | null)?.resourceType === 'string'
}

/** Split validated fields into the plain half and the to-be-encrypted half.
 * A vault card must protect something — all-public cards are rejected. */
export function splitTypedFields(fields: VaultField[]): {
  publicFields: VaultField[]
  secretPlaintext: string
} {
  const publicFields = fields.filter((f) => !VAULT_FIELD_KINDS[f.kind].secret)
  const secretFields = fields.filter((f) => VAULT_FIELD_KINDS[f.kind].secret)
  if (secretFields.length === 0) {
    throw new AppError(
      ApiErrorCode.VALIDATION_ERROR,
      'Додайте хоча б одне секретне поле (пароль / ключ / токен)',
      400
    )
  }
  return { publicFields, secretPlaintext: JSON.stringify(secretFields) }
}

/** Shape the reveal payload: typed rows decrypt to a JSON array of secret fields,
 * legacy rows to the raw secret string. */
export function revealPayload(
  resourceType: string | null,
  plaintext: string
): { secret: string } | { secretFields: VaultField[] } {
  if (resourceType == null) return { secret: plaintext }
  return { secretFields: JSON.parse(plaintext) as VaultField[] }
}
