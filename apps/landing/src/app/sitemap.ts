import type { MetadataRoute } from 'next'
import { fetchBlogList } from '@/data/blog'
import { SERVICES } from '@/data/pages'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://workflo.space'

/** Static + service + blog routes. Blog posts come from the public read API (S7-02);
 * the fetcher fails soft to [] so the sitemap still builds when the API is unreachable. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticRoutes = ['', '/services', '/about', '/contact', '/blog', '/cases'].map((path) => ({
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
  const { posts } = await fetchBlogList()
  const blogRoutes = posts.map((p) => ({
    url: `${SITE}/blog/${p.slug}`,
    lastModified: p.date ? new Date(p.date) : now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))
  return [...staticRoutes, ...serviceRoutes, ...blogRoutes]
}
