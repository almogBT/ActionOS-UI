import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CalendarEvent, CustomerMeeting, MeetingNote, Task, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { CalendarStatsComponent } from '../../shared/calendar-stats/calendar-stats.component';
import { MeetingCardComponent } from '../../shared/meeting-card/meeting-card.component';
import { IconComponent } from '../../shared/icons/icon.component';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import { StatMeetingsViewComponent } from '../../shared/stat-modal/stat-meetings-view.component';
import { StatModalComponent } from '../../shared/stat-modal/stat-modal.component';
import { StatTasksViewComponent } from '../../shared/stat-modal/stat-tasks-view.component';
import { StatTileComponent } from '../../shared/stat-tile/stat-tile.component';
import { TaskTableComponent } from '../../shared/task-table/task-table.component';
import { InboxComponent } from '../inbox/inbox.component';

export type MeetingFilter = 'upcoming' | 'led' | 'past';
export type TaskFilter = 'mine' | 'delegated' | 'all-involved';

/** Which summary-tile popup is open (null = none). */
export type StatModalKey = 'overdue' | 'today' | 'followups' | 'meetings';

@Component({
  selector: 'app-my-work',
  standalone: true,
  imports: [
    CommonModule, TranslatePipe, AppDatePipe, InboxComponent, TaskTableComponent, IconComponent,
    CalendarStatsComponent, MeetingCardComponent, StatModalComponent, StatTasksViewComponent,
    StatMeetingsViewComponent, StatTileComponent
  ],
  templateUrl: './my-work.component.html',
  styleUrl: './my-work.component.scss'
})
export class MyWorkComponent {
  @Output() viewChange = new EventEmitter<ViewId>();

  readonly workspace = inject(ActionosWorkspaceService);
  readonly i18n = inject(ActionosI18nService);

  readonly activeTab = signal<'inbox' | 'tasks' | 'meetings'>('inbox');

  /** Which summary-tile popup is open (null = none). */
  readonly statModal = signal<StatModalKey | null>(null);

  meetingFilter: MeetingFilter = 'upcoming';
  taskFilter: TaskFilter = 'mine';

  readonly meetingFilterOptions: { id: MeetingFilter; labelKey: string }[] = [
    { id: 'upcoming', labelKey: 'myWork.meetings.upcoming' },
    { id: 'led',      labelKey: 'myWork.meetings.led' },
    { id: 'past',     labelKey: 'myWork.meetings.past' }
  ];

  readonly taskFilterOptions: { id: TaskFilter; labelKey: string }[] = [
    { id: 'mine',         labelKey: 'myWork.tasks.mine' },
    { id: 'delegated',    labelKey: 'myWork.tasks.delegated' },
    { id: 'all-involved', labelKey: 'myWork.tasks.allInvolved' }
  ];

  // ── Meetings ────────────────────────────────────────────────────────────────

  get myMeetings(): CustomerMeeting[] {
    const empId = this.workspace.currentEmployeeId;
    const all = this.workspace.customerMeetings;
    const isMine = (m: CustomerMeeting) =>
      m.meetingLeaderEmployeeId === empId || m.internalParticipantEmployeeIds.includes(empId);

    switch (this.meetingFilter) {
      case 'upcoming': return all.filter(m => isMine(m) && m.status !== 'Closed');
      case 'led':      return all.filter(m => m.meetingLeaderEmployeeId === empId && m.status !== 'Closed');
      case 'past':     return all.filter(m => isMine(m) && m.status === 'Closed');
      default:         return [];
    }
  }

  isMeetingLed(m: CustomerMeeting): boolean {
    return m.meetingLeaderEmployeeId === this.workspace.currentEmployeeId;
  }

  meetingTaskCount(m: CustomerMeeting): number {
    return this.workspace.meetingTasksByMeeting(m.id).length;
  }

  meetingActionItems(m: CustomerMeeting): MeetingNote[] {
    return m.notes.filter(n => n.type === 'action' && !n.convertedTaskId);
  }

  // ── Tasks ───────────────────────────────────────────────────────────────────

  get myFilteredTasks(): Task[] {
    const empId = this.workspace.currentEmployeeId;
    const active = this.workspace.meetingTasks.filter(
      t => t.status !== 'Done' && t.status !== 'Cancelled'
    );

    switch (this.taskFilter) {
      case 'mine':
        return active.filter(t => t.assignedToEmployeeId === empId);
      case 'delegated':
        return active.filter(t => t.openedByEmployeeId === empId && t.assignedToEmployeeId !== empId);
      case 'all-involved':
        return active.filter(t => t.assignedToEmployeeId === empId || t.openedByEmployeeId === empId);
      default:
        return [];
    }
  }

