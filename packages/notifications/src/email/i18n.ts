/**
 * Lightweight i18n for notification templates.
 *
 * Why not @workflo/i18n? Templates run server-side without React; we want a
 * tiny dependency-free lookup that's easy to extend with new locales. Keys
 * are dotted strings: `welcome.subject`, `inviteExecutor.cta`, etc.
 */

export type LocaleKey = 'uk' | 'en'

export const SUPPORTED_LOCALES: ReadonlyArray<LocaleKey> = ['uk', 'en']

type Dictionary = Record<string, string>

const uk: Dictionary = {
  // common
  'common.brand': 'Workflo',
  'common.greeting_name': 'Привіт, {name}!',
  'common.greeting_anon': 'Привіт!',
  'common.signoff': 'Команда Workflo',
  'common.no_reply': 'Цей лист надіслано автоматично — не відповідайте на нього.',
  'common.cta_open': 'Відкрити',
  'common.cta_view': 'Переглянути',

  // welcome
  'welcome.subject': 'Ласкаво просимо у Workflo',
  'welcome.h1': 'Аккаунт створено',
  'welcome.body':
    'Ваш робочий простір готовий. Натисніть кнопку нижче, щоб увійти у portal і створити перше замовлення.',
  'welcome.cta': 'Увійти в кабінет',
  'welcome.tip_telegram':
    'Порада: підключіть Telegram у налаштуваннях, щоб отримувати миттєві сповіщення про статус замовлень.',

  // invite executor
  'inviteExecutor.subject': 'Запрошення приєднатися до Workflo Workspace',
  'inviteExecutor.h1': 'Вас запрошено як виконавця',
  'inviteExecutor.body':
    '{inviterName} запрошує вас приєднатися до робочого простору Workflo як виконавця. Прийміть запрошення нижче — посилання діє 7 днів.',
  'inviteExecutor.cta': 'Прийняти запрошення',
  'inviteExecutor.expiry_note': 'Посилання діє до {expiresAt}.',

  // invite company member
  'inviteCompanyMember.subject': 'Запрошення приєднатися до {companyName} у Workflo',
  'inviteCompanyMember.h1': 'Вас додали до {companyName}',
  'inviteCompanyMember.body':
    '{inviterName} запросив вас приєднатися до команди компанії {companyName} у Workflo. Прийміть запрошення нижче.',
  'inviteCompanyMember.cta': 'Прийняти запрошення',

  // password reset
  'passwordReset.subject': 'Скидання пароля Workflo',
  'passwordReset.h1': 'Скидання пароля',
  'passwordReset.body':
    'Ми отримали запит на скидання пароля для цього аккаунту. Натисніть кнопку нижче — посилання діє 1 годину.',
  'passwordReset.cta': 'Скинути пароль',
  'passwordReset.ignore':
    'Якщо ви НЕ запитували скидання, проігноруйте цей лист. Пароль не буде змінено без переходу за посиланням.',
}

const en: Dictionary = {
  // common
  'common.brand': 'Workflo',
  'common.greeting_name': 'Hi {name}!',
  'common.greeting_anon': 'Hi!',
  'common.signoff': 'The Workflo team',
  'common.no_reply': 'This email was sent automatically — please do not reply.',
  'common.cta_open': 'Open',
  'common.cta_view': 'View',

  // welcome
  'welcome.subject': 'Welcome to Workflo',
  'welcome.h1': 'Your account is ready',
  'welcome.body':
    'Your workspace is set up. Click below to sign in to the portal and create your first order.',
  'welcome.cta': 'Sign in',
  'welcome.tip_telegram':
    'Tip: connect Telegram in settings to get instant updates about your orders.',

  // invite executor
  'inviteExecutor.subject': 'You have been invited to Workflo Workspace',
  'inviteExecutor.h1': 'You have been invited as an executor',
  'inviteExecutor.body':
    '{inviterName} has invited you to join the Workflo workspace as an executor. Accept the invitation below — link is valid for 7 days.',
  'inviteExecutor.cta': 'Accept invitation',
  'inviteExecutor.expiry_note': 'Link expires on {expiresAt}.',

  // invite company member
  'inviteCompanyMember.subject': 'Invitation to join {companyName} on Workflo',
  'inviteCompanyMember.h1': 'You have been added to {companyName}',
  'inviteCompanyMember.body':
    '{inviterName} has invited you to join {companyName} on Workflo. Accept the invitation below.',
  'inviteCompanyMember.cta': 'Accept invitation',

  // password reset
  'passwordReset.subject': 'Reset your Workflo password',
  'passwordReset.h1': 'Reset password',
  'passwordReset.body':
    'We received a request to reset the password for this account. Click below — link is valid for 1 hour.',
  'passwordReset.cta': 'Reset password',
  'passwordReset.ignore':
    "If you did NOT request a reset, ignore this email. Your password will not be changed without you clicking the link.",
}

const DICTIONARIES: Record<LocaleKey, Dictionary> = { uk, en }

/**
 * Look up a key for a locale, falling back to uk → en → key itself.
 * `vars` performs `{name}` replacement.
 */
export function translate(
  locale: LocaleKey,
  key: string,
  vars: Record<string, string | number> = {}
): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES.uk
  const fallback = DICTIONARIES.uk
  const raw = dict[key] ?? fallback[key] ?? key

  return raw.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = vars[name]
    return v === undefined ? match : String(v)
  })
}

/**
 * Helper for templates that want to bind a locale once.
 */
export function bindTranslator(locale: LocaleKey) {
  return (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars)
}
