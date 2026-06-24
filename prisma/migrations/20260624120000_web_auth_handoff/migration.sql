-- CreateTable
CREATE TABLE "WebAuthHandoff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "returnPath" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAuthHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebAuthHandoff_codeHash_key" ON "WebAuthHandoff"("codeHash");

-- CreateIndex
CREATE INDEX "WebAuthHandoff_userId_idx" ON "WebAuthHandoff"("userId");

-- CreateIndex
CREATE INDEX "WebAuthHandoff_expiresAt_idx" ON "WebAuthHandoff"("expiresAt");

-- AddForeignKey
ALTER TABLE "WebAuthHandoff" ADD CONSTRAINT "WebAuthHandoff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
