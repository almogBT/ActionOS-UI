import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CalendarEvent, Priority, Task, TaskStatus, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { IconComponent } from '../../shared/icons/icon.component';
import { CalendarComponent } from '../../shared/calendar/calendar.component';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { MetricTasksModalComponent } from '../workspace-home/metric-tasks-modal.component';

export type TaskAudience = 'all' | 'mine' | 'assigned-others';
export type TaskOrigin   = 'all' | 'meeting' | 'standalone';
export type TaskLens     = 'open' | 'overdue' | 'today' | 'blocked';
export type GroupMode    = 'due' | 'status' | 'priority';

/** Header colour family for a group — drives the coloured accent bar. */
export type Tone = 'danger' | 'warn' | 'accent' | 'muted' | 'success';

interface TaskGroup {
  id: string;
  label: string;
  tasks: Task[];
  isDanger: boolean;
  tone: Tone;
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
    SearchableSelectComponent,
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

  /** How the rows are grouped — Monday-style swappable grouping. */
  groupBy: GroupMode = 'due';
  /** Group ids the user has collapsed. */
  private collapsedGroups = new Set<string>();

  // ── Inline status change (must capture a reason — see updateMeetingTask) ──
  statusMenuTaskId: string | null = null;   // which row's status dropdown is open
  statusEditTaskId: string | null = null;   // which row is in reason-confirm mode
  pendingStatus: TaskStatus | null = null;
  statusReason = '';
  statusWaitingReason = '';
  statusError = '';

  // ── Inline checklist step drafts, keyed by task id ────────────────────────
  stepDrafts: Record<string, string> = {};

  // ── Bulk selection ────────────────────────────────────────────────────────
  selectedIds = new Set<string>();
  bulkReason = '';
  bulkError = '';
  bulkStatusPicker: TaskStatus | '' = '';

  // ── Inline add-task ───────────────────────────────────────────────────────
  addingGroupId: string | null = null;
  newTaskTitle = '';

  readonly priorities: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

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

  readonly groupModes: { id: GroupMode; labelKey: string }[] = [
    { id: 'due',      labelKey: 'tasks.groupBy.due' },
    { id: 'status',   labelKey: 'tasks.groupBy.status' },
    { id: 'priority', labelKey: 'tasks.groupBy.priority' },
  ];

  /** Display order for the status grouping (open statuses only). */
  private readonly statusOrder: TaskStatus[] = [
    'New', 'Sent To Owner', 'In Progress',
    'Waiting For Customer', 'Waiting For Internal', 'Waiting',
    'Planned', 'Inbox',
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
    switch (this.groupBy) {
      case 'status':   return this.groupByStatus();
      case 'priority': return this.groupByPriority();
      default:         return this.groupByDue();
    }
  }

  private groupByDue(): TaskGroup[] {
    const tasks   = this.filteredTasks;
    const today   = this.workspace.todayIso;
    const weekEnd = this.workspace.dateAfter(7);

    const overdue  = tasks.filter(t => !!t.dueDate && t.dueDate < today);
    const dueToday = tasks.filter(t => !!t.dueDate && t.dueDate === today);
    const thisWeek = tasks.filter(t => !!t.dueDate && t.dueDate > today && t.dueDate <= weekEnd);
    const later    = tasks.filter(t => !t.dueDate  || t.dueDate > weekEnd);

    const groups: TaskGroup[] = [];
    if (overdue.length)  groups.push({ id: 'due:overdue',  label: this.t('myWork.groups.overdue'),  tasks: overdue,  isDanger: true,  tone: 'danger' });
    if (dueToday.length) groups.push({ id: 'due:today',    label: this.t('myWork.groups.today'),    tasks: dueToday, isDanger: false, tone: 'warn'   });
    if (thisWeek.length) groups.push({ id: 'due:thisWeek', label: this.t('myWork.groups.thisWeek'), tasks: thisWeek, isDanger: false, tone: 'accent' });
    if (later.length)    groups.push({ id: 'due:later',    label: this.t('myWork.groups.later'),    tasks: later,    isDanger: false, tone: 'muted'  });
    return groups;
  }

  private groupByStatus(): TaskGroup[] {
    const tasks = this.filteredTasks;
    return this.statusOrder
      .map(status => ({ status, tasks: tasks.filter(t => t.status === status) }))
      .filter(g => g.tasks.length > 0)
      .map(g => ({
        id: `status:${g.status}`,
        label: this.statusLabel(g.status),
        tasks: g.tasks,
        isDanger: false,
        tone: this.statusTone(g.status),
      }));
  }

