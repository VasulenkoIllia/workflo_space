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
  // 01-А magic-link + 01-Г зміна email
  'magicLink.subject': 'Вхід у Workflo одним кліком',
  'magicLink.h1': 'Вхід без пароля',
  'magicLink.body':
    'Натисніть кнопку, щоб увійти у свій кабінет. Посилання діє 15 хвилин і працює один раз.',
  'magicLink.cta': 'Увійти',
  'magicLink.ignore': 'Якщо ви не запитували вхід — просто проігноруйте цей лист.',
  'emailChangeConfirm.subject': 'Підтвердьте нову email-адресу',
  'emailChangeConfirm.h1': 'Зміна email',
  'emailChangeConfirm.body':
    'Ви вказали цю адресу як нову для акаунта Workflo. Підтвердьте її, щоб завершити зміну.',
  'emailChangeConfirm.cta': 'Підтвердити адресу',
  'emailChangeConfirm.ignore': 'Якщо це не ви — проігноруйте лист, адреса акаунта не зміниться.',
  'emailChangeRequested.subject': 'Запит на зміну email вашого акаунта',
  'emailChangeRequested.h1': 'Зміну email запитано',
  'emailChangeRequested.body':
    'На вашому акаунті Workflo запитано зміну адреси на {newEmail}. Якщо це були ви — підтвердіть лист на новій адресі.',
  'emailChangeRequested.warn': 'Якщо це не ви — негайно змініть пароль у налаштуваннях.',

  // S11 monthly digest
  'monthlyReport.subject': 'Місячний звіт агенції',
  'monthlyReport.body':
    'Короткий підсумок минулого місяця по вашій агенції у Workflo. Деталі — у розділі «Звіти».',
  'monthlyReport.footer':
    'Розсилку можна вимкнути в налаштуваннях агенції (розділ «Звіти на email»).',
  // 19-Г client monthly report (PDF attached)
  'clientMonthlyReport.subject': 'Місячний звіт',
  'clientMonthlyReport.body':
    'Короткий підсумок нашої роботи за минулий місяць. Повний звіт — у PDF-вкладенні до цього листа.',
  'clientMonthlyReport.footer':
    'Питання по звіту? Просто відповідайте на цей лист або напишіть у чат відповідного замовлення.',

  'passwordReset.subject': 'Скидання пароля Workflo',
  'passwordReset.h1': 'Скидання пароля',
  'passwordReset.body':
    'Ми отримали запит на скидання пароля для цього аккаунту. Натисніть кнопку нижче — посилання діє 1 годину.',
  'passwordReset.cta': 'Скинути пароль',
  'passwordReset.ignore':
    'Якщо ви НЕ запитували скидання, проігноруйте цей лист. Пароль не буде змінено без переходу за посиланням.',

  // email verification
  'emailVerification.subject': 'Підтвердьте email для Workflo',
  'emailVerification.h1': 'Підтвердження email',
  'emailVerification.body':
    'Натисніть кнопку нижче, щоб підтвердити цю адресу — посилання діє 24 години. Це відкриє всі можливості акаунту.',
  'emailVerification.cta': 'Підтвердити email',
  'emailVerification.ignore': 'Якщо ви не створювали акаунт Workflo — проігноруйте цей лист.',

  // order status changed
  'orderStatus.subject': 'Оновлення замовлення «{orderTitle}»',
  'orderStatus.h1': 'Статус замовлення оновлено',
  'orderStatus.body': 'Замовлення «{orderTitle}» тепер у статусі: {status}.',
  'orderStatus.cta': 'Переглянути замовлення',
  'orderStatus.s.in_progress': 'В роботі',
  'orderStatus.s.pending_approval': 'Очікує погодження',
  'orderStatus.s.completed': 'Завершено',
  'orderStatus.s.cancelled': 'Скасовано',

  // new comment
  'mentioned.subject': 'Вас згадали у «{orderTitle}»',
  'mentioned.h1': 'Вас згадали в чаті',
  'mentioned.body': '{authorName} згадав(ла) вас у замовленні «{orderTitle}»:',
  'mentioned.cta': 'Відкрити чат',

  'newComment.subject': 'Новий коментар: «{orderTitle}»',
  'newComment.h1': 'Новий коментар',
  'newComment.body': '{authorName} залишив(ла) коментар у замовленні «{orderTitle}»:',
  'newComment.cta': 'Відповісти',

  // invoice sent
  'invoiceSent.subject': 'Рахунок {invoiceNumber}',
  'invoiceSent.h1': 'Виставлено рахунок',
  'invoiceSent.body':
    'Рахунок {invoiceNumber} на суму {amount}. Будь ласка, оплатіть до {dueDate}.',
  'invoiceSent.cta': 'Переглянути рахунок',

  // payment reminder (05-Б дунінг)
  'paymentReminder.subject_upcoming': 'Нагадування: оплата {amountDue} незабаром',
  'paymentReminder.subject_due': 'Сьогодні термін оплати — {amountDue}',
  'paymentReminder.subject_overdue': 'Прострочена оплата — {amountDue}',
  'paymentReminder.h1_upcoming': 'Наближається термін оплати',
  'paymentReminder.h1_due': 'Сьогодні термін оплати',
  'paymentReminder.h1_overdue': 'Оплату прострочено',
  'paymentReminder.body_upcoming':
    'Нагадуємо: до {dueDateLabel} очікуємо оплату {amountDue}. Деталі нарахування — у вашому кабінеті.',
  'paymentReminder.body_due':
    'Сьогодні ({dueDateLabel}) — термін оплати {amountDue}. Деталі нарахування — у вашому кабінеті.',
  'paymentReminder.body_overdue':
    'Оплату {amountDue} прострочено на {daysOverdue} дн. (термін був {dueDateLabel}). Будь ласка, погасіть заборгованість.',
  'paymentReminder.period': 'Період: {periodLabel}.',
  'paymentReminder.cta': 'Переглянути нарахування',
  'paymentReminder.already_paid': 'Якщо ви вже оплатили — проігноруйте цей лист, дякуємо!',

  // order created (team)
  'orderCreated.subject': 'Нове замовлення: {orderTitle}',
  'orderCreated.h1': 'Нове замовлення',
  'orderCreated.body': '«{orderTitle}» — нове замовлення чекає на тріаж і призначення виконавця.',
  'orderCreated.cta': 'Відкрити замовлення',

  // order assigned (executor)
  'orderAssigned.subject': 'Вам призначено замовлення',
  'orderAssigned.h1': 'Нове призначення',
  'orderAssigned.body':
    'Вас призначено виконавцем замовлення «{orderTitle}». Перегляньте деталі та заплануйте роботу.',
  'orderAssigned.cta': 'Відкрити замовлення',

  // approval requested (client, 02-А)
  'approvalRequested.subject': 'Погодьте оцінку — {orderTitle}',
  'approvalRequested.h1': 'Оцінка чекає на погодження',
  'approvalRequested.body':
    'Команда підготувала оцінку по замовленню «{orderTitle}». Перегляньте її та погодьте, щоб ми могли розпочати роботу.',
  'approvalRequested.cta': 'Погодити оцінку',

  // approval decided (team)
  'approvalDecided.subject_ok': 'Оцінку погоджено — {orderTitle}',
  'approvalDecided.subject_no': 'Клієнт запросив правки — {orderTitle}',
  'approvalDecided.h1_ok': 'Клієнт погодив оцінку',
  'approvalDecided.h1_no': 'Клієнт запросив правки',
  'approvalDecided.body_ok': 'Оцінку по «{orderTitle}» погоджено — можна стартувати роботу.',
  'approvalDecided.body_no': 'Клієнт повернув оцінку по «{orderTitle}» на доопрацювання.',
  'approvalDecided.comment': 'Коментар клієнта: «{comment}»',
  'approvalDecided.cta': 'Відкрити замовлення',

  // document sent (client, non-invoice)
  'documentSent.subject': '{documentLabel} {documentNumber} — новий документ',
  'documentSent.h1': 'Новий документ',
  'documentSent.body':
    'Ми надіслали вам документ: {documentLabel} {documentNumber}. Він доступний у вашому кабінеті.',
  'documentSent.cta': 'Переглянути документ',

  // payment received (client)
  'paymentReceived.subject': 'Оплату отримано — {amount}',
  'paymentReceived.h1': 'Дякуємо за оплату',
  'paymentReceived.body':
    'Ми отримали ваш платіж на {amount}. Баланс і рахунки у кабінеті оновлено.',
  'paymentReceived.body_method': 'Спосіб оплати: {method}.',
  'paymentReceived.cta': 'Відкрити кабінет',
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
  // 01-А magic-link + 01-Г email change
  'magicLink.subject': 'Sign in to Workflo with one click',
  'magicLink.h1': 'Passwordless sign-in',
  'magicLink.body':
    'Click the button to sign in to your account. The link is valid for 15 minutes and works once.',
  'magicLink.cta': 'Sign in',
  'magicLink.ignore': 'If you did not request this, just ignore this email.',
  'emailChangeConfirm.subject': 'Confirm your new email address',
  'emailChangeConfirm.h1': 'Email change',
  'emailChangeConfirm.body':
    'You set this address as the new one for your Workflo account. Confirm it to finish the change.',
  'emailChangeConfirm.cta': 'Confirm address',
  'emailChangeConfirm.ignore':
    'If this was not you, ignore this email — the account address will not change.',
  'emailChangeRequested.subject': 'Email change requested on your account',
  'emailChangeRequested.h1': 'Email change requested',
  'emailChangeRequested.body':
    'A change of your Workflo account address to {newEmail} was requested. If it was you, confirm the email sent to the new address.',
  'emailChangeRequested.warn': 'If this was not you, change your password immediately.',

  // S11 monthly digest
  'monthlyReport.subject': 'Agency monthly report',
  'monthlyReport.body':
    'A short summary of last month for your agency in Workflo. Details are in the Reports section.',
  'monthlyReport.footer': 'You can disable this digest in agency settings ("Email reports").',
  // 19-Г client monthly report (PDF attached)
  'clientMonthlyReport.subject': 'Monthly report',
  'clientMonthlyReport.body':
    'A short summary of our work over the past month. The full report is attached as a PDF.',
  'clientMonthlyReport.footer':
    'Questions about the report? Just reply to this email or write in the chat of the relevant order.',

  'passwordReset.subject': 'Reset your Workflo password',
  'passwordReset.h1': 'Reset password',
  'passwordReset.body':
    'We received a request to reset the password for this account. Click below — link is valid for 1 hour.',
  'passwordReset.cta': 'Reset password',
  'passwordReset.ignore':
    'If you did NOT request a reset, ignore this email. Your password will not be changed without you clicking the link.',

  // email verification
  'emailVerification.subject': 'Confirm your email for Workflo',
  'emailVerification.h1': 'Confirm your email',
  'emailVerification.body':
    'Click the button below to confirm this address — the link is valid for 24 hours. This unlocks the full account.',
  'emailVerification.cta': 'Confirm email',
  'emailVerification.ignore': 'If you did not create a Workflo account, ignore this email.',

  // order status changed
  'orderStatus.subject': 'Order update: “{orderTitle}”',
  'orderStatus.h1': 'Order status updated',
  'orderStatus.body': 'Order “{orderTitle}” is now: {status}.',
  'orderStatus.cta': 'View order',
  'orderStatus.s.in_progress': 'In progress',
  'orderStatus.s.pending_approval': 'Pending approval',
  'orderStatus.s.completed': 'Completed',
  'orderStatus.s.cancelled': 'Cancelled',

  // new comment
  'mentioned.subject': 'You were mentioned in “{orderTitle}”',
  'mentioned.h1': 'You were mentioned',
  'mentioned.body': '{authorName} mentioned you in the order “{orderTitle}”:',
  'mentioned.cta': 'Open chat',

  'newComment.subject': 'New comment: “{orderTitle}”',
  'newComment.h1': 'New comment',
  'newComment.body': '{authorName} left a comment on order “{orderTitle}”:',
  'newComment.cta': 'Reply',

  // invoice sent
  'invoiceSent.subject': 'Invoice {invoiceNumber}',
  'invoiceSent.h1': 'Invoice issued',
  'invoiceSent.body': 'Invoice {invoiceNumber} for {amount}. Please pay by {dueDate}.',
  'invoiceSent.cta': 'View invoice',

  // payment reminder (05-Б dunning)
  'paymentReminder.subject_upcoming': 'Reminder: payment of {amountDue} due soon',
  'paymentReminder.subject_due': 'Payment of {amountDue} is due today',
  'paymentReminder.subject_overdue': 'Overdue payment — {amountDue}',
  'paymentReminder.h1_upcoming': 'Payment due soon',
  'paymentReminder.h1_due': 'Payment due today',
  'paymentReminder.h1_overdue': 'Payment overdue',
  'paymentReminder.body_upcoming':
    'A friendly reminder: {amountDue} is due by {dueDateLabel}. See the charge details in your portal.',
  'paymentReminder.body_due':
    'Today ({dueDateLabel}) is the due date for {amountDue}. See the charge details in your portal.',
  'paymentReminder.body_overdue':
    'The payment of {amountDue} is {daysOverdue} day(s) overdue (was due {dueDateLabel}). Please settle the balance.',
  'paymentReminder.period': 'Period: {periodLabel}.',
  'paymentReminder.cta': 'View charge',
  'paymentReminder.already_paid': 'Already paid? Please disregard this email — thank you!',

  'orderCreated.subject': 'New order: {orderTitle}',
  'orderCreated.h1': 'New order',
  'orderCreated.body': '"{orderTitle}" — a new order is waiting for triage and an assignee.',
  'orderCreated.cta': 'Open order',

  'orderAssigned.subject': 'You have been assigned an order',
  'orderAssigned.h1': 'New assignment',
  'orderAssigned.body':
    'You were assigned to "{orderTitle}". Review the details and plan the work.',
  'orderAssigned.cta': 'Open order',

  'approvalRequested.subject': 'Approve the estimate — {orderTitle}',
  'approvalRequested.h1': 'Estimate awaits your approval',
  'approvalRequested.body':
    'The team prepared an estimate for "{orderTitle}". Review and approve it so we can start.',
  'approvalRequested.cta': 'Approve estimate',

  'approvalDecided.subject_ok': 'Estimate approved — {orderTitle}',
  'approvalDecided.subject_no': 'Client requested changes — {orderTitle}',
  'approvalDecided.h1_ok': 'Client approved the estimate',
  'approvalDecided.h1_no': 'Client requested changes',
  'approvalDecided.body_ok': 'The estimate for "{orderTitle}" was approved — work can start.',
  'approvalDecided.body_no': 'The client returned the estimate for "{orderTitle}" for revision.',
  'approvalDecided.comment': 'Client comment: "{comment}"',
  'approvalDecided.cta': 'Open order',

  'documentSent.subject': '{documentLabel} {documentNumber} — new document',
  'documentSent.h1': 'New document',
  'documentSent.body':
    'We sent you a document: {documentLabel} {documentNumber}. It is available in your portal.',
  'documentSent.cta': 'View document',

  'paymentReceived.subject': 'Payment received — {amount}',
  'paymentReceived.h1': 'Thank you for your payment',
  'paymentReceived.body':
    'We received your payment of {amount}. Your balance and invoices are updated.',
  'paymentReceived.body_method': 'Payment method: {method}.',
  'paymentReceived.cta': 'Open portal',
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
