import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CalendarEvent, Customer, CustomerMeeting, CustomerMeetingStatus, MeetingNote, Task, ViewId
} from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { CalendarComponent } from '../../shared/calendar/calendar.component';
import { IconComponent } from '../../shared/icons/icon.component';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { StatMeetingsViewComponent } from '../../shared/stat-modal/stat-meetings-view.component';
import { StatModalComponent } from '../../shared/stat-modal/stat-modal.component';
import { StatTasksViewComponent } from '../../shared/stat-modal/stat-tasks-view.component';
import { StatTileComponent } from '../../shared/stat-tile/stat-tile.component';

type MeetingLane = 'upcoming' | 'in-progress' | 'closed';
export type MeetingTileLens = 'upcoming' | 'in-progress' | 'open-tasks';
type QuickFilter = 'all' | 'week' | 'followups' | 'led';

interface LaneBucket {
  lane: MeetingLane;
  labelKey: string;
  meetings: CustomerMeeting[];
}

@Component({
  selector: 'app-meetings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, AppDatePipe, SearchableSelectComponent, CalendarComponent, IconComponent, StatModalComponent, StatMeetingsViewComponent, StatTasksViewComponent, StatTileComponent],
  templateUrl: './meetings.component.html',
  styleUrl: './meetings.component.scss'
})
export class MeetingsComponent implements OnInit, OnChanges {
  @Input() openNewTick = 0;
  @Output() viewChange = new EventEmitter<ViewId>();
  @Output() prepareMeeting = new EventEmitter<Customer>();

  customerFilter: 'all' | string = 'all';
  showPrepPicker = false;
  prepPickerCustomerId = '';
  openLens: MeetingTileLens | null = null;

  /** Free-text search across subject / customer / goal. */
  search = '';

  /** Quick-filter pill currently active. */
  quickFilter: QuickFilter = 'all';

  readonly quickFilterOptions: { id: QuickFilter; labelKey: string }[] = [
    { id: 'all',       labelKey: 'meetingsOverview.filterAll' },
    { id: 'week',      labelKey: 'meetingsOverview.filterThisWeek' },
    { id: 'followups', labelKey: 'meetingsOverview.filterFollowups' },
    { id: 'led',       labelKey: 'meetingsOverview.filterLed' }
  ];

  constructor(public workspace: ActionosWorkspaceService, private i18n: ActionosI18nService) {}

  ngOnInit(): void {
    const id = this.workspace.pendingOpenMeetingId;
    if (id) {
      this.workspace.pendingOpenMeetingId = null;
      const meeting = this.workspace.customerMeetings.find(m => m.id === id);
      if (meeting) { this.openMeeting(meeting); }
    } else if (this.openNewTick > 0) {
      this.newMeeting();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['openNewTick'] && !changes['openNewTick'].firstChange) {
      this.newMeeting();
    }
  }

  // ── Customer filter ───────────────────────────────────────────────────────

  get customerFilterOptions(): SelectOption[] {
    return [
      { value: 'all', label: this.i18n.translate('meetingsOverview.allCustomers') },
      ...this.workspace.customers.map(c => ({ value: c.id, label: c.name }))
    ];
  }

  get prepPickerOptions(): SelectOption[] {
    return this.workspace.customers.map(c => ({ value: c.id, label: c.name }));
  }

  /** Customer-scoped only — the stable set the attention rail is built from. */
  get customerScopedMeetings(): CustomerMeeting[] {
    const all = this.workspace.customerMeetings;
    return this.customerFilter === 'all'
      ? all
      : all.filter(m => m.customerId === this.customerFilter);
  }

  /** Customer scope + search + active quick-filter — drives the lanes. */
  get filteredMeetings(): CustomerMeeting[] {
    let list = this.customerScopedMeetings;

    const q = this.search.trim().toLowerCase();
    if (q) {
      list = list.filter(m =>
        m.subject.toLowerCase().includes(q) ||
        (this.workspace.customer(m.customerId)?.name ?? '').toLowerCase().includes(q) ||
        (m.goal ?? '').toLowerCase().includes(q)
      );
    }

    switch (this.quickFilter) {
      case 'week':      list = list.filter(m => this.isThisWeek(m)); break;
      case 'followups': list = list.filter(m => this.meetingActionItems(m).length > 0); break;
      case 'led':       list = list.filter(m => this.isMeetingLed(m)); break;
    }
    return list;
  }

  get hasActiveFilters(): boolean {
    return this.quickFilter !== 'all' || !!this.search.trim() || this.customerFilter !== 'all';
  }

  // ── Attention rail ──────────────────────────────────────────────────────────
  // Meetings that are waiting on the rep: open follow-up action items, or a
  // meeting that has already happened but was never wrapped up.

  get attentionMeetings(): CustomerMeeting[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.customerScopedMeetings
      .filter(m => this.needsAttention(m, today))
      .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
  }

  private needsAttention(m: CustomerMeeting, today: string): boolean {
    if (m.status === 'Closed') return false;
    if (this.meetingActionItems(m).length > 0) return true;
    const day = m.meetingDate.slice(0, 10);
    return day < today && (m.status === 'Planned' || m.status === 'Draft Summary');
  }

  // ── Lanes ─────────────────────────────────────────────────────────────────

  get buckets(): LaneBucket[] {
    return [
      { lane: 'upcoming',    labelKey: 'meetingsOverview.upcoming',   meetings: this.getLane('upcoming') },
      { lane: 'in-progress', labelKey: 'meetingsOverview.inProgress', meetings: this.getLane('in-progress') },
      { lane: 'closed',      labelKey: 'meetingsOverview.closed',     meetings: this.getLane('closed') }
    ];
  }

