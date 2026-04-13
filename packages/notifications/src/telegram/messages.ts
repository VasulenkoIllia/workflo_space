export function orderStatusMessage(orderId: string, status: string): string {
  return `Order ${orderId} status changed to ${status}`
}
