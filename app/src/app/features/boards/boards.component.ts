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

interface ClientTaskCounts {
  open: number;
  overdue: number;
  blocked: number;
}

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

  readonly taskLensOptions: { id: TaskLens; labelKey: string }[] = [
    { id: 'all',     labelKey: 'noteType.all' },
    { id: 'open',    labelKey: 'boards.openTasks' },
    { id: 'overdue', labelKey: 'tasks.tiles.overdue' },
    { id: 'blocked', labelKey: 'boards.blocked' }
  ];

  private readonly emptyMeetings: CustomerMeeting[] = [];
  private readonly emptyTasks: Task[] = [];

  private selectedClientCache: { id: string; customers: Customer[]; result: Customer | null } | null = null;
  private clientSelectOptionsCache: { source: { id: string; name: string }[]; options: SelectOption[] } | null = null;
  private clientMeetingsSortedCache: {
    selectedClientId: string;
    source: CustomerMeeting[];
    result: CustomerMeeting[];
  } | null = null;
  private clientMeetingsCache: {
    sortedMeetings: CustomerMeeting[];
    search: string;
    result: CustomerMeeting[];
  } | null = null;
  private clientCalendarEventsCache: {
    sortedMeetings: CustomerMeeting[];
    clientName: string | undefined;
    result: CalendarEvent[];
  } | null = null;
  private clientTasksCache: {
    allTasks: Task[];
    search: string;
    result: Task[];
  } | null = null;
  private clientTasksForTabCache: {
    tasks: Task[];
    lens: TaskLens;
    result: Task[];
  } | null = null;
  private clientTaskCountsCache: {
    allTasks: Task[];
    today: string;
    counts: ClientTaskCounts;
  } | null = null;

  // Selection is backed by the singleton service so it persists when the user
  // leaves the Clients view (which destroys this component) and comes back.
  get selectedClientId(): string { return this.workspace.boardClientId; }
  set selectedClientId(value: string) { this.workspace.boardClientId = value; }

  constructor(public workspace: ActionosWorkspaceService) {
    // Seed a default only on first visit; a prior selection is left untouched.
    if (!this.selectedClientId) {
      const clients = workspace.clientOptions;
      if (clients.length) this.selectedClientId = clients[0].id;
    }
  }

  // ── Selectors / options ───────────────────────────────────────────────

  get selectedClient(): Customer | null {
    const id = this.selectedClientId;
    if (!id) return null;
    const customers = this.workspace.customers;
    const cached = this.selectedClientCache;
    if (cached && cached.id === id && cached.customers === customers) {
      return cached.result;
    }

    // Resolve whether the picked id is a customer id or an external group id.
    const result = this.workspace.customer(id)
      ?? customers.find(c => c.externalGroupId === id)
      ?? null;
    this.selectedClientCache = { id, customers, result };
    return result;
  }

  get selectedClientName(): string {
    if (!this.selectedClientId) {
      return '';
    }
    return this.workspace.clientName(this.selectedClientId) ?? '';
  }

  get selectedClientInitial(): string {
    return this.selectedClientName.charAt(0) || '?';
  }

  get clientSelectOptions(): SelectOption[] {
    // Source the full client list (external customer groups + customers), the
    // same set the Tasks board uses — not just the local customer repo.
    const source = this.workspace.clientOptions;
    const cached = this.clientSelectOptionsCache;
    if (cached && cached.source === source) {
      return cached.options;
    }

    const options = source.map(c => ({ value: c.id, label: c.name }));
    this.clientSelectOptionsCache = { source, options };
    return options;
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
    const selectedClientId = this.selectedClientId;
    if (!selectedClientId) return this.emptyMeetings;
    const source = this.workspace.customerMeetingsByCustomer(selectedClientId);
    const cached = this.clientMeetingsSortedCache;
    if (cached && cached.selectedClientId === selectedClientId && cached.source === source) {
      return cached.result;
    }

    const result = source
      .slice()
      .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
    this.clientMeetingsSortedCache = { selectedClientId, source, result };
    return result;
  }

  /** Meetings shown in the carousel — the board search filters these too. */
  get clientMeetings(): CustomerMeeting[] {
    const meetings = this.clientMeetingsSorted;
    const search = this.boardSearch.trim().toLowerCase();
    const cached = this.clientMeetingsCache;
    if (cached && cached.sortedMeetings === meetings && cached.search === search) {
      return cached.result;
    }

    if (!search) {
      this.clientMeetingsCache = { sortedMeetings: meetings, search, result: meetings };
      return meetings;
    }

    const result = meetings.filter(m =>
      m.subject.toLowerCase().includes(search) ||
      m.status.toLowerCase().includes(search) ||
      this.workspace.employeeName(m.meetingLeaderEmployeeId).toLowerCase().includes(search)
    );
    this.clientMeetingsCache = { sortedMeetings: meetings, search, result };
    return result;
  }

  get clientMeetingCount(): number {
    return this.clientMeetings.length;
  }

  /** Calendar feed for the client board, built from their meetings. */
  get clientCalendarEvents(): CalendarEvent[] {
    const name = this.selectedClientName || undefined;
    const meetings = this.clientMeetingsSorted;
    const cached = this.clientCalendarEventsCache;
    if (cached && cached.sortedMeetings === meetings && cached.clientName === name) {
      return cached.result;
    }

    const result = meetings.map(m => ({
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
    this.clientCalendarEventsCache = { sortedMeetings: meetings, clientName: name, result };
    return result;
  }

  onCalEventOpened(evt: CalendarEvent): void {
    this.workspace.openMeetingDrawer(evt.sourceId);
  }

  // ── Client: tasks ─────────────────────────────────────────────────────

  private get clientTasksAll(): Task[] {
    if (!this.selectedClientId) return this.emptyTasks;
    return this.workspace.meetingTasksByCustomer(this.selectedClientId);
  }

  /** Search-filtered client tasks (before the lens filter). */
  get clientTasks(): Task[] {
    const tasks = this.clientTasksAll;
    const search = this.boardSearch.trim().toLowerCase();
    const cached = this.clientTasksCache;
    if (cached && cached.allTasks === tasks && cached.search === search) {
      return cached.result;
    }

    if (!search) {
      this.clientTasksCache = { allTasks: tasks, search, result: tasks };
      return tasks;
    }

    const result = tasks.filter(t =>
      t.title.toLowerCase().includes(search) ||
      t.status.toLowerCase().includes(search) ||
      this.workspace.employeeName(t.assignedToEmployeeId).toLowerCase().includes(search)
    );
    this.clientTasksCache = { allTasks: tasks, search, result };
    return result;
  }

  get clientTasksForTab(): Task[] {
    const tasks = this.clientTasks;
    const cached = this.clientTasksForTabCache;
    if (cached && cached.tasks === tasks && cached.lens === this.taskLens) {
      return cached.result;
    }

    const result = this.applyLens(tasks);
    this.clientTasksForTabCache = { tasks, lens: this.taskLens, result };
    return result;
  }

  get clientOpenTasks(): Task[] {
    return this.clientTasksAll.filter(t => this.workspace.isOpenMeetingTaskStatus(t.status));
  }

  get clientOpenCount(): number { return this.clientTaskCounts.open; }
  get clientOverdueCount(): number { return this.clientTaskCounts.overdue; }
  get clientBlockedCount(): number { return this.clientTaskCounts.blocked; }

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

  trackTaskLens(_: number, option: { id: TaskLens }): TaskLens {
    return option.id;
  }

  trackMeeting(_: number, meeting: CustomerMeeting): string {
    return meeting.id;
  }

  private applyLens(tasks: Task[]): Task[] {
    switch (this.taskLens) {
      case 'open':    return tasks.filter(t => this.workspace.isOpenMeetingTaskStatus(t.status));
      case 'overdue': return tasks.filter(t => this.isOverdue(t));
      case 'blocked': return tasks.filter(t => this.isBlocked(t));
      default:        return tasks;
    }
  }

  private get clientTaskCounts(): ClientTaskCounts {
    const allTasks = this.clientTasksAll;
    const today = this.workspace.todayIso;
    const cached = this.clientTaskCountsCache;
    if (cached && cached.allTasks === allTasks && cached.today === today) {
      return cached.counts;
    }

    const counts = allTasks.reduce<ClientTaskCounts>((acc, task) => {
      if (this.workspace.isOpenMeetingTaskStatus(task.status)) acc.open += 1;
      if (this.isOverdue(task)) acc.overdue += 1;
      if (this.isBlocked(task)) acc.blocked += 1;
      return acc;
    }, { open: 0, overdue: 0, blocked: 0 });

    this.clientTaskCountsCache = { allTasks, today, counts };
    return counts;
  }
}
