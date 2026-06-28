export type AppDateDisplayMode = 'date' | 'datetime';

export function formatDisplayDate(
  value: string | number | Date | null | undefined,
  mode: AppDateDisplayMode = 'date',
  fallback = ''
): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const date = coerceDisplayDate(value);
  if (!date) {
    return String(value);
  }

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const datePart = `${dd}/${mm}/${yyyy}`;

  if (mode === 'datetime') {
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${datePart} ${hh}:${min}`;
  }

  return datePart;
}

function coerceDisplayDate(value: string | number | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (isoDateOnly) {
      return new Date(Number(isoDateOnly[1]), Number(isoDateOnly[2]) - 1, Number(isoDateOnly[3]));
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}