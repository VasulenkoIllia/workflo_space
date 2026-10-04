import type { MetadataRoute } from 'next'
import { fetchBlogList } from '@/data/blog'
import { UA } from '@/data/content'
import { SERVICES } from '@/data/pages'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://workflo.space'

/** Static + service + blog routes. Blog posts come from the public read API (S7-02);
 * the fetcher fails soft to [] so the sitemap still builds when the API is unreachable. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticRoutes = [
    '',
    '/services',
    '/about',
    '/contact',
    '/blog',
    '/cases',
    '/terms',
    '/privacy',
  ].map((path) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.7,
    // DSN-9: головна має EN-версію
    ...(path === '' ? { alternates: { languages: { uk: `${SITE}/`, en: `${SITE}/en` } } } : {}),
  }))
  const enHome = {
    url: `${SITE}/en`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
    alternates: { languages: { uk: `${SITE}/`, en: `${SITE}/en` } },
  }
  const serviceRoutes = SERVICES.map((s) => ({
    url: `${SITE}/services/${s.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))
  const { posts } = await fetchBlogList()
  const blogRoutes = posts.map((p) => ({
    url: `${SITE}/blog/${p.slug}`,
    lastModified: p.date ? new Date(p.date) : now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))
  // DSN-8: деталі кейсів і профілі партнерів
  const caseRoutes = UA.cases
    .filter((c) => c.slug)
    .map((c) => ({
      url: `${SITE}/cases/${c.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))
  const partnerRoutes = UA.partners.map((p) => ({
    url: `${SITE}/partners/${p.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  }))
  return [...staticRoutes, enHome, ...serviceRoutes, ...caseRoutes, ...partnerRoutes, ...blogRoutes]
}
