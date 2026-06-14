import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
export type SortKey = 'group' | 'status' | 'title' | 'due' | 'priority';
import { ACTIONOS_FEATURES } from '../../core/config/actionos-ui.config';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ChecklistItem, CreateTaskInput, Employee, Priority, Task, TaskStatus } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { AppDatePipe } from '../pipes/app-date.pipe';
import { SearchableSelectComponent, SelectOption } from '../searchable-select/searchable-select.component';

export type GroupMode = 'due' | 'status' | 'priority' | 'none';

/** Header colour family for a group — drives the coloured accent bar. */
export type Tone = 'danger' | 'warn' | 'accent' | 'muted' | 'success';

interface TaskGroup {
  id: string;
  label: string;
  tasks: Task[];
  isDanger: boolean;
  tone: Tone;
  /** No header row (used by the single 'none' group). */
  headerless?: boolean;
}

/**
 * The one task table used everywhere in ActionOS — a Monday-style board row
 * with solid-colour status cells, inline status/priority/due/assignee editing,
 * an interactive checklist, bulk actions and inline add-task.
 *
 * Callers pass a pre-filtered `tasks` list; this component owns grouping,
 * collapse, all inline edits and the empty state. It talks to the singleton
 * workspace service directly, so a host only needs `[tasks]` plus feature flags.
 */
@Component({
  selector: 'app-task-table',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, AppDatePipe, SearchableSelectComponent],
  templateUrl: './task-table.component.html',
  styleUrl: './task-table.component.scss',
  host: { '[class.density-compact]': "density === 'compact'" }
})
export class TaskTableComponent {
  @Input({ required: true }) tasks: Task[] = [];
  @Input() groupBy: GroupMode = 'due';
  @Input() showGroupSwitch = false;
  @Input() selectable   = true;
  @Input() allowAddTask  = true;
  @Input() expandable    = true;
  @Input() editable      = true;
  @Input() density: 'comfortable' | 'compact' = 'comfortable';
  @Input() showArchive   = false;
  @Input() emptyText?: string;
  @Input() newTaskDefaults?: Partial<CreateTaskInput>;

  @Output() rowOpened = new EventEmitter<Task>();
  @Output() archived  = new EventEmitter<Task>();

  readonly workspace = inject(ActionosWorkspaceService);
  readonly i18n      = inject(ActionosI18nService);

  expandedTaskId: string | null = null;

  /** Group ids the user has collapsed. */
  private collapsedGroups = new Set<string>();

  // ── Inline status change (must capture a reason — see updateMeetingTask) ──
  statusMenuTaskId: string | null = null;
  statusEditTaskId: string | null = null;
  pendingStatus: TaskStatus | null = null;
  statusReason = '';
  statusWaitingReason = '';
  statusError = '';
  // Adding a custom status from within a row's status menu.
  addingStatusForTaskId: string | null = null;
  newStatusDraft = '';

  // ── Inline assignee menu (avatar opens a searchable people list) ──────────
  assigneeMenuTaskId: string | null = null;
  assigneeSearch = '';

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
  newTaskCustomerId = '';
  addTaskError = '';

  // ── Inline title editing ──────────────────────────────────────────────────
  editingTitleId: string | null = null;
  titleDraft = '';

  // ── Sorting (within each group) ───────────────────────────────────────────
  sortKey: SortKey = 'group';
  sortDir: 'asc' | 'desc' = 'asc';
  /** Order of the date buckets when grouped by due (asc = earliest bucket first). */
  dueGroupDir: 'asc' | 'desc' = 'asc';
  private readonly PREFS_KEY = 'actionos.taskTable.prefs';

