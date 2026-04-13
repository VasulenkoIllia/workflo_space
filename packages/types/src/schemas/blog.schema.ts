import { z } from 'zod'
import { BlogPostStatus, BlogPostType } from '../enums.js'

export const blogPostSchema = z.object({
  title: z.string().min(3),
  slug: z.string().min(3),
  type: z.nativeEnum(BlogPostType),
  status: z.nativeEnum(BlogPostStatus),
  contentMarkdown: z.string().min(10),
})
