import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CalendarEvent, Customer, CustomerMeeting, Member, MeetingNote, NoteType,
  Task, TaskStatus, ViewId
} from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { CalendarComponent } from '../../shared/calendar/calendar.component';
import { IconComponent } from '../../shared/icons/icon.component';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { StatTileComponent } from '../../shared/stat-tile/stat-tile.component';
import { TaskTableComponent } from '../../shared/task-table/task-table.component';

export type BoardEntityType = 'client' | 'member';

/** Tabs on the client board. Member board only uses overview/tasks. */
export type BoardTab = 'overview' | 'recap' | 'meetings' | 'tasks';

/** Quick filter applied to the Tasks tab. Driven by the stat tiles too. */
export type TaskLens = 'all' | 'open' | 'overdue' | 'blocked';

/**
 * A board is the profile for one client (or member): who they are, what just
 * happened (recap & notes), and what is still open. The layout mirrors My Work
 * and Tasks — actionable stat tiles, a calendar strip, meeting cards, and the
 * one shared task table — so the whole app reads the same way.
 */
@Component({
  selector: 'app-boards',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe, AppDatePipe, IconComponent,
    SearchableSelectComponent, StatTileComponent, CalendarComponent, TaskTableComponent
  ],
  templateUrl: './boards.component.html',
  styleUrl: './boards.component.scss'
})
export class BoardsComponent {
  @Output() viewChange = new EventEmitter<ViewId>();

  entityType: BoardEntityType = 'client';
  selectedClientId = '';
  selectedMemberId = '';
  boardSearch = '';

  activeTab: BoardTab = 'overview';
  taskLens: TaskLens = 'all';

  constructor(public workspace: ActionosWorkspaceService, private i18n: ActionosI18nService) {
    const clients = workspace.customers;
    if (clients.length) {
      this.selectedClientId = clients[0].id;
    }
    const members = workspace.members;
    if (members.length) {
      this.selectedMemberId = members[0].id;
    }
  }

  // ── Selectors / options ───────────────────────────────────────────────

  get selectedClient(): Customer | null {
    return this.workspace.customers.find(c => c.id === this.selectedClientId) ?? null;
  }

  get selectedMember(): Member | null {
    return this.workspace.members.find(m => m.id === this.selectedMemberId) ?? null;
  }

  get boardTypeOptions(): SelectOption[] {
    return [
      { value: 'client', label: this.i18n.translate('boards.clientBoard') },
      { value: 'member', label: this.i18n.translate('boards.memberBoard') }
    ];
  }

  get clientSelectOptions(): SelectOption[] {
    return this.workspace.customers.map(c => ({ value: c.id, label: c.name }));
  }

  get memberSelectOptions(): SelectOption[] {
    return this.workspace.members.map(m => ({ value: m.id, label: m.name }));
  }

  get taskLensOptions(): { id: TaskLens; labelKey: string }[] {
    return [
      { id: 'all',     labelKey: 'noteType.all' },
      { id: 'open',    labelKey: 'boards.openTasks' },
      { id: 'overdue', labelKey: 'tasks.tiles.overdue' },
      { id: 'blocked', labelKey: 'boards.blocked' }
    ];
  }

  // ── Tabs ────────────────────────────────────────────────────────────────

  get clientTabs(): { id: BoardTab; icon: 'columns' | 'file-text' | 'calendar' | 'check-square'; labelKey: string; count?: number; danger?: boolean }[] {
    return [
      { id: 'overview', icon: 'columns',      labelKey: 'boards.tabs.overview' },
      { id: 'recap',    icon: 'file-text',    labelKey: 'boards.tabs.recap',    count: this.clientMeetingCount },
      { id: 'meetings', icon: 'calendar',     labelKey: 'boards.meetings',      count: this.clientMeetingCount },
      { id: 'tasks',    icon: 'check-square', labelKey: 'boards.tasks',         count: this.clientOpenCount, danger: this.clientOverdueCount > 0 }
    ];
  }

