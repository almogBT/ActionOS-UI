import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal
} from '@angular/core';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { CalendarEvent } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

export type CalendarMode = 'day' | 'week' | 'month';

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

  /** When provided, replaces workspace.calendarEvents as the event source. */
  @Input() set events(val: CalendarEvent[] | null | undefined) {
    const next = val ?? null;
    if (this.haveSameEvents(this._overrideEvents(), next)) {
      return;
    }
    this._overrideEvents.set(next);
  }

  /** Set to true to show the filter toggle button in the header. */
  @Input() hasFilter = false;

  @Output() readonly daySelected = new EventEmitter<Date>();
  @Output() readonly eventOpened = new EventEmitter<CalendarEvent>();
  @Output() readonly expandedChange = new EventEmitter<boolean>();
  /** Emitted when an empty hour cell is clicked in week/day view (date carries the clicked hour). */
  @Output() readonly slotSelected = new EventEmitter<Date>();

  private readonly _cursor = signal<Date>(this.startOfMonth(new Date()));
  private readonly _selected = signal<Date>(this.startOfDay(new Date()));
  private readonly _overrideEvents = signal<CalendarEvent[] | null>(null);

  readonly cursor = this._cursor.asReadonly();
  readonly selected = this._selected.asReadonly();

  readonly isExpanded  = signal(false);
  readonly filterOpen  = signal(false);
  readonly calendarMode = signal<CalendarMode>('month');

  // Hours displayed in week/day views (7 AM – 8 PM)
  readonly hours = Array.from({ length: 14 }, (_, i) => i + 7);

  private readonly sourceEvents = computed<CalendarEvent[]>(() =>
    this._overrideEvents() ?? this.workspace.calendarEvents
  );

  readonly nextEvent = computed(() => {
    const now = new Date().toISOString();
    const upcoming = this.sourceEvents().filter(e => e.startsAt >= now);
    // Prefer the next meeting; fall back to the next task so a tasks-only feed
    // (e.g. the Tasks page) still shows something useful in the compact strip.
    return upcoming.find(e => e.kind !== 'task') ?? upcoming[0];
  });

  readonly periodLabel = computed(() => {
    const mode = this.calendarMode();
    const locale = this.i18n.language === 'he' ? 'he-IL' : 'en-GB';
    if (mode === 'month') {
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(this._cursor());
    }
    const sel = this._selected();
    if (mode === 'day') {
      return new Intl.DateTimeFormat(locale, {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      }).format(sel);
    }
    const start = this.startOfWeek(sel);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const short = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
    const year = new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(end);
    return `${short.format(start)} – ${short.format(end)}, ${year}`;
  });

  readonly weekdayLabels = computed(() => {
    const locale = this.i18n.language === 'he' ? 'he-IL' : 'en-GB';
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
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
    gridStart.setDate(first.getDate() - first.getDay());
    const eventCounts = this.sourceEvents();

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

  readonly weekDays = computed(() => {
    const start = this.startOfWeek(this._selected());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  });

  readonly selectedDayEvents = computed(() => {
    const key = this.toIso(this._selected());
    return this.sourceEvents().filter(e => e.startsAt.slice(0, 10) === key);
  });

  toggleExpand(): void {
    this.isExpanded.update(v => !v);
    this.expandedChange.emit(this.isExpanded());
    if (!this.isExpanded()) { this.filterOpen.set(false); }
  }

  toggleFilter(): void {
    this.filterOpen.update(v => !v);
  }

  openEvent(evt: CalendarEvent): void {
    this.eventOpened.emit(evt);
  }

  /** A blank hour cell was clicked — emit the precise date + hour so the host
   *  page can open the right creator (meeting/task) at that time. */
  selectSlot(day: Date, hour: number): void {
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0);
    this.slotSelected.emit(d);
  }

  setMode(mode: CalendarMode): void {
    this.calendarMode.set(mode);
  }

  prevPeriod(): void {
    const mode = this.calendarMode();
    if (mode === 'month') { this.prevMonth(); return; }
    const d = new Date(this._selected());
    d.setDate(d.getDate() - (mode === 'week' ? 7 : 1));
    const next = this.startOfDay(d);
    this._selected.set(next);
    this.daySelected.emit(next);
  }

  nextPeriod(): void {
    const mode = this.calendarMode();
    if (mode === 'month') { this.nextMonth(); return; }
    const d = new Date(this._selected());
    d.setDate(d.getDate() + (mode === 'week' ? 7 : 1));
    const next = this.startOfDay(d);
    this._selected.set(next);
    this.daySelected.emit(next);
  }

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

  jumpToDay(date: Date): void {
    const d = this.startOfDay(date);
    this._cursor.set(this.startOfMonth(d));
    this._selected.set(d);
    this.daySelected.emit(d);
    this.calendarMode.set('day');
  }

  selectDay(day: CalendarDay): void {
    const d = this.startOfDay(day.date);
    this._selected.set(d);
    if (!day.inMonth) {
      this._cursor.set(this.startOfMonth(day.date));
    }
    this.daySelected.emit(d);
    const wasExpanded = this.isExpanded();
    this.isExpanded.set(true);
    if (!wasExpanded) { this.expandedChange.emit(true); }
    this.calendarMode.set('day');
  }

  isToday(date: Date): boolean {
    return this.toIso(date) === this.toIso(new Date());
  }

  isSameDay(a: Date, b: Date): boolean {
    return this.toIso(a) === this.toIso(b);
  }

  weekDayLabel(date: Date): string {
    const locale = this.i18n.language === 'he' ? 'he-IL' : 'en-GB';
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
  }

  formatHour(hour: number): string {
    const d = new Date(2024, 0, 1, hour, 0);
    return new Intl.DateTimeFormat(this.i18n.language === 'he' ? 'he-IL' : 'en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    }).format(d);
  }

  eventsForDayHour(date: Date, hour: number): CalendarEvent[] {
    const iso = this.toIso(date);
    return this.sourceEvents().filter(e => {
      const d = new Date(e.startsAt);
      return this.toIso(d) === iso && d.getHours() === hour;
    });
  }

  formatEventTime(event: CalendarEvent): string {
    const d = new Date(event.startsAt);
    return new Intl.DateTimeFormat(this.i18n.language === 'he' ? 'he-IL' : 'en-US', {
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  }

  trackDay(_index: number, day: CalendarDay): string {
    return day.iso;
  }

  trackEvent(_index: number, event: CalendarEvent): string {
    return event.id;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private startOfWeek(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay()); // back to Sunday
    return this.startOfDay(d);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private toIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private haveSameEvents(left: CalendarEvent[] | null, right: CalendarEvent[] | null): boolean {
    if (left === right) {
      return true;
    }
    if (!left || !right || left.length !== right.length) {
      return false;
    }

    return left.every((event, index) => {
      const other = right[index];
      return event.id === other.id
        && event.title === other.title
        && event.startsAt === other.startsAt
        && event.durationMinutes === other.durationMinutes
        && event.kind === other.kind
        && event.customerName === other.customerName
        && event.linkedBoard === other.linkedBoard
        && event.attendeeCount === other.attendeeCount
        && event.sourceId === other.sourceId;
    });
  }
}
