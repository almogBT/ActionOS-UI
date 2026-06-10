import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CalendarEvent, Task, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { ACTIONOS_FEATURES } from '../../core/config/actionos-ui.config';
import { CalendarStatsComponent } from '../../shared/calendar-stats/calendar-stats.component';
import { StatTileComponent } from '../../shared/stat-tile/stat-tile.component';
import { GroupMode, TaskTableComponent } from '../../shared/task-table/task-table.component';
import { MetricTasksModalComponent } from '../workspace-home/metric-tasks-modal.component';

export type TaskAudience = 'all' | 'mine' | 'assigned-others';
export type TaskOrigin   = 'all' | 'meeting' | 'standalone';
export type TaskLens     = 'open' | 'overdue' | 'today' | 'blocked';

/**
 * The Tasks screen. Owns the audience/origin/search filters, the stat tiles and
 * the tasks-only calendar; the table itself is the shared `app-task-table`.
 */
@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    CalendarStatsComponent,
    StatTileComponent,
    TaskTableComponent,
    MetricTasksModalComponent,
  ],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss'
})
export class TasksComponent {
  @Output() viewChange = new EventEmitter<ViewId>();

  readonly workspace = inject(ActionosWorkspaceService);
  readonly i18n      = inject(ActionosI18nService);
  readonly features  = ACTIONOS_FEATURES;

  audience: TaskAudience = 'all';
  origin: TaskOrigin     = 'all';
  groupBy: GroupMode     = 'none';
  search = '';
  openLens: TaskLens | null = null;

  readonly audienceOptions: { id: TaskAudience; labelKey: string }[] = [
    { id: 'all',             labelKey: 'tasks.audience.all' },
    { id: 'mine',            labelKey: 'tasks.audience.mine' },
    { id: 'assigned-others', labelKey: 'tasks.audience.assignedOthers' },
  ];

  readonly groupByOptions: { id: GroupMode; labelKey: string }[] = [
    { id: 'none',     labelKey: 'tasks.groupBy.none' },
    { id: 'due',      labelKey: 'tasks.groupBy.due' },
    { id: 'status',   labelKey: 'tasks.groupBy.status' },
    { id: 'priority', labelKey: 'tasks.groupBy.priority' },
  ];

  readonly originOptions: { id: TaskOrigin; labelKey: string }[] = [
    { id: 'all',        labelKey: 'tasks.origin.all' },
    { id: 'meeting',    labelKey: 'tasks.origin.meeting' },
    { id: 'standalone', labelKey: 'tasks.origin.standalone' },
  ];
  private readonly baseOpenTasksCache: {
    audience: TaskAudience | null;
    employeeId: string;
    source: Task[] | null;
    value: Task[];
  } = { audience: null, employeeId: '', source: null, value: [] };
  private readonly filteredTasksCache: {
    base: Task[] | null;
    origin: TaskOrigin | null;
    search: string;
    value: Task[];
  } = { base: null, origin: null, search: '', value: [] };
  private readonly taskCalendarEventsCache: { source: Task[] | null; value: CalendarEvent[] } = {
    source: null,
    value: []
  };
  private readonly taskCountsCache: {
    base: Task[] | null;
    blocked: number;
    overdue: number;
    today: string;
    todayCount: number;
  } = { base: null, blocked: 0, overdue: 0, today: '', todayCount: 0 };
  private readonly lensTasksCache: {
    base: Task[] | null;
    lens: TaskLens | null;
    today: string;
    value: Task[];
  } = { base: null, lens: null, today: '', value: [] };
  private readonly lensMeetingTasksCache: { source: Task[] | null; value: Task[] } = { source: null, value: [] };
  private readonly lensBoardTasksCache: { source: Task[] | null; value: Task[] } = { source: null, value: [] };

  // ── Source data ───────────────────────────────────────────────────────────

  get baseOpenTasks(): Task[] {
    const empId = this.workspace.currentEmployeeId;
    const source = this.workspace.meetingTasks;
    if (
      this.baseOpenTasksCache.source === source &&
      this.baseOpenTasksCache.employeeId === empId &&
      this.baseOpenTasksCache.audience === this.audience
    ) {
      return this.baseOpenTasksCache.value;
    }

    const open = source.filter(t => t.status !== 'Done' && t.status !== 'Cancelled');
    let value: Task[];
    switch (this.audience) {
      case 'mine':
        value = open.filter(t => t.assignedToEmployeeId === empId);
        break;
      case 'assigned-others':
        value = open.filter(t => t.openedByEmployeeId === empId && t.assignedToEmployeeId !== empId);
        break;
      default:
        value = open;
    }
    this.baseOpenTasksCache.source = source;
    this.baseOpenTasksCache.employeeId = empId;
    this.baseOpenTasksCache.audience = this.audience;
    this.baseOpenTasksCache.value = value;
    return value;
  }

  get filteredTasks(): Task[] {
    let list = this.baseOpenTasks;
    const term = this.search.trim().toLowerCase();
    if (
      this.filteredTasksCache.base === list &&
      this.filteredTasksCache.origin === this.origin &&
      this.filteredTasksCache.search === term
    ) {
      return this.filteredTasksCache.value;
    }

    if (this.origin === 'meeting')    list = list.filter(t => t.source === 'meeting');
    if (this.origin === 'standalone') list = list.filter(t => t.source !== 'meeting');
    if (term) {
      list = list.filter(t =>
        t.title.toLowerCase().includes(term) ||
        this.taskContext(t).toLowerCase().includes(term)
      );
    }
    this.filteredTasksCache.base = this.baseOpenTasks;
    this.filteredTasksCache.origin = this.origin;
    this.filteredTasksCache.search = term;
    this.filteredTasksCache.value = list;
    return list;
  }

