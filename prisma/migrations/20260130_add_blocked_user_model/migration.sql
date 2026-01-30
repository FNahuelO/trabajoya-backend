-- CreateTable
CREATE TABLE IF NOT EXISTS "BlockedUser" (
    "id" TEXT NOT NULL,
    "blockerUserId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BlockedUser_blockerUserId_blockedUserId_key" ON "BlockedUser"("blockerUserId", "blockedUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BlockedUser_blockerUserId_idx" ON "BlockedUser"("blockerUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BlockedUser_blockedUserId_idx" ON "BlockedUser"("blockedUserId");

-- AddForeignKey
ALTER TABLE "BlockedUser" ADD CONSTRAINT "BlockedUser_blockerUserId_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedUser" ADD CONSTRAINT "BlockedUser_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

