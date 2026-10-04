-- AlterTable
ALTER TABLE "order_comments" ADD COLUMN     "replyToId" TEXT;

-- AlterTable
ALTER TABLE "order_files" ADD COLUMN     "commentId" TEXT;

-- CreateIndex
CREATE INDEX "order_comments_replyToId_idx" ON "order_comments"("replyToId");

-- CreateIndex
CREATE INDEX "order_files_commentId_idx" ON "order_files"("commentId");

-- AddForeignKey
ALTER TABLE "order_comments" ADD CONSTRAINT "order_comments_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "order_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_files" ADD CONSTRAINT "order_files_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "order_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
