import type { FastifyPluginAsync } from 'fastify'
import createOrderRoute from './createOrder.js'
import listOrdersRoute from './listOrders.js'

/** Orders route group (`/orders/*`). Each sub-route declares its own full path. */
const orderRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(createOrderRoute)
  await fastify.register(listOrdersRoute)
}

export default orderRoutes
