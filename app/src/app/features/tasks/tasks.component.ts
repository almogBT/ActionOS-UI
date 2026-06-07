import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CalendarEvent, Task, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { CalendarStatsComponent } from '../../shared/calendar-stats/calendar-stats.component';
import { StatTileComponent } from '../../shared/stat-tile/stat-tile.component';
import { TaskTableComponent } from '../../shared/task-table/task-table.component';
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

  audience: TaskAudience = 'all';
  origin: TaskOrigin     = 'all';
  search = '';
  openLens: TaskLens | null = null;

  readonly audienceOptions: { id: TaskAudience; labelKey: string }[] = [
    { id: 'all',             labelKey: 'tasks.audience.all' },
    { id: 'mine',            labelKey: 'tasks.audience.mine' },
    { id: 'assigned-others', labelKey: 'tasks.audience.assignedOthers' },
  ];

  readonly originOptions: { id: TaskOrigin; labelKey: string }[] = [
    { id: 'all',        labelKey: 'tasks.origin.all' },
    { id: 'meeting',    labelKey: 'tasks.origin.meeting' },
    { id: 'standalone', labelKey: 'tasks.origin.standalone' },
  ];

  // ── Source data ───────────────────────────────────────────────────────────

  get baseOpenTasks(): Task[] {
    const empId = this.workspace.currentEmployeeId;
    const open  = this.workspace.meetingTasks.filter(
      t => t.status !== 'Done' && t.status !== 'Cancelled'
    );
    switch (this.audience) {
      case 'mine':            return open.filter(t => t.assignedToEmployeeId === empId);
      case 'assigned-others': return open.filter(t => t.openedByEmployeeId === empId && t.assignedToEmployeeId !== empId);
      default:                return open;
    }
  }

  get filteredTasks(): Task[] {
    let list = this.baseOpenTasks;
    if (this.origin === 'meeting')    list = list.filter(t => t.source === 'meeting');
    if (this.origin === 'standalone') list = list.filter(t => t.source !== 'meeting');
    const term = this.search.trim().toLowerCase();
    if (term) {
      list = list.filter(t =>
        t.title.toLowerCase().includes(term) ||
        this.taskContext(t).toLowerCase().includes(term)
      );
    }
    return list;
  }

  // ── Stat tiles ────────────────────────────────────────────────────────────

  get openCount(): number    { return this.baseOpenTasks.length; }
  get overdueCount(): number { return this.baseOpenTasks.filter(t => this.isOverdue(t)).length; }
  get todayCount(): number   { return this.baseOpenTasks.filter(t => t.dueDate === this.workspace.todayIso).length; }
  get blockedCount(): number { return this.baseOpenTasks.filter(t => this.isBlocked(t)).length; }

  // ── Calendar ──────────────────────────────────────────────────────────────

  get taskCalendarEvents(): CalendarEvent[] {
    return this.filteredTasks
      .filter(t => !!t.dueDate)
      .map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        startsAt: `${t.dueDate}T09:00:00`,
        durationMinutes: 30,
        kind: 'task' as const,
        customerName: t.source === 'meeting' ? this.workspace.customer(t.customerId)?.name : undefined,
        attendeeCount: 0,
        sourceId: t.id
      }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
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
    switch (this.openLens) {
      case 'overdue': return base.filter(t => this.isOverdue(t));
      case 'today':   return base.filter(t => t.dueDate === this.workspace.todayIso);
      case 'blocked': return base.filter(t => this.isBlocked(t));
      default:        return base;
    }
  }

  get lensMeetingTasks(): Task[] { return this.lensTasks.filter(t => t.source === 'meeting'); }
  get lensBoardTasks(): Task[]   { return this.lensTasks.filter(t => t.source !== 'meeting'); }

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
    return task.source === 'meeting'
      ? (this.workspace.customer(task.customerId)?.name ?? '')
      : task.board;
  }

  openView(view: ViewId): void { this.viewChange.emit(view); }
}
