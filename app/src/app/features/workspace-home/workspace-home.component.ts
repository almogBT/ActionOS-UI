import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CalendarEvent, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { CalendarComponent } from '../../shared/calendar/calendar.component';
import { IconComponent } from '../../shared/icons/icon.component';

@Component({
  selector: 'app-workspace-home',
  standalone: true,
  imports: [CommonModule, TranslatePipe, CalendarComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-home.component.html',
  styleUrl: './workspace-home.component.scss'
})
export class WorkspaceHomeComponent {
  @Output() viewChange = new EventEmitter<ViewId>();

  readonly workspace = inject(ActionosWorkspaceService);
  readonly i18n = inject(ActionosI18nService);

  readonly selectedDate = signal<Date>(new Date());

  readonly currentMember = computed(() =>
    this.workspace.members.find(m => m.id === this.workspace.currentUserId)
  );

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  });

  readonly firstName = computed(() => (this.currentMember()?.name ?? 'there').split(' ')[0]);

  readonly todayLabel = computed(() =>
    new Intl.DateTimeFormat(this.i18n.language === 'he' ? 'he-IL' : 'en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(new Date())
  );

  readonly selectedDateLabel = computed(() =>
    new Intl.DateTimeFormat(this.i18n.language === 'he' ? 'he-IL' : 'en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    }).format(this.selectedDate())
  );

  readonly selectedDayEvents = computed(() => this.workspace.calendarEventsForDay(this.selectedDate()));

  readonly summaryLine = computed(() => {
    const meetings = this.workspace.calendarEventsToday.length;
    const tasks = this.workspace.myTasks.length;
    const overdue = this.workspace.overdueTasks.length;
    const parts: string[] = [];
    if (meetings) parts.push(`${meetings} meeting${meetings === 1 ? '' : 's'}`);
    if (tasks) parts.push(`${tasks} open task${tasks === 1 ? '' : 's'}`);
    if (overdue) parts.push(`${overdue} overdue`);
    if (!parts.length) return 'Inbox zero. Calendar clear. Take a breath.';
    return `You have ${parts.join(' · ')} today.`;
  });

  readonly nextEvent = computed(() => this.workspace.nextCalendarEvent);

  openView(view: ViewId): void {
    this.viewChange.emit(view);
  }

  onDaySelected(date: Date): void {
    this.selectedDate.set(date);
  }

  trackEvent(_index: number, event: CalendarEvent): string {
    return event.id;
  }

  formatEventTime(event: CalendarEvent): string {
    return new Intl.DateTimeFormat(this.i18n.language === 'he' ? 'he-IL' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(event.startsAt));
  }
}
