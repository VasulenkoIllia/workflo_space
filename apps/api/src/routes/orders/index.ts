import type { FastifyPluginAsync } from 'fastify'
import createOrderRoute from './createOrder.js'
import getOrderRoute from './getOrder.js'
import listOrdersRoute from './listOrders.js'
import transitionOrderStatusRoute from './transitionOrderStatus.js'

/** Orders route group (`/orders/*`). Each sub-route declares its own full path. */
const orderRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(createOrderRoute)
  await fastify.register(listOrdersRoute)
  await fastify.register(getOrderRoute)
  await fastify.register(transitionOrderStatusRoute)
}

export default orderRoutes
