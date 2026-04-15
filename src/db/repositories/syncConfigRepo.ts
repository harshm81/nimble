import prisma from '../prismaClient';

export async function getLastSyncedAt(platform: string, jobType: string): Promise<Date | null> {
  const config = await prisma.syncConfig.findUnique({
    where: { platform_job_type: { platform, jobType } },
    select: { lastSyncedAt: true },
  });
  return config?.lastSyncedAt ?? null;
}

export function setLastSyncedAt(platform: string, jobType: string, date: Date) {
  return prisma.syncConfig.upsert({
    where: { platform_job_type: { platform, jobType } },
    create: { platform, jobType, lastSyncedAt: date },
    update: { lastSyncedAt: date },
  });
}
