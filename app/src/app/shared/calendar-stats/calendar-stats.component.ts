import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CalendarEvent } from '../../core/models/actionos.models';
import { CalendarComponent } from '../calendar/calendar.component';

/**
 * Calendar + KPI stat tiles as a single, consistent unit used across ActionOS
 * (meetings, my-work, tasks, …). While the calendar is collapsed it renders as
 * ONE seamless card — calendar on top, the projected stat tiles attached below
 * as flush segments. Expanding the calendar detaches them back into separate
 * blocks so the full month view has room to breathe.
 *
 * Pages stay in control of their own tiles: drop any number of <app-stat-tile>
 * (or other tile markup) between the tags and they're projected into the tile
 * row. An optional calendar filter control can be projected via
 * `[calendarFilters]` and is forwarded into the calendar header.
 *
 *   <app-calendar-stats [events]="events" (eventOpened)="open($event)">
 *     <app-stat-tile ...></app-stat-tile>
 *     <app-stat-tile ...></app-stat-tile>
 *   </app-calendar-stats>
 */
@Component({
  selector: 'app-calendar-stats',
  standalone: true,
  imports: [CommonModule, CalendarComponent],
  template: `
    <div class="cal-stats-card" [class.attached]="!expanded">
      <app-calendar
        [events]="events"
        [hasFilter]="hasFilter"
        (eventOpened)="eventOpened.emit($event)"
        (daySelected)="daySelected.emit($event)"
        (expandedChange)="onExpandedChange($event)"
      >
        <ng-content select="[calendarFilters]"></ng-content>
      </app-calendar>

      <div class="stat-tile-row">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styleUrl: './calendar-stats.component.scss'
})
export class CalendarStatsComponent {
  /** Event source forwarded to the embedded calendar. */
  @Input() events: CalendarEvent[] | null = null;

  /** Show the calendar's filter toggle (projected via [calendarFilter]). */
  @Input() hasFilter = false;

  @Output() eventOpened = new EventEmitter<CalendarEvent>();
  @Output() daySelected = new EventEmitter<Date>();
  /** Mirrors the calendar's collapse state for callers that care. */
  @Output() expandedChange = new EventEmitter<boolean>();

  /** Drives the "attached" (collapsed) vs "detached" (expanded) treatment. */
  expanded = false;

  onExpandedChange(value: boolean): void {
    this.expanded = value;
    this.expandedChange.emit(value);
  }
}
