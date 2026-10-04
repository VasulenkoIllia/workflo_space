-- S10 chat tails: reactions table + technical updatedAt on comments (canon 03-B/C).
ALTER TABLE "order_comments"
  ADD COLUMN "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "comment_reactions" (
  "id" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "comment_reactions_commentId_profileId_emoji_key"
  ON "comment_reactions"("commentId", "profileId", "emoji");
CREATE INDEX "comment_reactions_commentId_idx" ON "comment_reactions"("commentId");

ALTER TABLE "comment_reactions"
  ADD CONSTRAINT "comment_reactions_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "order_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment_reactions"
  ADD CONSTRAINT "comment_reactions_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
