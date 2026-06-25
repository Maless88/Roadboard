-- CreateTable
CREATE TABLE "agent_user_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "enc_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_user_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_user_credentials_user_id_provider_key" ON "agent_user_credentials"("user_id", "provider");

-- CreateIndex
CREATE INDEX "agent_user_credentials_user_id_idx" ON "agent_user_credentials"("user_id");
