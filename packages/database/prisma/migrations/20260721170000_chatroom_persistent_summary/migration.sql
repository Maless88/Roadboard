-- AlterTable
ALTER TABLE "chat_rooms" ADD COLUMN     "summary_text" TEXT,
ADD COLUMN     "summary_tokens" INTEGER,
ADD COLUMN     "summary_up_to_message_id" TEXT,
ADD COLUMN     "summary_updated_at" TIMESTAMP(3);

