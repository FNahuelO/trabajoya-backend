import { PrismaService } from "../prisma/prisma.service";

/**
 * Ejecuta un cron solo en una instancia de Cloud Run a la vez
 * usando advisory locks de PostgreSQL.
 */
export async function withCronLock(
  prisma: PrismaService,
  lockId: number,
  fn: () => Promise<void>
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(${lockId}) AS locked
  `;

  if (!rows[0]?.locked) {
    return false;
  }

  try {
    await fn();
    return true;
  } finally {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(${lockId})`;
  }
}

export const CRON_LOCK_IDS = {
  NOTIFICATION_CAMPAIGNS: 74_001,
  EXPIRE_ENTITLEMENTS: 74_002,
  APPROVE_PENDING_JOBS: 74_003,
} as const;
