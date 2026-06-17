import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CalendarEvent, Customer, CustomerMeeting, MeetingNote, Task, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { CalendarStatsComponent } from '../../shared/calendar-stats/calendar-stats.component';
import { CalendarCreatePickerComponent } from '../../shared/calendar-create-picker/calendar-create-picker.component';
import { MeetingCardComponent } from '../../shared/meeting-card/meeting-card.component';
import { IconComponent } from '../../shared/icons/icon.component';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import { StatMeetingsViewComponent } from '../../shared/stat-modal/stat-meetings-view.component';
import { StatModalComponent } from '../../shared/stat-modal/stat-modal.component';
import { StatTasksViewComponent } from '../../shared/stat-modal/stat-tasks-view.component';
import { StatTileComponent } from '../../shared/stat-tile/stat-tile.component';
import { TaskTableComponent } from '../../shared/task-table/task-table.component';
import { InboxComponent } from '../inbox/inbox.component';
import { BoardPreviewModalComponent, BoardPreviewType } from '../workspace-home/board-preview-modal.component';

export type MeetingFilter = 'upcoming' | 'led' | 'past';
export type TaskFilter = 'mine' | 'delegated' | 'all-involved';

/** Which summary-tile popup is open (null = none). */
export type StatModalKey = 'overdue' | 'today' | 'followups' | 'meetings';

@Component({
  selector: 'app-my-work',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe, AppDatePipe, InboxComponent, TaskTableComponent, IconComponent,
    CalendarStatsComponent, CalendarCreatePickerComponent, MeetingCardComponent, StatModalComponent,
    StatTasksViewComponent, StatMeetingsViewComponent, StatTileComponent,
    BoardPreviewModalComponent
  ],
  templateUrl: './my-work.component.html',
  styleUrl: './my-work.component.scss'
})
export class MyWorkComponent {
  @Output() viewChange = new EventEmitter<ViewId>();
  /** A client row in the rail was opened for its full Customer 360 profile. */
  @Output() openCustomer = new EventEmitter<Customer>();
  /** "Prepare meeting" clicked for a rail client. */
  @Output() prepareCustomerMeeting = new EventEmitter<Customer>();
  /** "New meeting" clicked in the board preview popup for a client. */
  @Output() newCustomerMeeting = new EventEmitter<Customer>();

  readonly workspace = inject(ActionosWorkspaceService);
  readonly i18n = inject(ActionosI18nService);

  // Two views now: the Inbox feed (default), and a combined "Work" view that
  // shows the meetings carousel + tasks table together (Boards-style) instead of
  // the old separate Tasks / Meetings tabs.
  readonly activeTab = signal<'inbox' | 'work'>('inbox');

  /** Meetings carousel (false) vs. expanded grid (true) — same as Boards. */
  meetingsExpanded = false;

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
  private readonly myMeetingsCache: {
    employeeId: string;
    filter: MeetingFilter | null;
    source: CustomerMeeting[] | null;
    value: CustomerMeeting[];
  } = { employeeId: '', filter: null, source: null, value: [] };
  private readonly myFilteredTasksCache: {
    employeeId: string;
    filter: TaskFilter | null;
    source: Task[] | null;
    value: Task[];
  } = { employeeId: '', filter: null, source: null, value: [] };
  private readonly myActiveTasksCache: { employeeId: string; source: Task[] | null; value: Task[] } = {
    employeeId: '',
    source: null,
    value: []
  };
  private readonly overdueTasksCache: { activeTasks: Task[] | null; today: string; value: Task[] } = {
    activeTasks: null,
    today: '',
    value: []
  };
  private readonly todayTasksCache: { activeTasks: Task[] | null; today: string; value: Task[] } = {
    activeTasks: null,
    today: '',
    value: []
  };
  private readonly meetingsTodayCache: {
    employeeId: string;
    source: CustomerMeeting[] | null;
    today: string;
    value: CustomerMeeting[];
  } = { employeeId: '', source: null, today: '', value: [] };
  private readonly railWorkloadCache: {
    search: string;
    source: ActionosWorkspaceService['teamWorkload'] | null;
    value: ActionosWorkspaceService['teamWorkload'];
  } = { search: '', source: null, value: [] };
  private readonly railClientsCache: {
    search: string;
    source: { id: string; name: string }[] | null;
    value: { id: string; name: string }[];
  } = { search: '', source: null, value: [] };
  private readonly todayLabelCache: { language: string; today: string; value: string } = {
    language: '',
    today: '',
    value: ''
  };
  private readonly avatarHueCache = new Map<string, number>();
  private readonly initialsCache = new Map<string, string>();

