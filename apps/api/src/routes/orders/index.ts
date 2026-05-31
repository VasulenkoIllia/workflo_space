import type { FastifyPluginAsync } from 'fastify'
import assignOrderRoute from './assignOrder.js'
import createOrderRoute from './createOrder.js'
import deleteOrderRoute from './deleteOrder.js'
import getOrderRoute from './getOrder.js'
import listOrdersRoute from './listOrders.js'
import transitionOrderStatusRoute from './transitionOrderStatus.js'
import updateOrderRoute from './updateOrder.js'

/** Orders route group (`/orders/*`). Each sub-route declares its own full path. */
const orderRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(createOrderRoute)
  await fastify.register(listOrdersRoute)
  await fastify.register(getOrderRoute)
  await fastify.register(transitionOrderStatusRoute)
  await fastify.register(updateOrderRoute)
  await fastify.register(deleteOrderRoute)
  await fastify.register(assignOrderRoute)
}

export default orderRoutes