  // ── Stat tiles ────────────────────────────────────────────────────────────

  get openCount(): number    { return this.baseOpenTasks.length; }
  get overdueCount(): number { return this.taskCounts.overdue; }
  get todayCount(): number   { return this.taskCounts.todayCount; }
  get blockedCount(): number { return this.taskCounts.blocked; }

  private get taskCounts(): { overdue: number; todayCount: number; blocked: number } {
    const base = this.baseOpenTasks;
    const today = this.workspace.todayIso;
    if (this.taskCountsCache.base !== base || this.taskCountsCache.today !== today) {
      this.taskCountsCache.base = base;
      this.taskCountsCache.today = today;
      this.taskCountsCache.overdue = 0;
      this.taskCountsCache.todayCount = 0;
      this.taskCountsCache.blocked = 0;
      for (const task of base) {
        if (this.isOverdue(task)) this.taskCountsCache.overdue += 1;
        if (task.dueDate === today) this.taskCountsCache.todayCount += 1;
        if (this.isBlocked(task)) this.taskCountsCache.blocked += 1;
      }
    }
    return this.taskCountsCache;
  }

  // ── Calendar ──────────────────────────────────────────────────────────────

  get taskCalendarEvents(): CalendarEvent[] {
    const source = this.filteredTasks;
    if (this.taskCalendarEventsCache.source === source) {
      return this.taskCalendarEventsCache.value;
    }
    const value = source
      .filter(t => !!t.dueDate)
      .map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        startsAt: `${t.dueDate}T09:00:00`,
        durationMinutes: 30,
        kind: 'task' as const,
        customerName: t.customerId ? this.workspace.clientName(t.customerId) : undefined,
        attendeeCount: 0,
        sourceId: t.id
      }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    this.taskCalendarEventsCache.source = source;
    this.taskCalendarEventsCache.value = value;
    return value;
  }

  onCalendarEventOpened(evt: CalendarEvent): void {
    const task = this.workspace.meetingTasks.find(t => t.id === evt.sourceId);
    if (!task) return;
    if (task.source === 'meeting') this.workspace.selectMeetingTask(task);
    else                          this.workspace.selectBoardTask(task);
  }

  /** Clicking an empty calendar slot starts a new task due on that day. */
  onCalendarSlotSelected(date: Date): void {
    this.workspace.startNewTaskAt(date, this.i18n.translate('calendar.newTaskTitle'));
  }

  // ── Stat tile popup ───────────────────────────────────────────────────────

  openTile(lens: TaskLens): void  { this.openLens = lens; }
  closeTile(): void               { this.openLens = null; }

  private get lensTasks(): Task[] {
    const base = this.baseOpenTasks;
    const today = this.workspace.todayIso;
    if (
      this.lensTasksCache.base === base &&
      this.lensTasksCache.lens === this.openLens &&
      this.lensTasksCache.today === today
    ) {
      return this.lensTasksCache.value;
    }

    let value: Task[];
    switch (this.openLens) {
      case 'overdue': value = base.filter(t => this.isOverdue(t)); break;
      case 'today':   value = base.filter(t => t.dueDate === today); break;
      case 'blocked': value = base.filter(t => this.isBlocked(t)); break;
      default:        value = base;
    }
    this.lensTasksCache.base = base;
    this.lensTasksCache.lens = this.openLens;
    this.lensTasksCache.today = today;
    this.lensTasksCache.value = value;
    return value;
  }

  get lensMeetingTasks(): Task[] {
    const source = this.lensTasks;
    if (this.lensMeetingTasksCache.source !== source) {
      this.lensMeetingTasksCache.source = source;
      this.lensMeetingTasksCache.value = source.filter(t => t.source === 'meeting');
    }
    return this.lensMeetingTasksCache.value;
  }

  get lensBoardTasks(): Task[] {
    const source = this.lensTasks;
    if (this.lensBoardTasksCache.source !== source) {
      this.lensBoardTasksCache.source = source;
      this.lensBoardTasksCache.value = source.filter(t => t.source !== 'meeting');
    }
    return this.lensBoardTasksCache.value;
  }

  get lensTitleKey(): string {
    switch (this.openLens) {
      case 'overdue': return 'tasks.tiles.overdue';
      case 'today':   return 'tasks.tiles.today';
      case 'blocked': return 'tasks.tiles.blocked';
      default:        return 'tasks.tiles.open';
    }
  }

  // ── Predicates used by counts / lens ──────────────────────────────────────

  isOverdue(task: Task): boolean {
    return !!task.dueDate && task.dueDate < this.workspace.todayIso && task.status !== 'Done';
  }

  private isWaitingStatus(task: Task): boolean {
    return task.status === 'Waiting'
      || task.status === 'Waiting For Customer'
      || task.status === 'Waiting For Internal';
  }

  isBlocked(task: Task): boolean {
    return this.isWaitingStatus(task) || !!task.blockedBy;
  }

  /** Customer name for meeting tasks, board name for board tasks (search/calendar use). */
  private taskContext(task: Task): string {
    return task.customerId
      ? (this.workspace.clientName(task.customerId) ?? '')
      : task.board;
  }

  openView(view: ViewId): void { this.viewChange.emit(view); }

  /** Open the task drawer on a fresh draft — matches the Meetings page "New meeting" button. */
  newTask(): void { this.workspace.openNewTaskDraft(); }

  trackAudience(_index: number, option: { id: TaskAudience }): TaskAudience { return option.id; }
  trackOrigin(_index: number, option: { id: TaskOrigin }): TaskOrigin { return option.id; }
  trackGroupBy(_index: number, option: { id: GroupMode }): GroupMode { return option.id; }
}
