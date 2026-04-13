export interface TelegramPayload {
  chatId: string
  text: string
}

export function sendTelegram(_payload: TelegramPayload): Promise<void> {
  return Promise.resolve()
}
