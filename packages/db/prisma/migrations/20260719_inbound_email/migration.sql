-- S12-05 EMAIL-INBOUND: вхідний лист на support-скриньку → тікет (або відповідь у тред).
-- Новий стовпець на ticket_messages: RFC Message-ID листа-джерела. UNIQUE дає
-- ідемпотентність повторного IMAP-полінгу + тредінг вхідних (In-Reply-To ↔ цей ID).
-- Нових таблиць нема — RLS на ticket_messages уже FORCE (SUP-MVP).

ALTER TABLE "ticket_messages"
  ADD COLUMN "sourceMessageId" TEXT;

CREATE UNIQUE INDEX "ticket_messages_sourceMessageId_key"
  ON "ticket_messages"("sourceMessageId");
