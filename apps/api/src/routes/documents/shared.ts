/**
 * R2 (аудит r6): спільний select документа для трьох роут-файлів модуля 06
 * (orderDocuments / contracts / companyDocuments).
 */
export const DOC_SELECT = {
  id: true,
  type: true,
  number: true,
  status: true,
  generatedAt: true,
  sentAt: true,
  // 06-ПІДПИС: хто і коли прийняв (для бейджів/тултіпів обох апок)
  acceptedAt: true,
  acceptedByName: true,
  // 06-ДОГОВІР-2: зовнішній договір (файл/лінк; storedAs = ознака наявності файла)
  signedExternally: true,
  contractDate: true,
  externalUrl: true,
  storedAs: true,
} as const
