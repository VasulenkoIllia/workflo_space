import type { MetadataRoute } from 'next'
import { SERVICES } from '@/data/pages'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://workflo.space'

/** Static + service routes. Blog posts are dynamic (DB) — added once the CMS/feed is wired;
 * for now the index is listed so crawlers discover published posts via it. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const staticRoutes = ['', '/services', '/about', '/contact', '/blog'].map((path) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.7,
  }))
  const serviceRoutes = SERVICES.map((s) => ({
    url: `${SITE}/services/${s.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))
  return [...staticRoutes, ...serviceRoutes]
}
