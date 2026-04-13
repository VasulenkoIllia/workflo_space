export interface EmailPayload {
  to: string
  subject: string
  html: string
}

export function sendEmail(_payload: EmailPayload): Promise<void> {
  return Promise.resolve()
}
