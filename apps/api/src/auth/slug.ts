import type { PrismaClient } from '@workflo/db'

/**
 * Transliterate + slugify a company name. Handles Cyrillic (uk) and Latin.
 * Falls back to 'company' if the result is empty (e.g. emoji-only name).
 */
const CYRILLIC_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'iu',
  я: 'ia',
  "'": '',
  ʼ: '',
}

export function slugify(input: string): string {
  const lower = input.trim().toLowerCase()
  const transliterated = Array.from(lower)
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('')

  const slug = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return slug.length > 0 ? slug : 'company'
}

/**
 * Generate a unique company slug, appending -2, -3, ... on collision.
 * Accepts a Prisma client or a transaction client (both expose company.findUnique).
 */
export async function generateUniqueCompanySlug(
  tx: Pick<PrismaClient, 'company'>,
  name: string
): Promise<string> {
  const base = slugify(name)
  let candidate = base

  for (let suffix = 2; suffix <= 1000; suffix += 1) {
    const existing = await tx.company.findUnique({ where: { slug: candidate } })
    if (!existing) {
      return candidate
    }
    candidate = `${base}-${suffix}`
  }

  // Extremely unlikely — fall back to a random suffix.
  return `${base}-${Date.now().toString(36)}`
}
