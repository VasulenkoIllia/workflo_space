-- S10 @mention: profile ids mentioned in a chat message (visibility-validated
-- server-side on create).
ALTER TABLE "order_comments" ADD COLUMN "mentionIds" TEXT[] NOT NULL DEFAULT '{}';
