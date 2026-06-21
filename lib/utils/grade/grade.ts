export function normalizeGrade(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : 0;
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }

  if (value == null) {
    return 0;
  }

  const parsed = parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}
