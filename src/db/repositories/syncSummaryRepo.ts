import prisma from '../prismaClient';

export async function writeDailySummary(date: Date): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO sync_log_daily_summary
      (date, platform, job_type, total_runs, success_count, failure_count,
       total_records_fetched, total_records_saved, total_records_failed,
       avg_duration_ms, max_duration_ms)
    SELECT
      DATE(created_at)            AS date,
      platform,
      job_type,
      COUNT(*)                    AS total_runs,
      SUM(status = 'success')     AS success_count,
      SUM(status = 'failed')      AS failure_count,
      SUM(records_fetched)        AS total_records_fetched,
      SUM(records_saved)          AS total_records_saved,
      SUM(records_failed)         AS total_records_failed,
      ROUND(AVG(duration_ms))     AS avg_duration_ms,
      MAX(duration_ms)            AS max_duration_ms
    FROM sync_logs
    WHERE DATE(created_at) = DATE(${date}) - INTERVAL 1 DAY
    GROUP BY DATE(created_at), platform, job_type
    ON DUPLICATE KEY UPDATE
      total_runs            = VALUES(total_runs),
      success_count         = VALUES(success_count),
      failure_count         = VALUES(failure_count),
      total_records_fetched = VALUES(total_records_fetched),
      total_records_saved   = VALUES(total_records_saved),
      total_records_failed  = VALUES(total_records_failed),
      avg_duration_ms       = VALUES(avg_duration_ms),
      max_duration_ms       = VALUES(max_duration_ms)
  `;
}

// Disabled: sync logs are kept indefinitely for debugging. Uncomment to re-enable 90-day cleanup.
// export async function cleanupOldLogs(): Promise<number> {
//   return prisma.$executeRaw`
//     DELETE FROM sync_logs WHERE created_at < NOW() - INTERVAL 90 DAY
//   `;
// }
