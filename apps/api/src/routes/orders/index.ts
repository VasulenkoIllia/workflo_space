import type { FastifyPluginAsync } from 'fastify'
import activityRoute from './activity.js'
import orderEstimateRoute from './estimate.js'
import assignOrderRoute from './assignOrder.js'
import coAssigneesRoute from './coAssignees.js'
import commentsRoute from './comments.js'
import conversationRoute from './conversation.js'
import commentActionsRoute from './commentActions.js'
import commentsStreamRoute from './commentsStream.js'
import participantsRoute from './participants.js'
import createOrderRoute from './createOrder.js'
import createWorkspaceOrderRoute from './createWorkspaceOrder.js'
import decideOrderApprovalRoute from './decideOrderApproval.js'
import deleteOrderRoute from './deleteOrder.js'
import restoreOrderRoute from './restoreOrder.js'
import orderTagsRoute from './tags.js'
import slaRoute from './sla.js'
import orderTemplatesRoute from './templates.js'
import getOrderRoute from './getOrder.js'
import internalTasksRoute from './internalTasks.js'
import listOrdersRoute from './listOrders.js'
import reconciliationRoute from './reconciliation.js'
import submitOrderApprovalRoute from './submitOrderApproval.js'
import timeLogsRoute from './timeLogs.js'
import timerRoute from './timer.js'
import transitionOrderStatusRoute from './transitionOrderStatus.js'
import updateOrderRoute from './updateOrder.js'

/** Orders route group (`/orders/*`). Each sub-route declares its own full path. */
const orderRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(createOrderRoute)
  await fastify.register(createWorkspaceOrderRoute)
  await fastify.register(listOrdersRoute)
  await fastify.register(getOrderRoute)
  await fastify.register(transitionOrderStatusRoute)
  await fastify.register(submitOrderApprovalRoute)
  await fastify.register(decideOrderApprovalRoute)
  await fastify.register(updateOrderRoute)
  await fastify.register(deleteOrderRoute)
  await fastify.register(restoreOrderRoute)
  await fastify.register(orderTagsRoute)
  await fastify.register(slaRoute)
  await fastify.register(orderTemplatesRoute)
  await fastify.register(assignOrderRoute)
  fastify.register(coAssigneesRoute)
  fastify.register(reconciliationRoute)
  await fastify.register(internalTasksRoute)
  await fastify.register(commentsRoute)
  await fastify.register(conversationRoute)
  await fastify.register(commentsStreamRoute)
  await fastify.register(participantsRoute)
  await fastify.register(commentActionsRoute)
  await fastify.register(timeLogsRoute)
  await fastify.register(timerRoute)
  await fastify.register(activityRoute)
  fastify.register(orderEstimateRoute)
}

export default orderRoutes