  readonly priorities: Priority[] = ['Low', 'Medium', 'High', 'Critical'];
  private assigneeOptionEmployees: Employee[] | null = null;
  private assigneeOptionCache: SelectOption[] = [];
  private readonly groupedTasksCache: {
    groupBy: GroupMode | null;
    dueGroupDir: 'asc' | 'desc' | null;
    language: string;
    sortDir: 'asc' | 'desc' | null;
    sortKey: SortKey | null;
    tasks: Task[] | null;
    today: string;
    value: TaskGroup[];
    weekEnd: string;
  } = {
    groupBy: null,
    dueGroupDir: null,
    language: '',
    sortDir: null,
    sortKey: null,
    tasks: null,
    today: '',
    value: [],
    weekEnd: ''
  };
  private readonly priorityOptionsCache: { language: string; value: SelectOption[] } = { language: '', value: [] };
  private readonly customerOptionsCache: { source: Array<{ id: string; name: string }> | null; value: SelectOption[] } = {
    source: null,
    value: []
  };
  private readonly bulkStatusOptionsCache: { key: string; language: string; value: SelectOption[] } = {
    key: '',
    language: '',
    value: []
  };
  private readonly checklistProgressCache = new WeakMap<Task, { done: number; total: number; pct: number } | null>();
  private readonly initialsCache = new Map<string, string>();
  private readonly avatarToneCache = new Map<string, number>();

  readonly features = ACTIONOS_FEATURES;

  readonly groupModes: { id: GroupMode; labelKey: string }[] = ([
    { id: 'due',      labelKey: 'tasks.groupBy.due' },
    { id: 'status',   labelKey: 'tasks.groupBy.status' },
    { id: 'priority', labelKey: 'tasks.groupBy.priority' },
  ] as { id: GroupMode; labelKey: string }[]).filter(m => m.id !== 'priority' || ACTIONOS_FEATURES.taskPriority);

  /** Display order for the status grouping (open statuses only). */
  private readonly statusOrder: TaskStatus[] = [
    'New', 'Sent To Owner', 'In Progress',
    'Waiting For Customer', 'Waiting For Internal', 'Waiting',
    'Planned', 'Inbox',
  ];

  private readonly emptyAddGroup: TaskGroup = {
    id: 'empty',
    label: '',
    tasks: [],
    isDanger: false,
    tone: 'muted',
    headerless: true
  };

  // ── Grouping ───────────────────────────────────────────────────────────────

  constructor() { this.loadPrefs(); }

  get groupedTasks(): TaskGroup[] {
    const today = this.workspace.todayIso;
    const weekEnd = this.workspace.dateAfter(7);
    if (
      this.groupedTasksCache.tasks === this.tasks &&
      this.groupedTasksCache.groupBy === this.groupBy &&
      this.groupedTasksCache.dueGroupDir === this.dueGroupDir &&
      this.groupedTasksCache.sortKey === this.sortKey &&
      this.groupedTasksCache.sortDir === this.sortDir &&
      this.groupedTasksCache.language === this.i18n.language &&
      this.groupedTasksCache.today === today &&
      this.groupedTasksCache.weekEnd === weekEnd
    ) {
      return this.groupedTasksCache.value;
    }

    const groups = this.buildGroups();
    const value = this.sortKey === 'group'
      ? groups
      : groups.map(g => ({ ...g, tasks: this.applySort(g.tasks) }));

    this.groupedTasksCache.tasks = this.tasks;
    this.groupedTasksCache.groupBy = this.groupBy;
    this.groupedTasksCache.dueGroupDir = this.dueGroupDir;
    this.groupedTasksCache.sortKey = this.sortKey;
    this.groupedTasksCache.sortDir = this.sortDir;
    this.groupedTasksCache.language = this.i18n.language;
    this.groupedTasksCache.today = today;
    this.groupedTasksCache.weekEnd = weekEnd;
    this.groupedTasksCache.value = value;
    return value;
  }

  private buildGroups(): TaskGroup[] {
    switch (this.groupBy) {
      case 'status':   return this.groupByStatus();
      case 'priority': return this.groupByPriority();
      case 'none':     return this.groupNone();
      default:         return this.groupByDue();
    }
  }

  // ── Sorting ────────────────────────────────────────────────────────────────

