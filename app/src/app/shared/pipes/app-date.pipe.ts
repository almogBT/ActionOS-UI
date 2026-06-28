import { Pipe, PipeTransform } from '@angular/core';
import { AppDateDisplayMode, formatDisplayDate } from '../utils/date-display';

/**
 * App-wide date display pipe. Renders any date value as dd/mm/yyyy
 * (or dd/mm/yyyy HH:mm when mode === 'datetime').
 *
 * This is for DISPLAY only - never bind it to a native <input type="date">,
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
    mode: AppDateDisplayMode = 'date',
    fallback = ''
  ): string {
    return formatDisplayDate(value, mode, fallback);
  }
}