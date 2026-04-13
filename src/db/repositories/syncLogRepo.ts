import prisma from '../prismaClient';

export async function logQueued(platform: string, jobType: string): Promise<bigint> {
  const row = await prisma.syncLog.create({
    data: { platform, job_type: jobType, status: 'queued' },
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
      records_fetched: data.recordsFetched,
      records_saved: data.recordsSaved,
      records_skipped: data.recordsSkipped,
      duration_ms: data.durationMs,
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
      error_message: data.errorMessage,
      duration_ms: data.durationMs,
    },
  });
}