  /** Drives the overdue (danger) accent on the tasks tab count. */
  get hasOverdueTasks(): boolean {
    const today = this.workspace.todayIso;
    return this.myFilteredTasks.some(t => !!t.dueDate && t.dueDate < today);
  }

  // ── Greeting header ───────────────────────────────────────────────────────

  get greetingKey(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'home.greetingMorning';
    if (hour < 17) return 'home.greetingAfternoon';
    return 'home.greetingEvening';
  }

  get firstName(): string {
    const full = this.workspace.employee(this.workspace.currentEmployeeId)?.fullName
      ?? this.i18n.translate('home.greetingFallbackName');
    return full.split(' ')[0];
  }

  get todayLabel(): string {
    return new Intl.DateTimeFormat(this.i18n.language === 'he' ? 'he-IL' : 'en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    }).format(new Date());
  }

  // ── Calendar / Next up ──────────────────────────────────────────────────────

  get myCalEvents(): CalendarEvent[] {
    return this.workspace.myCalendarEvents;
  }

  onCalEventOpened(evt: CalendarEvent): void {
    if (evt.kind === 'task') {
      const task = this.workspace.openTasks.find(t => t.id === evt.sourceId);
      if (task) this.workspace.selectMeetingTask(task);
    } else {
      this.workspace.openMeetingDrawer(evt.sourceId);
    }
  }

  // ── Summary strip ─────────────────────────────────────────────────────────
  // Glanceable, tab-independent lists shown above the tabs. All four use the
  // same "mine" semantics as the Tasks "My tasks" filter so a tile never
  // disagrees with the popup it opens. Counts are derived from the same lists
  // the popups render, so the number and the list can never drift apart.

  private get myActiveTasks(): Task[] {
    const empId = this.workspace.currentEmployeeId;
    return this.workspace.meetingTasks.filter(
      t => t.status !== 'Done' && t.status !== 'Cancelled' && t.assignedToEmployeeId === empId
    );
  }

  get overdueTasksList(): Task[] {
    const today = this.workspace.todayIso;
    return this.myActiveTasks.filter(t => !!t.dueDate && t.dueDate < today);
  }

  get todayTasksList(): Task[] {
    const today = this.workspace.todayIso;
    return this.myActiveTasks.filter(t => !!t.dueDate && t.dueDate === today);
  }

  get meetingsTodayList(): CustomerMeeting[] {
    const empId = this.workspace.currentEmployeeId;
    return this.workspace.meetingsToday.filter(
      m => m.meetingLeaderEmployeeId === empId || m.internalParticipantEmployeeIds.includes(empId)
    );
  }

  /** Unconverted meeting action items assigned to me ({ note, meeting } pairs). */
  get followupItems(): Array<{ note: MeetingNote; meeting: CustomerMeeting }> {
    return this.workspace.myUnconvertedActionItems;
  }

  get summaryOverdue(): number { return this.overdueTasksList.length; }
  get summaryToday(): number { return this.todayTasksList.length; }
  get summaryFollowups(): number { return this.followupItems.length; }
  get summaryMeetingsToday(): number { return this.meetingsTodayList.length; }

  /** Tasks-tab count shown in the segmented control. */
  get tasksTabCount(): number {
    return this.myFilteredTasks.length;
  }

  // ── Summary-tile popups ─────────────────────────────────────────────────────
  // Each tile opens the same popup the rest of the app uses (shared stat-modal
  // shell + the matching tasks / meetings body), instead of switching tabs.

  openStat(key: StatModalKey): void { this.statModal.set(key); }
  closeStat(): void { this.statModal.set(null); }

  get statTitleKey(): string {
    switch (this.statModal()) {
      case 'overdue':   return 'myWork.summary.overdue';
      case 'today':     return 'myWork.summary.today';
      case 'followups': return 'myWork.summary.followups';
      case 'meetings':  return 'myWork.summary.meetingsToday';
      default:          return '';
    }
  }

  /** Convert a follow-up action item to a task from inside the popup. */
  convertFollowup(item: { note: MeetingNote; meeting: CustomerMeeting }): void {
    this.workspace.convertMeetingAction(item.meeting.id, item.note.id);
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  openView(view: ViewId): void {
    this.viewChange.emit(view);
  }
}