  // ── Meetings ────────────────────────────────────────────────────────────────

  get myMeetings(): CustomerMeeting[] {
    const empId = this.workspace.currentEmployeeId;
    const all = this.workspace.customerMeetings;
    if (
      this.myMeetingsCache.source === all &&
      this.myMeetingsCache.employeeId === empId &&
      this.myMeetingsCache.filter === this.meetingFilter
    ) {
      return this.myMeetingsCache.value;
    }

    const isMine = (m: CustomerMeeting) =>
      m.meetingLeaderEmployeeId === empId || m.internalParticipantEmployeeIds.includes(empId);

    let value: CustomerMeeting[];
    switch (this.meetingFilter) {
      case 'upcoming':
        value = all.filter(m => isMine(m) && m.status !== 'Closed');
        break;
      case 'led':
        value = all.filter(m => m.meetingLeaderEmployeeId === empId && m.status !== 'Closed');
        break;
      case 'past':
        value = all.filter(m => isMine(m) && m.status === 'Closed');
        break;
      default:
        value = [];
    }
    this.myMeetingsCache.source = all;
    this.myMeetingsCache.employeeId = empId;
    this.myMeetingsCache.filter = this.meetingFilter;
    this.myMeetingsCache.value = value;
    return value;
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
    const source = this.workspace.meetingTasks;
    if (
      this.myFilteredTasksCache.source === source &&
      this.myFilteredTasksCache.employeeId === empId &&
      this.myFilteredTasksCache.filter === this.taskFilter
    ) {
      return this.myFilteredTasksCache.value;
    }

    const active = source.filter(t => t.status !== 'Done' && t.status !== 'Cancelled');

    let value: Task[];
    switch (this.taskFilter) {
      case 'mine':
        value = active.filter(t => t.assignedToEmployeeId === empId);
        break;
      case 'delegated':
        value = active.filter(t => t.openedByEmployeeId === empId && t.assignedToEmployeeId !== empId);
        break;
      case 'all-involved':
        value = active.filter(t => t.assignedToEmployeeId === empId || t.openedByEmployeeId === empId);
        break;
      default:
        value = [];
    }
    this.myFilteredTasksCache.source = source;
    this.myFilteredTasksCache.employeeId = empId;
    this.myFilteredTasksCache.filter = this.taskFilter;
    this.myFilteredTasksCache.value = value;
    return value;
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
    const today = this.workspace.todayIso;
    if (this.todayLabelCache.language === this.i18n.language && this.todayLabelCache.today === today) {
      return this.todayLabelCache.value;
    }

    this.todayLabelCache.language = this.i18n.language;
    this.todayLabelCache.today = today;
    this.todayLabelCache.value = new Intl.DateTimeFormat(this.i18n.language === 'he' ? 'he-IL' : 'en-GB', {
      weekday: 'long', month: 'long', day: 'numeric'
    }).format(new Date());
    return this.todayLabelCache.value;
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

  // ── Calendar slot → create meeting or task ──────────────────────────────────
  // My Work hosts both meetings and tasks, so clicking an empty slot asks which
  // to create via the shared chooser dialog before opening the matching creator.

  readonly createSlot = signal<Date | null>(null);

  onCalSlotSelected(date: Date): void {
    this.createSlot.set(date);
  }

  createMeetingAt(date: Date): void {
    this.createSlot.set(null);
    this.workspace.openNewMeetingModal(null, date);
  }

  createTaskAt(date: Date): void {
    this.createSlot.set(null);
    this.workspace.startNewTaskAt(date, this.i18n.translate('calendar.newTaskTitle'));
  }

  // ── Summary strip ─────────────────────────────────────────────────────────
  // Glanceable, tab-independent lists shown above the tabs. All four use the
  // same "mine" semantics as the Tasks "My tasks" filter so a tile never
  // disagrees with the popup it opens. Counts are derived from the same lists
  // the popups render, so the number and the list can never drift apart.

  private get myActiveTasks(): Task[] {
    const empId = this.workspace.currentEmployeeId;
    const source = this.workspace.meetingTasks;
    if (this.myActiveTasksCache.source === source && this.myActiveTasksCache.employeeId === empId) {
      return this.myActiveTasksCache.value;
    }

    const value = source.filter(
      t => t.status !== 'Done' && t.status !== 'Cancelled' && t.assignedToEmployeeId === empId
    );
    this.myActiveTasksCache.source = source;
    this.myActiveTasksCache.employeeId = empId;
    this.myActiveTasksCache.value = value;
    return value;
  }

  get overdueTasksList(): Task[] {
    const today = this.workspace.todayIso;
    const activeTasks = this.myActiveTasks;
    if (this.overdueTasksCache.activeTasks === activeTasks && this.overdueTasksCache.today === today) {
      return this.overdueTasksCache.value;
    }
    const value = activeTasks.filter(t => !!t.dueDate && t.dueDate < today);
    this.overdueTasksCache.activeTasks = activeTasks;
    this.overdueTasksCache.today = today;
    this.overdueTasksCache.value = value;
    return value;
  }

  get todayTasksList(): Task[] {
    const today = this.workspace.todayIso;
    const activeTasks = this.myActiveTasks;
    if (this.todayTasksCache.activeTasks === activeTasks && this.todayTasksCache.today === today) {
      return this.todayTasksCache.value;
    }
    const value = activeTasks.filter(t => !!t.dueDate && t.dueDate === today);
    this.todayTasksCache.activeTasks = activeTasks;
    this.todayTasksCache.today = today;
    this.todayTasksCache.value = value;
    return value;
  }

  get meetingsTodayList(): CustomerMeeting[] {
    const empId = this.workspace.currentEmployeeId;
    const source = this.workspace.customerMeetings;
    const today = this.workspace.todayIso;
    if (
      this.meetingsTodayCache.source === source &&
      this.meetingsTodayCache.employeeId === empId &&
      this.meetingsTodayCache.today === today
    ) {
      return this.meetingsTodayCache.value;
    }
    const value = source.filter(
      m => m.meetingDate.slice(0, 10) === today &&
        (m.meetingLeaderEmployeeId === empId || m.internalParticipantEmployeeIds.includes(empId))
    );
    this.meetingsTodayCache.source = source;
    this.meetingsTodayCache.employeeId = empId;
    this.meetingsTodayCache.today = today;
    this.meetingsTodayCache.value = value;
    return value;
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

  // ── Meetings carousel (mirrors the Meetings/Boards rails) ────────────────
  scrollRail(track: HTMLElement, dir: number): void {
    track.scrollBy({ left: dir * track.clientWidth * 0.9, behavior: 'smooth' });
  }

  /** Translate vertical wheel motion into horizontal scroll on the carousel.
   *  No-op when there's nothing to scroll horizontally (e.g. the expanded grid),
   *  so vertical page scroll passes through. */
  onRailWheel(event: WheelEvent, track: HTMLElement): void {
    if (track.scrollWidth <= track.clientWidth) return;
    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!delta) return;
    event.preventDefault();
    track.scrollBy({ left: delta, behavior: 'auto' });
  }

  // ── Right rail: team load ────────────────────────────────────────────────
  // A condensed version of the old Home "owners & blockers" panel. Shows the
  // whole team, sorted by total load (busiest first), and scrolls inside the
  // card so every employee is reachable.
  /** Free-text filter for the team-load rail (matches member name). */
  railWorkloadSearch = '';

  get railWorkload(): ActionosWorkspaceService['teamWorkload'] {
    const source = this.workspace.teamWorkload;
    const term = this.railWorkloadSearch.trim().toLowerCase();
    if (this.railWorkloadCache.source === source && this.railWorkloadCache.search === term) {
      return this.railWorkloadCache.value;
    }
    const sorted = [...source]
      .sort((a, b) => this.loadTotal(b) - this.loadTotal(a));
    const value = term
      ? sorted.filter(w => w.member.name.toLowerCase().includes(term))
      : sorted;
    this.railWorkloadCache.source = source;
    this.railWorkloadCache.search = term;
    this.railWorkloadCache.value = value;
    return value;
  }

  /** Deterministic accent hue (0–360) derived from a name, for avatar tints. */
  avatarHue(name: string): number {
    const cached = this.avatarHueCache.get(name);
    if (cached !== undefined) {
      return cached;
    }
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
    this.avatarHueCache.set(name, hash);
    return hash;
  }

  /** Total open + blocked across boards and meetings for one teammate. */
  loadTotal(w: ActionosWorkspaceService['teamWorkload'][number]): number {
    return w.openCount + w.meetingOpenCount + w.blockedCount + w.meetingBlockedCount;
  }

  blockedTotal(w: ActionosWorkspaceService['teamWorkload'][number]): number {
    return w.blockedCount + w.meetingBlockedCount;
  }

  openTotal(w: ActionosWorkspaceService['teamWorkload'][number]): number {
    return w.openCount + w.meetingOpenCount;
  }

  /** Highest single load across the whole team — used to scale the bars.
   *  Based on the unfiltered list so bar widths stay stable while searching. */
  get maxLoad(): number {
    return this.workspace.teamWorkload.reduce((max, w) => Math.max(max, this.loadTotal(w)), 0) || 1;
  }

  // ── Right rail: clients (from the allowed external customer groups) ───────
  // Source is workspace.externalCustomerGroups — the org groups this user is
  // allowed to see (from the bootstrap allowedOrgs), not the full customer list.
  railClientSearch = '';

  get railClients(): { id: string; name: string }[] {
    const term = this.railClientSearch.trim().toLowerCase();
    const source = this.workspace.externalCustomerGroups;
    if (this.railClientsCache.source === source && this.railClientsCache.search === term) {
      return this.railClientsCache.value;
    }
    const groups = [...source]
      .sort((a, b) => a.name.localeCompare(b.name));
    const value = term ? groups.filter(g => g.name.toLowerCase().includes(term)) : groups;
    this.railClientsCache.source = source;
    this.railClientsCache.search = term;
    this.railClientsCache.value = value;
    return value;
  }

  /** Initials for a group name (groups have no member id to look up). */
  nameInitials(name: string): string {
    const cached = this.initialsCache.get(name);
    if (cached !== undefined) {
      return cached;
    }
    const initials = name
      .split(/\s+/)
      .map(part => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
    this.initialsCache.set(name, initials);
    return initials;
  }

  trackMeetingFilter(_index: number, filter: { id: MeetingFilter }): MeetingFilter { return filter.id; }
  trackTaskFilter(_index: number, filter: { id: TaskFilter }): TaskFilter { return filter.id; }
  trackMeeting(_index: number, meeting: CustomerMeeting): string { return meeting.id; }
  trackRailClient(_index: number, group: { id: string }): string { return group.id; }
  trackWorkload(_index: number, workload: ActionosWorkspaceService['teamWorkload'][number]): string {
    return workload.member.id;
  }
  trackFollowup(_index: number, item: { note: MeetingNote; meeting: CustomerMeeting }): string {
    return `${item.meeting.id}:${item.note.id}`;
  }

  /** Open a client group's board preview, resolving it to a customer if one
   *  matches (so meetings/tasks populate); otherwise preview by group id. */
  openClientGroup(group: { id: string; name: string }): void {
    const customer =
      this.workspace.customer(group.id) ??
      this.workspace.customers.find(c => c.externalGroupId === group.id);
    if (customer) {
      this.openClientBoard(customer);
    } else {
      this.boardPreview = { type: 'client', id: group.id, name: group.name };
    }
  }

  // ── Right rail: client / member board-preview popup ──────────────────────
  // Reuses the same quick-view popup the old Home used, so clicking a rail
  // client or teammate opens their board without leaving My Work.
  boardPreview: { type: BoardPreviewType; id: string; name: string } | null = null;

  openClientBoard(customer: Customer): void {
    this.boardPreview = { type: 'client', id: customer.id, name: customer.name };
  }

  openMemberBoard(memberId: string, memberName: string): void {
    this.boardPreview = { type: 'member', id: memberId, name: memberName };
  }

  closeBoardPreview(): void {
    this.boardPreview = null;
  }

  onPrepareMeeting(): void {
    if (!this.boardPreview || this.boardPreview.type !== 'client') return;
    const customerId = this.boardPreview.id;
    this.boardPreview = null;
    this.workspace.openCatchUpDrawer(customerId);
  }

  onNewMeeting(): void {
    if (!this.boardPreview) return;
    if (this.boardPreview.type === 'client') {
      const customerId = this.boardPreview.id;
      this.boardPreview = null;
      this.workspace.openNewMeetingModal(customerId);
    } else {
      this.boardPreview = null;
      this.viewChange.emit('meetings');
    }
  }

  openClientFullProfile(customerId: string): void {
    const customer = this.workspace.customer(customerId);
    if (customer) {
      this.boardPreview = null;
      this.openCustomer.emit(customer);
    }
  }
}
