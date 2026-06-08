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

  // ── Meetings ────────────────────────────────────────────────────────────────

  get myMeetings(): CustomerMeeting[] {
    const empId = this.workspace.currentEmployeeId;
    const all = this.workspace.visibleCustomerMeetings;
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
  get railWorkload(): ActionosWorkspaceService['teamWorkload'] {
    return [...this.workspace.teamWorkload]
      .sort((a, b) => this.loadTotal(b) - this.loadTotal(a));
  }

  /** Deterministic accent hue (0–360) derived from a name, for avatar tints. */
  avatarHue(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
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

  /** Highest single load in the rail list — used to scale the bars. */
  get maxLoad(): number {
    return this.railWorkload.reduce((max, w) => Math.max(max, this.loadTotal(w)), 0) || 1;
  }

  // ── Right rail: clients (from the allowed external customer groups) ───────
  // Source is workspace.externalCustomerGroups — the org groups this user is
  // allowed to see (from the bootstrap allowedOrgs), not the full customer list.
  railClientSearch = '';

  get railClients(): { id: string; name: string }[] {
    const term = this.railClientSearch.trim().toLowerCase();
    const groups = [...this.workspace.externalCustomerGroups]
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!term) return groups;
    return groups.filter(g => g.name.toLowerCase().includes(term));
  }

  /** Initials for a group name (groups have no member id to look up). */
  nameInitials(name: string): string {
    return name
      .split(/\s+/)
      .map(part => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
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
    const customer = this.workspace.customer(this.boardPreview.id);
    if (customer) {
      this.boardPreview = null;
      this.prepareCustomerMeeting.emit(customer);
    }
  }

  onNewMeeting(): void {
    if (!this.boardPreview) return;
    if (this.boardPreview.type === 'client') {
      const customer = this.workspace.customer(this.boardPreview.id);
      if (customer) {
        this.boardPreview = null;
        this.newCustomerMeeting.emit(customer);
      }
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
