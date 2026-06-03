import { Pipe, PipeTransform } from '@angular/core';

/**
 * App-wide date display pipe. Renders any date value as dd/mm/yyyy
 * (or dd/mm/yyyy HH:mm when mode === 'datetime').
 *
 * This is for DISPLAY only — never bind it to a native <input type="date">,
 * which requires the ISO yyyy-MM-dd format.
 *
 * Usage:
 *   {{ meeting.meetingDate | appDate }}            -> 09/06/2026
 *   {{ task.completedAt   | appDate:'datetime' }}  -> 09/06/2026 14:30
 */
@Pipe({
  name: 'appDate',
  standalone: true,
  pure: true
})
export class AppDatePipe implements PipeTransform {
  transform(
    value: string | number | Date | null | undefined,
    mode: 'date' | 'datetime' = 'date',
    fallback = ''
  ): string {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      // Not a parseable date — leave the original text untouched.
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
}
