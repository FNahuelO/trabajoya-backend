-- CreateIndex
CREATE INDEX "Message_fromUserId_toUserId_createdAt_idx"
ON "Message"("fromUserId", "toUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Message_toUserId_fromUserId_createdAt_idx"
ON "Message"("toUserId", "fromUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Message_toUserId_isRead_idx"
ON "Message"("toUserId", "isRead");

-- CreateIndex
CREATE INDEX "Message_toUserId_isDelivered_idx"
ON "Message"("toUserId", "isDelivered");