  getLane(lane: MeetingLane): CustomerMeeting[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.filteredMeetings.filter(m => this.assignLane(m, today) === lane);
  }

  // ── Lane collapse ───────────────────────────────────────────────────────────
  // Collapsing + per-lane scrolling keeps the page navigable once a lane holds
  // hundreds of meetings: a collapsed lane renders no cards at all, and an
  // expanded lane scrolls inside a capped viewport instead of growing the page.

  private collapsedLanes = new Set<MeetingLane>();

  isLaneCollapsed(lane: MeetingLane): boolean {
    return this.collapsedLanes.has(lane);
  }

  toggleLane(lane: MeetingLane): void {
    if (this.collapsedLanes.has(lane)) {
      this.collapsedLanes.delete(lane);
    } else {
      this.collapsedLanes.add(lane);
    }
  }

  // ── Per-meeting helpers (cards) ─────────────────────────────────────────────

  tasksFromMeeting(m: CustomerMeeting): Task[] {
    return this.workspace.meetingTasksByMeeting(m.id);
  }

  isMeetingLed(m: CustomerMeeting): boolean {
    return m.meetingLeaderEmployeeId === this.workspace.currentEmployeeId;
  }

  meetingActionItems(m: CustomerMeeting): MeetingNote[] {
    return m.notes.filter(n => n.type === 'action' && !n.convertedTaskId);
  }

  meetingLeaderName(m: CustomerMeeting): string {
    return this.workspace.employeeName(m.meetingLeaderEmployeeId);
  }

  leaderInitials(m: CustomerMeeting): string {
    return this.initials(this.meetingLeaderName(m));
  }

  /** Extra attendees beyond the leader (internal teammates + customer side). */
  participantCount(m: CustomerMeeting): number {
    return m.internalParticipantEmployeeIds.length + m.customerParticipants.length;
  }

  private initials(name: string): string {
    return (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('') || '?';
  }

  private isThisWeek(m: CustomerMeeting): boolean {
    const day = m.meetingDate.slice(0, 10);
    const now = new Date();
    const start = now.toISOString().slice(0, 10);
    const end = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
    return day >= start && day <= end;
  }

  get openMeetingTasksCount(): number {
    return this.workspace.openMeetingTasks.length;
  }

  get openMeetingTasks(): Task[] {
    return this.workspace.openMeetingTasks;
  }

  // ── Calendar (meetings only, no tasks) ────────────────────────────────────

  get meetingCalendarEvents(): CalendarEvent[] {
    return this.workspace.calendarEvents.filter(e => e.kind !== 'task');
  }

  onCalendarEventOpened(evt: CalendarEvent): void {
    this.workspace.openMeetingDrawer(evt.sourceId);
  }

  // ── Tile popup ────────────────────────────────────────────────────────────

  openTile(lens: MeetingTileLens): void {
    this.openLens = lens;
  }

  closeTile(): void {
    this.openLens = null;
  }

  get lensMeetings(): CustomerMeeting[] {
    if (!this.openLens || this.openLens === 'open-tasks') return [];
    return this.getLane(this.openLens as MeetingLane);
  }

  get lensTitleKey(): string {
    switch (this.openLens) {
      case 'upcoming':    return 'meetingsOverview.upcoming';
      case 'in-progress': return 'meetingsOverview.inProgress';
      case 'open-tasks':  return 'meetingsOverview.openMeetingTasks';
      default:            return 'meetingsOverview.title';
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  onPrepCustomerSelected(customerId: string): void {
    const customer = this.workspace.customers.find(c => c.id === customerId);
    if (customer) {
      this.showPrepPicker = false;
      this.prepPickerCustomerId = '';
      this.prepareMeeting.emit(customer);
    }
  }

  newMeeting(): void {
    this.workspace.openNewMeetingModal();
  }

  openMeeting(m: CustomerMeeting): void {
    this.workspace.openMeetingDrawer(m.id);
  }

  openTask(task: Task): void {
    this.workspace.selectMeetingTask(task);
  }

  /** Turn a meeting follow-up note into a task without leaving the page. */
  convertAction(m: CustomerMeeting, noteId: string, evt: Event): void {
    evt.stopPropagation();
    this.workspace.convertMeetingAction(m.id, noteId);
  }

  /** Scroll the attention carousel by ~one viewport. dir: -1 prev, +1 next. */
  scrollRail(track: HTMLElement, dir: number): void {
    track.scrollBy({ left: dir * track.clientWidth * 0.8, behavior: 'smooth' });
  }

  /** While hovering the carousel, translate vertical wheel motion into a
   *  horizontal scroll so a normal mouse wheel can move the rail sideways. */
  onRailWheel(e: WheelEvent, track: HTMLElement): void {
    if (track.scrollWidth <= track.clientWidth) return;   // nothing to scroll
    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (!delta) return;
    e.preventDefault();
    track.scrollBy({ left: delta, behavior: 'auto' });
  }

  clearFilters(): void {
    this.quickFilter = 'all';
    this.search = '';
    this.customerFilter = 'all';
  }

  private assignLane(m: CustomerMeeting, today: string): MeetingLane {
    const meetingDay = m.meetingDate.slice(0, 10);
    const closedStatuses: CustomerMeetingStatus[] = ['Closed'];
    if (closedStatuses.includes(m.status)) return 'closed';
    if (meetingDay >= today) return 'upcoming';
    return 'in-progress';
  }
}
