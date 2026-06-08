import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CalendarEvent, Customer, CustomerMeeting, Task, ViewId
} from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { CalendarStatsComponent } from '../../shared/calendar-stats/calendar-stats.component';
import { IconComponent } from '../../shared/icons/icon.component';
import { MeetingCardComponent } from '../../shared/meeting-card/meeting-card.component';
import { MeetingPrepBriefComponent } from '../customers/meeting-prep-brief.component';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { StatTileComponent } from '../../shared/stat-tile/stat-tile.component';
import { TaskTableComponent } from '../../shared/task-table/task-table.component';

/** Quick filter applied to the task table. Driven by the stat tiles too. */
export type TaskLens = 'all' | 'open' | 'overdue' | 'blocked';

/**
 * The Clients page: the profile for one client — who they are, what just
 * happened, and what is still open. The layout mirrors My Work and Tasks —
 * actionable stat tiles, a calendar strip, a meeting carousel, the shared
 * meeting prep brief on the side, and the one shared task table — so the whole
 * app reads the same way. There are no tabs: the overview *is* the board.
 */
@Component({
  selector: 'app-boards',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe, IconComponent,
    SearchableSelectComponent, StatTileComponent, CalendarStatsComponent, TaskTableComponent,
    MeetingCardComponent, MeetingPrepBriefComponent
  ],
  templateUrl: './boards.component.html',
  styleUrl: './boards.component.scss'
})
export class BoardsComponent {
  @Output() viewChange = new EventEmitter<ViewId>();

  boardSearch = '';

  taskLens: TaskLens = 'all';

  /** Meeting rail: false = single-row carousel, true = 3-row grid (scrolls if more). */
  meetingsExpanded = false;

  // Selection is backed by the singleton service so it persists when the user
  // leaves the Clients view (which destroys this component) and comes back.
  get selectedClientId(): string { return this.workspace.boardClientId; }
  set selectedClientId(value: string) { this.workspace.boardClientId = value; }

  constructor(public workspace: ActionosWorkspaceService) {
    // Seed a default only on first visit; a prior selection is left untouched.
    if (!this.selectedClientId) {
      const clients = workspace.taskClientOptions;
      if (clients.length) this.selectedClientId = clients[0].id;
    }
  }

  // ── Selectors / options ───────────────────────────────────────────────

  get selectedClient(): Customer | null {
    const id = this.selectedClientId;
    if (!id) return null;
    // Resolve whether the picked id is a customer id or an external group id.
    return this.workspace.customer(id)
      ?? this.workspace.customers.find(c => c.externalGroupId === id)
      ?? null;
  }

  get clientSelectOptions(): SelectOption[] {
    // Source the full client list (external customer groups + customers), the
    // same set the Tasks board uses — not just the local customer repo.
    return this.workspace.taskClientOptions.map(c => ({ value: c.id, label: c.name }));
  }

  get taskLensOptions(): { id: TaskLens; labelKey: string }[] {
    return [
      { id: 'all',     labelKey: 'noteType.all' },
      { id: 'open',    labelKey: 'boards.openTasks' },
      { id: 'overdue', labelKey: 'tasks.tiles.overdue' },
      { id: 'blocked', labelKey: 'boards.blocked' }
    ];
  }

  // ── View state ────────────────────────────────────────────────────────

  /** Stat-tile click → apply the matching lens to the task table below. */
  openLens(lens: TaskLens): void {
    this.taskLens = lens;
  }

  /** Scroll the meeting carousel by ~one viewport. dir: -1 prev, +1 next. */
  scrollRail(track: HTMLElement, dir: number): void {
    track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: 'smooth' });
  }

  /** Translate vertical wheel motion into horizontal scroll on the carousel. */
  onRailWheel(e: WheelEvent, track: HTMLElement): void {
    if (track.scrollWidth <= track.clientWidth) return;   // nothing to scroll
    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (!delta) return;
    e.preventDefault();
    track.scrollBy({ left: delta, behavior: 'auto' });
  }

  // ── Client: meetings ──────────────────────────────────────────────────

  /** All of the client's meetings, newest first (search-independent). */
  get clientMeetingsSorted(): CustomerMeeting[] {
    if (!this.selectedClientId) return [];
    return this.workspace.customerMeetingsByCustomer(this.selectedClientId)
      .slice()
      .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
  }

  /** Meetings shown in the carousel — the board search filters these too. */
  get clientMeetings(): CustomerMeeting[] {
    const meetings = this.clientMeetingsSorted;
    if (!this.boardSearch) return meetings;
    const q = this.boardSearch.toLowerCase();
    return meetings.filter(m =>
      m.subject.toLowerCase().includes(q) ||
      m.status.toLowerCase().includes(q) ||
      this.workspace.employeeName(m.meetingLeaderEmployeeId).toLowerCase().includes(q)
    );
  }

  get clientMeetingCount(): number {
    return this.clientMeetings.length;
  }

  /** Calendar feed for the client board, built from their meetings. */
  get clientCalendarEvents(): CalendarEvent[] {
    const name = this.selectedClient?.name;
    return this.clientMeetingsSorted.map(m => ({
      id: `board-cust-${m.id}`,
      title: m.subject,
      startsAt: m.meetingDate,
      durationMinutes: 60,
      kind: 'customer' as const,
      customerName: name,
      attendeeCount:
        m.internalParticipantEmployeeIds.length + m.customerParticipants.length + 1,
      sourceId: m.id
    }));
  }

  onCalEventOpened(evt: CalendarEvent): void {
    this.workspace.openMeetingDrawer(evt.sourceId);
  }

  // ── Client: tasks ─────────────────────────────────────────────────────

  private get clientTasksAll(): Task[] {
    if (!this.selectedClientId) return [];
    return this.workspace.meetingTasksByCustomer(this.selectedClientId);
  }

  /** Search-filtered client tasks (before the lens filter). */
  get clientTasks(): Task[] {
    const tasks = this.clientTasksAll;
    if (!this.boardSearch) return tasks;
    const q = this.boardSearch.toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q) ||
      this.workspace.employeeName(t.assignedToEmployeeId).toLowerCase().includes(q)
    );
  }

  get clientTasksForTab(): Task[] {
    return this.applyLens(this.clientTasks);
  }

  get clientOpenTasks(): Task[] {
    return this.clientTasksAll.filter(t => this.workspace.isOpenMeetingTaskStatus(t.status));
  }

  get clientOpenCount(): number { return this.clientOpenTasks.length; }
  get clientOverdueCount(): number { return this.clientTasksAll.filter(t => this.isOverdue(t)).length; }
  get clientBlockedCount(): number { return this.clientTasksAll.filter(t => this.isBlocked(t)).length; }

  // ── Shared task helpers ───────────────────────────────────────────────

  isOverdue(task: Task): boolean {
    return this.workspace.isOpenMeetingTaskStatus(task.status)
      && !!task.dueDate && task.dueDate < this.workspace.todayIso;
  }

  isBlocked(task: Task): boolean {
    return !!task.blockedBy
      || task.status === 'Waiting'
      || task.status === 'Waiting For Customer'
      || task.status === 'Waiting For Internal';
  }

  private applyLens(tasks: Task[]): Task[] {
    switch (this.taskLens) {
      case 'open':    return tasks.filter(t => this.workspace.isOpenMeetingTaskStatus(t.status));
      case 'overdue': return tasks.filter(t => this.isOverdue(t));
      case 'blocked': return tasks.filter(t => this.isBlocked(t));
      default:        return tasks;
    }
  }
}
