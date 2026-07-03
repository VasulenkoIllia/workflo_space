-- CreateTable
CREATE TABLE "two_factor_auth" (
    "profileId" TEXT NOT NULL,
    "encryptedDek" BYTEA NOT NULL,
    "dekIv" BYTEA NOT NULL,
    "dekAuthTag" BYTEA NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "ciphertextIv" BYTEA NOT NULL,
    "ciphertextAuthTag" BYTEA NOT NULL,
    "enabledAt" TIMESTAMPTZ(3),
    "backupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "two_factor_auth_pkey" PRIMARY KEY ("profileId")
);

-- AddForeignKey
ALTER TABLE "two_factor_auth" ADD CONSTRAINT "two_factor_auth_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