  /** Click a column header: asc → desc → back to group order. */
  sortBy(key: Exclude<SortKey, 'group'>): void {
    if (this.sortKey === key) {
      if (this.sortDir === 'asc') this.sortDir = 'desc';
      else { this.sortKey = 'group'; this.sortDir = 'asc'; }
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.persistPrefs();
  }

  sortIndicator(key: Exclude<SortKey, 'group'>): string {
    if (this.sortKey !== key) return '';
    return this.sortDir === 'asc' ? '▲' : '▼';
  }

  private applySort(list: Task[]): Task[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const prio: Record<Priority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    const copy = [...list];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (this.sortKey) {
        case 'status':   cmp = this.statusOrder.indexOf(a.status) - this.statusOrder.indexOf(b.status); break;
        case 'title':    cmp = a.title.localeCompare(b.title); break;
        case 'priority': cmp = prio[a.priority] - prio[b.priority]; break;
        case 'due':      cmp = (a.dueDate || '9999').localeCompare(b.dueDate || '9999'); break;
      }
      return cmp * dir;
    });
    return copy;
  }

  private loadPrefs(): void {
    try {
      const raw = localStorage.getItem(this.PREFS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p.sortKey) this.sortKey = p.sortKey;
      if (p.sortDir) this.sortDir = p.sortDir;
      if (p.dueGroupDir) this.dueGroupDir = p.dueGroupDir;
    } catch { /* ignore malformed prefs */ }
  }

  private persistPrefs(): void {
    try {
      localStorage.setItem(this.PREFS_KEY, JSON.stringify({ sortKey: this.sortKey, sortDir: this.sortDir, dueGroupDir: this.dueGroupDir }));
    } catch { /* storage unavailable — ignore */ }
  }

  // ── Inline title editing ────────────────────────────────────────────────

  startEditTitle(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    this.editingTitleId = task.id;
    this.titleDraft = task.title;
  }

  saveTitle(task: Task): void {
    if (this.editingTitleId !== task.id) return;
    const next = this.titleDraft.trim();
    if (next && next !== task.title) {
      this.workspace.updateMeetingTask(task.id, { title: next });
    }
    this.editingTitleId = null;
  }

  cancelEditTitle(): void {
    this.editingTitleId = null;
    this.titleDraft = '';
  }

  private groupNone(): TaskGroup[] {
    if (!this.tasks.length) return [];
    return [{ id: 'all', label: '', tasks: this.tasks, isDanger: false, tone: 'muted', headerless: true }];
  }

  private groupByDue(): TaskGroup[] {
    const tasks   = this.tasks;
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
    // Buckets are built earliest→latest; flip the whole order when the user
    // chooses "latest first" (Later on top, Overdue at the bottom).
    return this.dueGroupDir === 'desc' ? groups.reverse() : groups;
  }

  /** Flip the date-bucket order (earliest-first ⇄ latest-first). */
  toggleDueGroupOrder(): void {
    this.dueGroupDir = this.dueGroupDir === 'asc' ? 'desc' : 'asc';
    this.persistPrefs();
  }

  private groupByStatus(): TaskGroup[] {
    const tasks = this.tasks;
    // Built-in order first, then any custom statuses present on the tasks.
    const extras = Array.from(new Set(tasks.map(t => t.status)))
      .filter(s => !this.statusOrder.includes(s));
    const order = [...this.statusOrder, ...extras];
    return order
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
    const tasks = this.tasks;
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

  trackGroup(_index: number, group: TaskGroup): string { return group.id; }

  trackTask(_index: number, task: Task): string { return task.id; }

  trackMode(_index: number, mode: { id: GroupMode }): GroupMode { return mode.id; }

  trackStatus(_index: number, status: TaskStatus): TaskStatus { return status; }

  trackOption(_index: number, option: SelectOption): string { return String(option.value); }

  trackChecklistItem(index: number, item: ChecklistItem): string { return `${item.label}:${index}`; }

  toggleCollapse(groupId: string): void {
    if (this.collapsedGroups.has(groupId)) this.collapsedGroups.delete(groupId);
    else this.collapsedGroups.add(groupId);
  }

  setGroupBy(mode: GroupMode): void {
    this.groupBy = mode;
    this.collapsedGroups.clear();
  }

  // ── Inline-edit option lists ──────────────────────────────────────────────

  get priorityOptions(): SelectOption[] {
    if (this.priorityOptionsCache.language !== this.i18n.language) {
      this.priorityOptionsCache.language = this.i18n.language;
      this.priorityOptionsCache.value = this.priorities.map(p => ({
        value: p, label: this.t('priority.' + this.workspace.statusClass(p))
      }));
    }
    return this.priorityOptionsCache.value;
  }

  get assigneeOptions(): SelectOption[] {
    const employees = this.workspace.employees;
    if (this.assigneeOptionEmployees !== employees) {
      this.assigneeOptionEmployees = employees;
      this.assigneeOptionCache = employees.map(e => ({ value: e.id, label: e.fullName }));
    }
    return this.assigneeOptionCache;
  }

  get customerOptions(): SelectOption[] {
    const source = this.workspace.clientOptions;
    if (this.customerOptionsCache.source !== source) {
      this.customerOptionsCache.source = source;
      this.customerOptionsCache.value = source.map(client => ({
        value: client.id,
        label: client.name
      }));
    }
    return this.customerOptionsCache.value;
  }

  get shouldPickCustomerForNewTask(): boolean {
    return !this.defaultNewTaskCustomerId;
  }

  private get defaultNewTaskCustomerId(): string {
    return this.newTaskDefaults?.customerId?.trim() ?? '';
  }

  /** Status options for a row's dropdown — only legal next states. */
  allowedStatuses(task: Task): TaskStatus[] {
    return this.workspace.allowedStatusesFor(task);
  }

  statusLabel(status: TaskStatus): string {
    // Custom statuses have no translation key — show their raw label.
    if (this.workspace.isCustomStatus(status)) return status;
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

  toggleAssigneeMenu(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    this.statusMenuTaskId = null;
    this.assigneeSearch = '';
    this.assigneeMenuTaskId = this.assigneeMenuTaskId === task.id ? null : task.id;
  }

  pickAssignee(task: Task, employeeId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.assigneeMenuTaskId = null;
    this.changeAssignee(task, employeeId);
  }

  get filteredAssigneeOptions(): SelectOption[] {
    const term = this.assigneeSearch.trim().toLowerCase();
    if (!term) return this.assigneeOptions;
    return this.assigneeOptions.filter(o => o.label.toLowerCase().includes(term));
  }

  // ── Inline status change (custom control + reason popover) ────────────────

  toggleStatusMenu(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    if (this.statusEditTaskId) return;            // mid-confirm — ignore
    this.assigneeMenuTaskId = null;
    this.addingStatusForTaskId = null;
    this.newStatusDraft = '';
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
    this.addingStatusForTaskId = null;
    this.newStatusDraft = '';
  }

  // ── Add a custom status from within a row's status menu ───────────────────

  startAddStatus(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    this.addingStatusForTaskId = task.id;
    this.newStatusDraft = '';
  }

  cancelAddStatus(): void {
    this.addingStatusForTaskId = null;
    this.newStatusDraft = '';
  }

  /** Create the custom status (if new) and stage it on this task via the reason flow. */
  confirmAddStatus(task: Task): void {
    const label = this.workspace.addCustomStatus(this.newStatusDraft);
    this.addingStatusForTaskId = null;
    this.newStatusDraft = '';
    if (!label) return;
    this.statusMenuTaskId = null;
    if (label === task.status) return;
    this.statusEditTaskId = task.id;
    this.pendingStatus = label as TaskStatus;
    this.statusReason = '';
    this.statusWaitingReason = '';
    this.statusError = '';
  }

  /** True while any inline menu / popover is open (drives the backdrop). */
  get statusOverlayOpen(): boolean {
    return !!this.statusMenuTaskId || !!this.statusEditTaskId || !!this.assigneeMenuTaskId;
  }

  /**
   * True while THIS row owns an open inline menu/popover. Used to freeze the
   * card's hover lift so the absolutely-positioned dropdown can't jitter.
   */
  isRowMenuOpen(task: Task): boolean {
    return this.statusMenuTaskId === task.id
        || this.statusEditTaskId === task.id
        || this.assigneeMenuTaskId === task.id;
  }

  /** Backdrop click — close every inline menu/popover. */
  closeOverlays(): void {
    this.assigneeMenuTaskId = null;
    this.cancelStatusChange();
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
    return this.tasks.filter(t => this.selectedIds.has(t.id));
  }

  get bulkStatusOptions(): SelectOption[] {
    const statuses = this.workspace.statuses;
    const key = statuses.join('|');
    if (this.bulkStatusOptionsCache.key !== key || this.bulkStatusOptionsCache.language !== this.i18n.language) {
      this.bulkStatusOptionsCache.key = key;
      this.bulkStatusOptionsCache.language = this.i18n.language;
      this.bulkStatusOptionsCache.value = statuses.map(s => ({ value: s, label: this.statusLabel(s) }));
    }
    return this.bulkStatusOptionsCache.value;
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
    this.newTaskCustomerId = this.defaultNewTaskCustomerId;
    this.addTaskError = '';
  }

  startEmptyAdd(event: MouseEvent): void {
    this.startAdd(this.emptyAddGroup, event);
  }

  confirmAdd(group: TaskGroup): void {
    const title = this.newTaskTitle.trim();
    if (!title) { this.cancelAdd(); return; }
    const customerId = this.defaultNewTaskCustomerId || this.newTaskCustomerId.trim();
    if (!customerId) {
      this.addTaskError = this.t('tasks.addTask.customerRequired');
      return;
    }

    const input: CreateTaskInput = {
      ...this.newTaskDefaults,
      title,
      source: this.newTaskDefaults?.source ?? 'board',
      customerId,
      priority: this.newTaskDefaults?.priority ?? this.addDefaultPriority(group),
    };
    const due = this.newTaskDefaults?.dueDate ?? this.addDefaultDue(group);
    if (due) input.dueDate = due;

    this.workspace.addTask(input);
    this.addingGroupId = null;
    this.newTaskTitle = '';
    this.newTaskCustomerId = this.defaultNewTaskCustomerId;
    this.addTaskError = '';
  }

  confirmEmptyAdd(): void {
    this.confirmAdd(this.emptyAddGroup);
  }

  cancelAdd(): void {
    this.addingGroupId = null;
    this.newTaskTitle = '';
    this.newTaskCustomerId = this.defaultNewTaskCustomerId;
    this.addTaskError = '';
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

  // ── Archive (optional) ──────────────────────────────────────────────────

  archive(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    this.archived.emit(task);
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
    if (this.checklistProgressCache.has(task)) {
      return this.checklistProgressCache.get(task) ?? null;
    }
    if (!task.checklist?.length) return null;
    const done  = task.checklist.filter(i => i.done).length;
    const total = task.checklist.length;
    const progress = { done, total, pct: Math.round((done / total) * 100) };
    this.checklistProgressCache.set(task, progress);
    return progress;
  }

  /** Meeting subject for meeting-born tasks, null for board tasks. */
  sourceMeetingName(task: Task): string | null {
    if (task.source !== 'meeting' || !task.sourceMeetingId) return null;
    return this.workspace.customerMeeting(task.sourceMeetingId)?.subject ?? null;
  }

  /** Customer name for meeting tasks, board name for board tasks. */
  taskContext(task: Task): string {
    return task.customerId
      ? (this.workspace.clientName(task.customerId) ?? '')
      : task.board;
  }

  getInitials(name: string): string {
    const cached = this.initialsCache.get(name);
    if (cached !== undefined) {
      return cached;
    }
    const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    this.initialsCache.set(name, initials);
    return initials;
  }

  /** Deterministic avatar colour index (0-5) from a name. */
  avatarTone(name: string): number {
    const cached = this.avatarToneCache.get(name);
    if (cached !== undefined) {
      return cached;
    }
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    const tone = Math.abs(hash) % 6;
    this.avatarToneCache.set(name, tone);
    return tone;
  }

  /** First click expands the row inline (when expandable); double-click opens the drawer.
   *  With the checklist feature off the expand panel has no content (it only held the
   *  checklist), so a single click just opens the task instead of expanding to a lone
   *  "open" button. */
  toggleExpand(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.expandable || !this.features.taskChecklist) { this.openTask(task); return; }
    this.expandedTaskId = this.expandedTaskId === task.id ? null : task.id;
  }

  openTask(task: Task): void {
    this.expandedTaskId = null;
    if (task.source === 'meeting') {
      this.workspace.selectMeetingTask(task);
    } else {
      this.workspace.selectBoardTask(task);
    }
    this.rowOpened.emit(task);
  }

  /** Double-clicking a row opens the full task drawer. */
  openTaskFromRow(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    this.openTask(task);
  }

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