  private groupByPriority(): TaskGroup[] {
    const tasks = this.filteredTasks;
    const order: Priority[] = ['Critical', 'High', 'Medium', 'Low'];
    return order
      .map(p => ({ p, tasks: tasks.filter(t => t.priority === p) }))
      .filter(g => g.tasks.length > 0)
      .map(g => ({
        id: `priority:${g.p}`,
        label: this.t('priority.' + this.workspace.statusClass(g.p)),
        tasks: g.tasks,
        isDanger: g.p === 'Critical',
        tone: this.priorityTone(g.p),
      }));
  }

  get hasTasks(): boolean { return this.groupedTasks.length > 0; }

  // ── Group collapse ──────────────────────────────────────────────────────
  isCollapsed(groupId: string): boolean { return this.collapsedGroups.has(groupId); }

  toggleCollapse(groupId: string): void {
    if (this.collapsedGroups.has(groupId)) this.collapsedGroups.delete(groupId);
    else this.collapsedGroups.add(groupId);
  }

  setGroupBy(mode: GroupMode): void {
    this.groupBy = mode;
    this.collapsedGroups.clear();
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

  // ── Inline-edit option lists ──────────────────────────────────────────────

  get priorityOptions(): SelectOption[] {
    return this.priorities.map(p => ({
      value: p, label: this.t('priority.' + this.workspace.statusClass(p))
    }));
  }

  get assigneeOptions(): SelectOption[] {
    return this.workspace.employees.map(e => ({ value: e.id, label: e.fullName }));
  }

  /** Status options for a row's dropdown — only legal next states. */
  allowedStatuses(task: Task): TaskStatus[] {
    return this.workspace.allowedStatusesFor(task);
  }

  statusLabel(status: TaskStatus): string {
    return this.t('status.' + this.workspace.statusClass(status));
  }

  // ── Inline priority / due / assignee (no reason required) ─────────────────

  changePriority(task: Task, priority: Priority): void {
    if (priority === task.priority) return;
    this.workspace.updateMeetingTask(task.id, { priority });
  }

  changeDueDate(task: Task, dueDate: string): void {
    this.workspace.updateMeetingTask(task.id, { dueDate });
  }

  changeAssignee(task: Task, employeeId: string): void {
    if (employeeId === task.assignedToEmployeeId) return;
    this.workspace.updateMeetingTask(task.id, { assignedToEmployeeId: employeeId });
  }

  // ── Inline status change (custom control + reason popover) ────────────────

  toggleStatusMenu(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    if (this.statusEditTaskId) return;            // mid-confirm — ignore
    this.statusMenuTaskId = this.statusMenuTaskId === task.id ? null : task.id;
  }

  pickStatus(task: Task, status: TaskStatus, event: MouseEvent): void {
    event.stopPropagation();
    this.statusMenuTaskId = null;
    if (status === task.status) return;
    this.statusEditTaskId = task.id;
    this.pendingStatus = status;
    this.statusReason = '';
    this.statusWaitingReason = task.waitingReason ?? '';
    this.statusError = '';
  }

  get pendingNeedsWaitingReason(): boolean {
    return this.pendingStatus === 'Waiting For Customer'
        || this.pendingStatus === 'Waiting For Internal';
  }

  pendingStatusLabel(): string {
    return this.pendingStatus ? this.statusLabel(this.pendingStatus) : '';
  }

  confirmStatusChange(task: Task): void {
    if (!this.pendingStatus) return;

    if (this.wordCount(this.statusReason) < 3) {
      this.statusError = this.t('tasks.status.reasonTooShort');
      return;
    }
    if (this.pendingNeedsWaitingReason && !this.statusWaitingReason.trim()) {
      this.statusError = this.t('tasks.status.waitingRequired');
      return;
    }

    const changes: { status: TaskStatus; waitingReason?: string } = { status: this.pendingStatus };
    if (this.pendingNeedsWaitingReason) changes.waitingReason = this.statusWaitingReason.trim();

    const updated = this.workspace.updateMeetingTask(task.id, changes, this.statusReason.trim());
    if (!updated) {
      this.statusError = this.t('tasks.status.changeFailed');
      return;
    }
    this.cancelStatusChange();
  }

  cancelStatusChange(): void {
    this.statusEditTaskId = null;
    this.statusMenuTaskId = null;
    this.pendingStatus = null;
    this.statusReason = '';
    this.statusWaitingReason = '';
    this.statusError = '';
  }

  /** True while any status menu / reason popover is open (drives the backdrop). */
  get statusOverlayOpen(): boolean {
    return !!this.statusMenuTaskId || !!this.statusEditTaskId;
  }

  // ── Inline checklist steps ────────────────────────────────────────────────

  toggleStep(task: Task, item: { label: string; done: boolean }, event: MouseEvent): void {
    event.stopPropagation();
    this.workspace.updateMeetingTaskChecklistItem(task, item, !item.done);
  }

  addStep(task: Task): void {
    const draft = (this.stepDrafts[task.id] ?? '').trim();
    if (!draft) return;
    this.workspace.addMeetingTaskChecklistItem(task, draft);
    this.stepDrafts[task.id] = '';
  }

  // ── Bulk selection ────────────────────────────────────────────────────────

  isSelected(task: Task): boolean { return this.selectedIds.has(task.id); }

  toggleSelect(task: Task, event: Event): void {
    event.stopPropagation();
    if (this.selectedIds.has(task.id)) this.selectedIds.delete(task.id);
    else this.selectedIds.add(task.id);
  }

  allSelectedInGroup(group: TaskGroup): boolean {
    return group.tasks.length > 0 && group.tasks.every(t => this.selectedIds.has(t.id));
  }

  toggleSelectGroup(group: TaskGroup, event: Event): void {
    event.stopPropagation();
    const all = this.allSelectedInGroup(group);
    group.tasks.forEach(t => all ? this.selectedIds.delete(t.id) : this.selectedIds.add(t.id));
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.bulkReason = '';
    this.bulkError = '';
    this.bulkStatusPicker = '';
  }

  get selectedCount(): number { return this.selectedIds.size; }

  private get selectedTasks(): Task[] {
    return this.filteredTasks.filter(t => this.selectedIds.has(t.id));
  }

  get bulkStatusOptions(): SelectOption[] {
    return this.workspace.statuses.map(s => ({ value: s, label: this.statusLabel(s) }));
  }

  applyBulkPriority(priority: Priority): void {
    if (!priority) return;
    this.selectedTasks.forEach(t => this.workspace.updateMeetingTask(t.id, { priority }));
    this.clearSelection();
  }

  applyBulkStatus(): void {
    if (!this.bulkStatusPicker) return;
    if (this.wordCount(this.bulkReason) < 3) {
      this.bulkError = this.t('tasks.status.reasonTooShort');
      return;
    }
    const status = this.bulkStatusPicker as TaskStatus;
    this.selectedTasks.forEach(t => {
      const changes: { status: TaskStatus; waitingReason?: string } = { status };
      if ((status === 'Waiting For Customer' || status === 'Waiting For Internal')) {
        changes.waitingReason = t.waitingReason?.trim() || this.bulkReason.trim();
      }
      // updateMeetingTask silently skips tasks whose current status can't reach `status`.
      this.workspace.updateMeetingTask(t.id, changes, this.bulkReason.trim());
    });
    this.clearSelection();
  }

  // ── Inline add-task ───────────────────────────────────────────────────────

  startAdd(group: TaskGroup, event: MouseEvent): void {
    event.stopPropagation();
    this.addingGroupId = group.id;
    this.newTaskTitle = '';
  }

  confirmAdd(group: TaskGroup): void {
    const title = this.newTaskTitle.trim();
    if (!title) { this.cancelAdd(); return; }

    const input: { title: string; priority: Priority; dueDate?: string } = {
      title,
      priority: this.addDefaultPriority(group),
    };
    const due = this.addDefaultDue(group);
    if (due) input.dueDate = due;

    this.workspace.addTask(input);
    this.addingGroupId = null;
    this.newTaskTitle = '';
  }

  cancelAdd(): void {
    this.addingGroupId = null;
    this.newTaskTitle = '';
  }

  /** A new row inherits the group's own dimension when it makes sense. */
  private addDefaultPriority(group: TaskGroup): Priority {
    if (group.id.startsWith('priority:')) return group.id.split(':')[1] as Priority;
    return 'Medium';
  }

  private addDefaultDue(group: TaskGroup): string | undefined {
    switch (group.id) {
      case 'due:overdue':
      case 'due:today':    return this.workspace.todayIso;
      case 'due:thisWeek': return this.workspace.dateAfter(3);
      case 'due:later':    return this.workspace.dateAfter(10);
      default:             return this.workspace.dateAfter(2);
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

  /** Deterministic avatar colour index (0-5) from a name. */
  avatarTone(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    return Math.abs(hash) % 6;
  }

  /** First click expands the row inline; the Open button opens the drawer. */
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

  private statusTone(status: TaskStatus): Tone {
    switch (status) {
      case 'In Progress':
      case 'Sent To Owner':         return 'accent';
      case 'Waiting':
      case 'Waiting For Customer':
      case 'Waiting For Internal':  return 'warn';
      case 'New':                   return 'success';
      default:                      return 'muted';
    }
  }

  private priorityTone(priority: Priority): Tone {
    switch (priority) {
      case 'Critical': return 'danger';
      case 'High':     return 'warn';
      case 'Medium':   return 'accent';
      default:         return 'muted';
    }
  }

  private wordCount(value: string): number {
    return value.trim().split(/\s+/).filter(Boolean).length;
  }

  private t(key: string): string { return this.i18n.translate(key); }

  private daysDiff(dateIso: string, todayIso: string): number {
    const ms = new Date(dateIso).getTime() - new Date(todayIso).getTime();
    return Math.round(ms / 86_400_000);
  }
}
