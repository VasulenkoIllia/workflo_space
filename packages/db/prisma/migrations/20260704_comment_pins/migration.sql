-- 03-Г pinned messages: ТЗ/реквізити/домовленості anchored at the top of the chat.
ALTER TABLE "order_comments"
  ADD COLUMN "pinnedAt" TIMESTAMPTZ(3),
  ADD COLUMN "pinnedById" TEXT;

CREATE INDEX "order_comments_orderId_pinnedAt_idx" ON "order_comments"("orderId", "pinnedAt");
