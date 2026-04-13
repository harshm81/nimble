import prisma from '../prismaClient';

export async function getLastSyncedAt(platform: string, jobType: string): Promise<Date | null> {
  const config = await prisma.syncConfig.findUnique({
    where: { platform_job_type: { platform, job_type: jobType } },
    select: { last_synced_at: true },
  });
  return config?.last_synced_at ?? null;
}

export function setLastSyncedAt(platform: string, jobType: string, date: Date) {
  return prisma.syncConfig.update({
    where: { platform_job_type: { platform, job_type: jobType } },
    data: { last_synced_at: date },
  });
}

export function ensureConfig(platform: string, jobType: string, intervalMinutes: number) {
  return prisma.syncConfig.upsert({
    where: { platform_job_type: { platform, job_type: jobType } },
    create: { platform, job_type: jobType, interval_minutes: intervalMinutes },
    update: {},
  });
}
