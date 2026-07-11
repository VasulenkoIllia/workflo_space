import type { FastifyPluginAsync } from 'fastify'
import blogRoute from './blog.js'
import cmsRoute from './cms.js'
import contactRoute from './contact.js'
import testimonialsRoute from './testimonials.js'

const contentRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(contactRoute)
  await fastify.register(blogRoute)
  await fastify.register(cmsRoute)
  await fastify.register(testimonialsRoute)
}

export default contentRoutes
