-- Composite indexes for cursor pagination and hot list queries at scale.
-- IF NOT EXISTS keeps this safe to apply on databases that were previously
-- created with `prisma db push` (which may already have some of these).

-- CreateIndex
CREATE INDEX IF NOT EXISTS "files_userId_createdAt_id_idx" ON "files"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "files_userId_status_createdAt_idx" ON "files"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sessions_userId_type_updatedAt_id_idx" ON "sessions"("userId", "type", "updatedAt", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_sessionId_createdAt_id_idx" ON "messages"("sessionId", "createdAt", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "clips_userId_createdAt_id_idx" ON "clips"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "clips_fileId_createdAt_idx" ON "clips"("fileId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jobs_status_createdAt_idx" ON "jobs"("status", "createdAt");
