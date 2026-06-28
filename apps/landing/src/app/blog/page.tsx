import type { Metadata } from 'next'
import { BlogList } from '@/components/BlogList'
import { TermPageShell } from '@/components/TermPageShell'
import { fetchBlogList } from '@/data/blog'

export const metadata: Metadata = {
  title: 'Блог — workflo.space',
  description:
    'Нотатки про автоматизацію, AI-агентів та інтеграції — з реальних проєктів, без маркетингового шуму.',
}

export default async function BlogPage() {
  const { posts, tags } = await fetchBlogList()
  return (
    <TermPageShell
      cwd="~/illia/workflo/blog"
      crumbs={[{ label: '~', href: '/' }, { label: 'blog' }]}
      cmd="ls ~/blog/"
      statusLeft={
        <>
          <span className="wf-tm-sb-branch">
            <span className="wf-tm-status-dot" /> blog
          </span>
          <span className="wf-tm-sb-sep">·</span>
          <span>{posts.length} статей</span>
        </>
      }
    >
      <BlogList posts={posts} tags={tags} />
    </TermPageShell>
  )
}
