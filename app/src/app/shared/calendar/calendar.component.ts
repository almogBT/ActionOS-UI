import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { CalendarEvent } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

interface CalendarDay {
  date: Date;
  iso: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: CalendarEvent[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss'
})
export class CalendarComponent {
  private readonly workspace = inject(ActionosWorkspaceService);
  private readonly i18n = inject(ActionosI18nService);

  @Input() set selectedDate(value: Date | null | undefined) {
    if (value) {
      this._selected.set(this.startOfDay(value));
      this._cursor.set(new Date(value.getFullYear(), value.getMonth(), 1));
    }
  }

  @Output() readonly daySelected = new EventEmitter<Date>();

  private readonly _cursor = signal<Date>(this.startOfMonth(new Date()));
  private readonly _selected = signal<Date>(this.startOfDay(new Date()));

  readonly cursor = this._cursor.asReadonly();
  readonly selected = this._selected.asReadonly();

  readonly monthLabel = computed(() => {
    const cursor = this._cursor();
    return new Intl.DateTimeFormat(this.i18n.language === 'he' ? 'he-IL' : 'en-US', {
      month: 'long',
      year: 'numeric'
    }).format(cursor);
  });

  readonly weekdayLabels = computed(() => {
    const locale = this.i18n.language === 'he' ? 'he-IL' : 'en-US';
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // Sunday-first to match both en-US convention and Hebrew week start.
    const base = new Date(2024, 0, 7); // Sun Jan 7 2024
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return fmt.format(d);
    });
  });

  readonly days = computed<CalendarDay[]>(() => {
    const cursor = this._cursor();
    const selected = this._selected();
    const todayIso = this.toIso(new Date());
    const selectedIso = this.toIso(selected);

    const first = this.startOfMonth(cursor);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay()); // back to the prior Sunday
    const eventCounts = this.workspace.calendarEvents;

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      const iso = this.toIso(date);
      const events = eventCounts.filter(event => event.startsAt.slice(0, 10) === iso);

      return {
        date,
        iso,
        dayNumber: date.getDate(),
        inMonth: date.getMonth() === cursor.getMonth(),
        isToday: iso === todayIso,
        isSelected: iso === selectedIso,
        events
      } satisfies CalendarDay;
    });
  });

  readonly selectedDayEvents = computed(() =>
    this.workspace.calendarEventsForDay(this._selected())
  );

  prevMonth(): void {
    const cur = this._cursor();
    this._cursor.set(new Date(cur.getFullYear(), cur.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const cur = this._cursor();
    this._cursor.set(new Date(cur.getFullYear(), cur.getMonth() + 1, 1));
  }

  jumpToToday(): void {
    const today = this.startOfDay(new Date());
    this._cursor.set(this.startOfMonth(today));
    this._selected.set(today);
    this.daySelected.emit(today);
  }

  selectDay(day: CalendarDay): void {
    this._selected.set(this.startOfDay(day.date));
    if (!day.inMonth) {
      this._cursor.set(this.startOfMonth(day.date));
    }
    this.daySelected.emit(this.startOfDay(day.date));
  }

  trackDay(_index: number, day: CalendarDay): string {
    return day.iso;
  }

  trackEvent(_index: number, event: CalendarEvent): string {
    return event.id;
  }

  formatEventTime(event: CalendarEvent): string {
    const d = new Date(event.startsAt);
    return new Intl.DateTimeFormat(this.i18n.language === 'he' ? 'he-IL' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private toIso(date: Date): string {
    // Local-date ISO (YYYY-MM-DD) — avoids timezone shifting that would push
    // a calendar cell back/forward a day around midnight UTC.
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
