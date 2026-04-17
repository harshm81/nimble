import prisma from '../prismaClient';

export async function logQueued(platform: string, jobType: string): Promise<bigint> {
  const row = await prisma.syncLog.create({
    data: { platform, jobType, status: 'queued' },
    select: { id: true },
  });
  return row.id;
}

export function logRunning(id: bigint): Promise<{ id: bigint }> {
  return prisma.syncLog.update({
    where: { id },
    data: { status: 'running' },
    select: { id: true },
  });
}

export function logSuccess(
  id: bigint,
  data: {
    recordsFetched: number;
    recordsSaved: number;
    recordsSkipped: number;
    durationMs: number;
  },
) {
  return prisma.syncLog.update({
    where: { id },
    data: {
      status: 'success',
      recordsFetched: data.recordsFetched,
      recordsSaved: data.recordsSaved,
      recordsSkipped: data.recordsSkipped,
      durationMs: data.durationMs,
    },
  });
}

export function logFailure(
  id: bigint,
  data: {
    errorMessage: string;
    durationMs: number;
  },
) {
  return prisma.syncLog.update({
    where: { id },
    data: {
      status: 'failed',
      errorMessage: data.errorMessage,
      durationMs: data.durationMs,
    },
  });
}

// Marks any stuck 'running' entries for a platform as failed.
// Called from the BullMQ 'stalled' event — the catch block never fires for stalled jobs.
export function logStalled(platform: string, jobType: string) {
  return prisma.syncLog.updateMany({
    where: { platform, jobType, status: 'running' },
    data: {
      status: 'failed',
      errorMessage: 'Job stalled — BullMQ lock expired before completion',
    },
  });
}
