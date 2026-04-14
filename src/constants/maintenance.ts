export const MAINTENANCE_PLATFORM = 'maintenance';
export const MAINTENANCE_QUEUE    = 'maintenance';

export const MAINTENANCE_JOBS = {
  DAILY_SUMMARY: 'maintenance:daily-summary',
  CLEANUP_LOGS:  'maintenance:cleanup-logs',
} as const;
