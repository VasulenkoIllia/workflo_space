import { sendEmail, type EmailPayload } from './adapters/EmailAdapter.js'
import { sendTelegram, type TelegramPayload } from './adapters/TelegramAdapter.js'

export interface NotifyInput {
  email?: EmailPayload
  telegram?: TelegramPayload
}

export async function notify(input: NotifyInput): Promise<void> {
  if (input.email) {
    await sendEmail(input.email)
  }

  if (input.telegram) {
    await sendTelegram(input.telegram)
  }
}
