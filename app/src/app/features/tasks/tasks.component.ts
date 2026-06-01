import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CalendarEvent, Task, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { IconComponent } from '../../shared/icons/icon.component';
import { CalendarComponent } from '../../shared/calendar/calendar.component';
import { MetricTasksModalComponent } from '../workspace-home/metric-tasks-modal.component';

export type TaskAudience = 'all' | 'mine' | 'assigned-others';
export type TaskOrigin   = 'all' | 'meeting' | 'standalone';
export type TaskLens     = 'open' | 'overdue' | 'today' | 'blocked';

interface TaskGroup {
  id: string;
  labelKey: string;
  tasks: Task[];
  isDanger: boolean;
}

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    IconComponent,
    CalendarComponent,
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
  expandedTaskId: string | null = null;

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

  get groupedTasks(): TaskGroup[] {
    const tasks   = this.filteredTasks;
    const today   = this.workspace.todayIso;
    const weekEnd = this.workspace.dateAfter(7);

    const overdue  = tasks.filter(t => !!t.dueDate && t.dueDate < today);
    const dueToday = tasks.filter(t => !!t.dueDate && t.dueDate === today);
    const thisWeek = tasks.filter(t => !!t.dueDate && t.dueDate > today && t.dueDate <= weekEnd);
    const later    = tasks.filter(t => !t.dueDate  || t.dueDate > weekEnd);

    const groups: TaskGroup[] = [];
    if (overdue.length)  groups.push({ id: 'overdue',  labelKey: 'myWork.groups.overdue',  tasks: overdue,  isDanger: true  });
    if (dueToday.length) groups.push({ id: 'today',    labelKey: 'myWork.groups.today',    tasks: dueToday, isDanger: false });
    if (thisWeek.length) groups.push({ id: 'thisWeek', labelKey: 'myWork.groups.thisWeek', tasks: thisWeek, isDanger: false });
    if (later.length)    groups.push({ id: 'later',    labelKey: 'myWork.groups.later',    tasks: later,    isDanger: false });
    return groups;
  }

  get hasTasks(): boolean { return this.groupedTasks.length > 0; }

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
    if (task) this.openTask(task);
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

  // ── Table helpers ─────────────────────────────────────────────────────────

  isOverdue(task: Task): boolean {
    return !!task.dueDate && task.dueDate < this.workspace.todayIso && task.status !== 'Done';
  }

  isWaitingStatus(task: Task): boolean {
    return task.status === 'Waiting'
      || task.status === 'Waiting For Customer'
      || task.status === 'Waiting For Internal';
  }

  showWaitingReason(task: Task): boolean {
    return this.isWaitingStatus(task) && !!task.waitingReason?.trim();
  }

  isBlocked(task: Task): boolean {
    return this.isWaitingStatus(task)
      || !!task.blockedBy;
  }

  isMeetingTask(task: Task): boolean { return task.source === 'meeting'; }

  /** CSS class for the priority-coloured left border on the row. */
  priorityClass(task: Task): string {
    return `priority-${this.workspace.statusClass(task.priority)}`;
  }

  /** Short relative label shown above the raw date. */
  relativeDueLabel(task: Task): string {
    if (!task.dueDate) return '';
    const today = this.workspace.todayIso;
    const diff  = this.daysDiff(task.dueDate, today);
    const he    = this.i18n.language === 'he';

    if (diff === 0)  return he ? 'היום'       : 'Today';
    if (diff === 1)  return he ? 'מחר'         : 'Tomorrow';
    if (diff === -1) return he ? 'אתמול'       : 'Yesterday';
    if (diff < 0)    return he ? `${Math.abs(diff)}d איחור` : `${Math.abs(diff)}d overdue`;
    if (diff <= 7)   return he ? `בעוד ${diff}d` : `In ${diff}d`;
    return '';
  }

  /** Checklist completion fraction — returns null when there is no checklist. */
  checklistProgress(task: Task): { done: number; total: number; pct: number } | null {
    if (!task.checklist?.length) return null;
    const done  = task.checklist.filter(i => i.done).length;
    const total = task.checklist.length;
    return { done, total, pct: Math.round((done / total) * 100) };
  }

  /** Meeting subject for meeting-born tasks, null for board tasks. */
  sourceMeetingName(task: Task): string | null {
    if (task.source !== 'meeting' || !task.sourceMeetingId) return null;
    return this.workspace.customerMeeting(task.sourceMeetingId)?.subject ?? null;
  }

  /** Customer name for meeting tasks, board name for board tasks. */
  taskContext(task: Task): string {
    return task.source === 'meeting'
      ? (this.workspace.customer(task.customerId)?.name ?? '')
      : task.board;
  }

  getInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  /** First click expands the row inline; clicking the Open button opens the drawer. */
  toggleExpand(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    this.expandedTaskId = this.expandedTaskId === task.id ? null : task.id;
  }

  openTask(task: Task): void {
    this.expandedTaskId = null;
    if (task.source === 'meeting') {
      this.workspace.selectMeetingTask(task);
    } else {
      this.workspace.selectBoardTask(task);
    }
  }

  openView(view: ViewId): void { this.viewChange.emit(view); }

  private daysDiff(dateIso: string, todayIso: string): number {
    const ms    = new Date(dateIso).getTime() - new Date(todayIso).getTime();
    return Math.round(ms / 86_400_000);
  }
}
