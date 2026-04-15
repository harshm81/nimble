export function parseGa4Date(yyyymmdd: string | null | undefined): Date {
  if (!yyyymmdd) throw new Error('GA4 row missing required date field');
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}