  get memberTabs(): { id: BoardTab; icon: 'columns' | 'check-square'; labelKey: string; count?: number; danger?: boolean }[] {
    return [
      { id: 'overview', icon: 'columns',      labelKey: 'boards.tabs.overview' },
      { id: 'tasks',    icon: 'check-square', labelKey: 'boards.tasks', count: this.memberOpenCount, danger: this.memberOverdueCount > 0 }
    ];
  }

  selectTab(tab: BoardTab): void {
    this.activeTab = tab;
  }

  onEntityTypeChange(): void {
    this.boardSearch = '';
    this.taskLens = 'all';
    this.activeTab = 'overview';
  }

  /** Stat-tile click → jump to the matching tab with the right lens applied. */
  openLens(tab: BoardTab, lens: TaskLens): void {
    this.taskLens = lens;
    this.activeTab = tab;
  }

  // ── Client: meetings ──────────────────────────────────────────────────

  /** All of the client's meetings, newest first (search-independent). */
  get clientMeetingsSorted(): CustomerMeeting[] {
    if (!this.selectedClientId) return [];
    return this.workspace.customerMeetingsByCustomer(this.selectedClientId)
      .slice()
      .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
  }

  /** Search-filtered meetings for the Meetings tab. */
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

  get latestMeeting(): CustomerMeeting | null {
    return this.clientMeetingsSorted[0] ?? null;
  }

  get clientMeetingCount(): number {
    return this.clientMeetingsSorted.length;
  }

  meetingTaskCountFor(meetingId: string): number {
    return this.workspace.meetingTasksByMeeting(meetingId).length;
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

  // ── Recap & notes ─────────────────────────────────────────────────────

  recapText(m: CustomerMeeting): string {
    return (m.publishedRecap ?? m.summary ?? '').trim();
  }

  notesOfType(m: CustomerMeeting, type: NoteType): MeetingNote[] {
    return m.notes.filter(n => n.type === type);
  }

  /** Pending (not yet converted) action items — surfaced for one-click convert. */
  pendingActions(m: CustomerMeeting): MeetingNote[] {
    return m.notes.filter(n => n.type === 'action' && !n.convertedTaskId);
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

  // ── Member ────────────────────────────────────────────────────────────

  get selectedMemberEmployeeId(): string {
    return this.selectedMemberId
      ? (this.workspace.employeeIdForMember(this.selectedMemberId) ?? '')
      : '';
  }

  private memberBaseTasks(): Task[] {
    if (!this.selectedMemberId) return [];
    const employeeId = this.workspace.employeeIdForMember(this.selectedMemberId);
    if (!employeeId) return [];
    return this.workspace.meetingTasks.filter(t =>
      t.assignedToEmployeeId === employeeId || t.openedByEmployeeId === employeeId
    );
  }

  /** Search-filtered member tasks (before the lens filter). */
  get memberTasks(): Task[] {
    const tasks = this.memberBaseTasks();
    if (!this.boardSearch) return tasks;
    const q = this.boardSearch.toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q) ||
      (this.workspace.customer(t.customerId)?.name?.toLowerCase().includes(q) ?? false)
    );
  }

  get memberTasksForTab(): Task[] {
    return this.applyLens(this.memberTasks);
  }

  get memberOpenTasks(): Task[] {
    return this.memberBaseTasks().filter(t => this.workspace.isOpenMeetingTaskStatus(t.status));
  }

  get memberOpenCount(): number { return this.memberOpenTasks.length; }
  get memberTotalCount(): number { return this.memberBaseTasks().length; }
  get memberOverdueCount(): number { return this.memberBaseTasks().filter(t => this.isOverdue(t)).length; }
  get memberBlockedCount(): number { return this.memberBaseTasks().filter(t => this.isBlocked(t)).length; }

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

  // ── Navigation ────────────────────────────────────────────────────────

  openView(view: ViewId): void {
    this.viewChange.emit(view);
  }

  openMeeting(meetingId: string): void {
    this.workspace.openMeetingDrawer(meetingId);
  }

  convertAction(meetingId: string, noteId: string): void {
    this.workspace.convertMeetingAction(meetingId, noteId);
  }
}
