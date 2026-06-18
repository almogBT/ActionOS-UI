import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CalendarEvent, Customer, CustomerMeeting, CustomerMeetingStatus, MeetingNote, Task, ViewId
} from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { ACTIONOS_FEATURES } from '../../core/config/actionos-ui.config';
import { CalendarStatsComponent } from '../../shared/calendar-stats/calendar-stats.component';
import { IconComponent } from '../../shared/icons/icon.component';
import { MeetingCardComponent } from '../../shared/meeting-card/meeting-card.component';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { StatMeetingsViewComponent } from '../../shared/stat-modal/stat-meetings-view.component';
import { StatModalComponent } from '../../shared/stat-modal/stat-modal.component';
import { StatTasksViewComponent } from '../../shared/stat-modal/stat-tasks-view.component';
import { StatTileComponent } from '../../shared/stat-tile/stat-tile.component';
import { CustomerMeetingFormComponent, MeetingFormSavedEvent } from '../customers/customer-meeting-form.component';

type MeetingLane = 'upcoming' | 'in-progress' | 'closed';
/** The two list sections: open (Tasks Created) vs Completed (Closed). */
type MeetingSection = 'tasks-created' | 'completed';
export type MeetingTileLens = 'upcoming' | 'in-progress' | 'open-tasks';
type QuickFilter = 'all' | 'week' | 'led';

interface LaneBucket {
  lane: MeetingSection;
  labelKey: string;
  meetings: CustomerMeeting[];
}

interface MeetingLaneCache {
  source: CustomerMeeting[];
  today: string;
  lanes: Record<MeetingLane, CustomerMeeting[]>;
}

@Component({
  selector: 'app-meetings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, MeetingCardComponent, SearchableSelectComponent, CalendarStatsComponent, IconComponent, StatModalComponent, StatMeetingsViewComponent, StatTasksViewComponent, StatTileComponent, CustomerMeetingFormComponent],
  templateUrl: './meetings.component.html',
  styleUrl: './meetings.component.scss'
})
export class MeetingsComponent implements OnInit, OnChanges {
  @Input() openNewTick = 0;
  @Output() viewChange = new EventEmitter<ViewId>();
  @Output() prepareMeeting = new EventEmitter<Customer>();

  readonly features = ACTIONOS_FEATURES;

  customerFilter: 'all' | string = 'all';
  showPrepPicker = false;
  prepPickerCustomerId = '';
  openLens: MeetingTileLens | null = null;

  /** Set while continuing a just-created meeting inline in the embedded right pane. */
  embeddedMeetingId: string | null = null;
  /** Bump to force a clean re-instantiation of the blank new-meeting form. */
  formResetKey = 0;
  trackFormKey = (_: number, k: number): number => k;
  /** Collapsible right-pane form — open by default; clicking the title toggles it. */
  formOpen = true;

  /** Free-text search across subject / customer / goal. */
  search = '';
  userFilterToAdd = '';
  selectedUserFilterIds: string[] = [];

  /** Quick-filter pill currently active. */
  quickFilter: QuickFilter = 'all';

  readonly quickFilterOptions: { id: QuickFilter; labelKey: string }[] = [
    { id: 'all',       labelKey: 'meetingsOverview.filterAll' },
    { id: 'week',      labelKey: 'meetingsOverview.filterThisWeek' },
    { id: 'led',       labelKey: 'meetingsOverview.filterLed' }
  ];

  private readonly emptyMeetings: CustomerMeeting[] = [];

  private customerFilterOptionsCache: { clients: { id: string; name: string }[]; language: string; options: SelectOption[] } | null = null;
  private prepPickerOptionsCache: { clients: { id: string; name: string }[]; options: SelectOption[] } | null = null;
  private customerScopedMeetingsCache: {
    meetings: CustomerMeeting[];
    customerFilter: string;
    result: CustomerMeeting[];
  } | null = null;
  private filteredMeetingsCache: {
    scopedMeetings: CustomerMeeting[];
    search: string;
    userIdsKey: string;
    quickFilter: QuickFilter;
    currentEmployeeId: string;
    today: string;
    weekEnd: string;
    result: CustomerMeeting[];
  } | null = null;
  private userFilterOptionsCache: {
    employeeIdsKey: string;
    selectedIdsKey: string;
    options: SelectOption[];
  } | null = null;
  private attentionMeetingsCache: {
    scopedMeetings: CustomerMeeting[];
    today: string;
    result: CustomerMeeting[];
  } | null = null;
  private laneCache: MeetingLaneCache | null = null;
  private bucketsCache: { laneCache: MeetingLaneCache; buckets: LaneBucket[] } | null = null;
  private meetingCalendarEventsCache: { events: CalendarEvent[]; result: CalendarEvent[] } | null = null;
  private actionItemsCache = new WeakMap<CustomerMeeting, { notes: MeetingNote[]; result: MeetingNote[] }>();

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
    const clients = this.workspace.clientOptions;
    const language = this.i18n.language;
    const cached = this.customerFilterOptionsCache;
    if (cached && cached.clients === clients && cached.language === language) {
      return cached.options;
    }

    const options = [
      { value: 'all', label: this.i18n.translate('meetingsOverview.allCustomers') },
      ...clients.map(c => ({ value: c.id, label: c.name }))
    ];
    this.customerFilterOptionsCache = { clients, language, options };
    return options;
  }

  get prepPickerOptions(): SelectOption[] {
    const clients = this.workspace.clientOptions;
    const cached = this.prepPickerOptionsCache;
    if (cached && cached.clients === clients) {
      return cached.options;
    }

    const options = clients.map(c => ({ value: c.id, label: c.name }));
    this.prepPickerOptionsCache = { clients, options };
    return options;
  }

  /** Customer-scoped only — the stable set the attention rail is built from. */
  get customerScopedMeetings(): CustomerMeeting[] {
    const all = this.workspace.customerMeetings;
    const cached = this.customerScopedMeetingsCache;
    if (cached && cached.meetings === all && cached.customerFilter === this.customerFilter) {
      return cached.result;
    }

    const result = this.customerFilter === 'all'
      ? all
      : this.workspace.customerMeetingsByCustomer(this.customerFilter);
    this.customerScopedMeetingsCache = { meetings: all, customerFilter: this.customerFilter, result };
    return result;
  }

  /** Customer scope + search + active quick-filter — drives the lanes. */
  get filteredMeetings(): CustomerMeeting[] {
    const scopedMeetings = this.customerScopedMeetings;
    const search = this.search.trim().toLowerCase();
    const userIdsKey = this.selectedUserFilterIds.join('|');
    const today = this.todayIso();
    const weekEnd = this.weekEndIso(today);
    const currentEmployeeId = this.workspace.currentEmployeeId;
    const cached = this.filteredMeetingsCache;
    if (
      cached &&
      cached.scopedMeetings === scopedMeetings &&
      cached.search === search &&
      cached.userIdsKey === userIdsKey &&
      cached.quickFilter === this.quickFilter &&
      cached.currentEmployeeId === currentEmployeeId &&
      cached.today === today &&
      cached.weekEnd === weekEnd
    ) {
      return cached.result;
    }

    let list = scopedMeetings;

    if (search) {
      list = list.filter(m =>
        m.subject.toLowerCase().includes(search) ||
        (this.workspace.clientName(m.customerId) ?? '').toLowerCase().includes(search) ||
        (m.goal ?? '').toLowerCase().includes(search)
      );
    }

    if (this.selectedUserFilterIds.length) {
      list = list.filter(m => this.selectedUserFilterIds.every(id => this.meetingAttendeeIds(m).includes(id)));
    }

    switch (this.quickFilter) {
      case 'week':      list = list.filter(m => this.isWithinWeek(m, today, weekEnd)); break;
      case 'led':       list = list.filter(m => this.isMeetingLed(m)); break;
    }

    this.filteredMeetingsCache = {
      scopedMeetings,
      search,
      userIdsKey,
      quickFilter: this.quickFilter,
      currentEmployeeId,
      today,
      weekEnd,
      result: list
    };
    return list;
  }

  get hasActiveFilters(): boolean {
    return this.quickFilter !== 'all'
      || !!this.search.trim()
      || this.customerFilter !== 'all'
      || this.selectedUserFilterIds.length > 0;
  }

  get userFilterOptions(): SelectOption[] {
    const employees = this.workspace.employees;
    const employeeIdsKey = employees.map(e => e.id).join('|');
    const selectedIdsKey = this.selectedUserFilterIds.join('|');
    const cached = this.userFilterOptionsCache;
    if (cached && cached.employeeIdsKey === employeeIdsKey && cached.selectedIdsKey === selectedIdsKey) {
      return cached.options;
    }

    const selected = new Set(this.selectedUserFilterIds);
    const options = employees
      .filter(e => !selected.has(e.id))
      .map(e => ({ value: e.id, label: e.fullName }));
    this.userFilterOptionsCache = { employeeIdsKey, selectedIdsKey, options };
    return options;
  }

  // ── Attention rail ──────────────────────────────────────────────────────────
  // Meetings that still have at least one open task (any task not Done/Cancelled).

  get attentionMeetings(): CustomerMeeting[] {
    const scopedMeetings = this.customerScopedMeetings;
    const today = this.todayIso();
    const cached = this.attentionMeetingsCache;
    if (cached && cached.scopedMeetings === scopedMeetings && cached.today === today) {
      return cached.result;
    }

    const result = scopedMeetings
      .filter(m => this.needsAttention(m))
      .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
    this.attentionMeetingsCache = { scopedMeetings, today, result };
    return result;
  }

  private needsAttention(m: CustomerMeeting): boolean {
    // Surfaced while the meeting still has an open task (not Done / not Cancelled).
    return this.workspace
      .meetingTasksByMeeting(m.id)
      .some(t => this.workspace.isOpenMeetingTaskStatus(t.status));
  }

  // ── Lanes ─────────────────────────────────────────────────────────────────

  get buckets(): LaneBucket[] {
    const laneCache = this.getLaneCache();
    const cached = this.bucketsCache;
    if (cached && cached.laneCache === laneCache) {
      return cached.buckets;
    }

    // Two sections only: everything that isn't Closed (upcoming + still-active,
    // shown under "Tasks Created") and the Closed meetings ("Completed").
    const buckets: LaneBucket[] = [
      {
        lane: 'tasks-created',
        labelKey: 'meetingsOverview.tasksCreatedLane',
        meetings: [...laneCache.lanes.upcoming, ...laneCache.lanes['in-progress']]
      },
      {
        lane: 'completed',
        labelKey: 'meetingsOverview.completedLane',
        meetings: laneCache.lanes.closed
      }
    ];
    this.bucketsCache = { laneCache, buckets };
    return buckets;
  }

  getLane(lane: MeetingLane): CustomerMeeting[] {
    return this.getLaneCache().lanes[lane] ?? this.emptyMeetings;
  }

  // ── Lane collapse ───────────────────────────────────────────────────────────
  // Collapsing + per-lane scrolling keeps the page navigable once a lane holds
  // hundreds of meetings: a collapsed lane renders no cards at all, and an
  // expanded lane scrolls inside a capped viewport instead of growing the page.

  private collapsedLanes = new Set<MeetingSection>();

  isLaneCollapsed(lane: MeetingSection): boolean {
    return this.collapsedLanes.has(lane);
  }

  toggleLane(lane: MeetingSection): void {
    if (this.collapsedLanes.has(lane)) {
      this.collapsedLanes.delete(lane);
    } else {
      this.collapsedLanes.add(lane);
    }
  }

  // ── Per-meeting helpers used by filtering / attention rail ──────────────────
  // Card display + recap moved into the shared <app-meeting-card>; only the
  // helpers the lane/attention filters depend on remain here.

  isMeetingLed(m: CustomerMeeting): boolean {
    return m.meetingLeaderEmployeeId === this.workspace.currentEmployeeId;
  }

  addUserFilter(employeeId: string): void {
    if (!employeeId || this.selectedUserFilterIds.includes(employeeId)) {
      this.userFilterToAdd = '';
      return;
    }
    this.selectedUserFilterIds = [...this.selectedUserFilterIds, employeeId];
    this.userFilterToAdd = '';
  }

  removeUserFilter(employeeId: string): void {
    this.selectedUserFilterIds = this.selectedUserFilterIds.filter(id => id !== employeeId);
  }

  userFilterName(employeeId: string): string {
    return this.workspace.employeeName(employeeId);
  }

  meetingActionItems(m: CustomerMeeting): MeetingNote[] {
    const cached = this.actionItemsCache.get(m);
    if (cached && cached.notes === m.notes) {
      return cached.result;
    }

    const result = m.notes.filter(n => n.type === 'action' && !n.convertedTaskId);
    this.actionItemsCache.set(m, { notes: m.notes, result });
    return result;
  }

  get openMeetingTasksCount(): number {
    return this.workspace.openMeetingTasks.length;
  }

  get openMeetingTasks(): Task[] {
    return this.workspace.openMeetingTasks;
  }

  // ── Calendar (meetings only, no tasks) ────────────────────────────────────

  get meetingCalendarEvents(): CalendarEvent[] {
    const events = this.workspace.calendarEvents;
    const cached = this.meetingCalendarEventsCache;
    if (cached && cached.events === events) {
      return cached.result;
    }

    const result = events.filter(e => e.kind !== 'task');
    this.meetingCalendarEventsCache = { events, result };
    return result;
  }

  onCalendarEventOpened(evt: CalendarEvent): void {
    this.workspace.openMeetingDrawer(evt.sourceId);
  }

  /** Clicking an empty calendar slot starts a new meeting at that date + time. */
  onCalendarSlotSelected(date: Date): void {
    this.workspace.openNewMeetingModal(null, date);
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
    if (!customerId) {
      return;
    }
    this.showPrepPicker = false;
    this.prepPickerCustomerId = '';
    this.workspace.openCatchUpDrawer(customerId);
  }

  newMeeting(): void {
    // The new-meeting form is now embedded in the page (right pane), not a drawer.
    // External "start a new meeting" intents (openNewTick) just reset that form.
    this.resetEmbeddedForm();
  }

  /** Mirrors the drawer's onSaved, but keeps the form embedded in the right pane. */
  onEmbeddedSaved(event: MeetingFormSavedEvent): void {
    if (event.intent === 'close') {
      this.resetEmbeddedForm();
    } else {
      // 'continue': keep editing the just-created meeting inline (notes / tasks).
      this.embeddedMeetingId = event.meetingId;
    }
  }

  /** Return the right pane to a fresh, blank new-meeting form. */
  resetEmbeddedForm(): void {
    this.embeddedMeetingId = null;
    this.formResetKey++;
  }

  openMeeting(m: CustomerMeeting): void {
    this.workspace.openMeetingDrawer(m.id);
  }

  openTask(task: Task): void {
    this.workspace.selectMeetingTask(task);
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
    this.selectedUserFilterIds = [];
    this.userFilterToAdd = '';
  }

  trackQuickFilter(_: number, filter: { id: QuickFilter }): QuickFilter {
    return filter.id;
  }

  trackBucket(_: number, bucket: LaneBucket): MeetingSection {
    return bucket.lane;
  }

  trackMeeting(_: number, meeting: CustomerMeeting): string {
    return meeting.id;
  }

  trackUserFilter(_: number, employeeId: string): string {
    return employeeId;
  }

  private assignLane(m: CustomerMeeting, today: string): MeetingLane {
    const meetingDay = m.meetingDate.slice(0, 10);
    const closedStatuses: CustomerMeetingStatus[] = ['Closed'];
    if (closedStatuses.includes(m.status)) return 'closed';
    if (meetingDay >= today) return 'upcoming';
    return 'in-progress';
  }

  private getLaneCache(): MeetingLaneCache {
    const source = this.filteredMeetings;
    const today = this.todayIso();
    const cached = this.laneCache;
    if (cached && cached.source === source && cached.today === today) {
      return cached;
    }

    const lanes: Record<MeetingLane, CustomerMeeting[]> = {
      upcoming: [],
      'in-progress': [],
      closed: []
    };
    source.forEach((meeting) => {
      lanes[this.assignLane(meeting, today)].push(meeting);
    });

    const nextCache = { source, today, lanes };
    this.laneCache = nextCache;
    return nextCache;
  }

  private isWithinWeek(m: CustomerMeeting, today: string, weekEnd: string): boolean {
    const day = m.meetingDate.slice(0, 10);
    return day >= today && day <= weekEnd;
  }

  private meetingAttendeeIds(meeting: CustomerMeeting): string[] {
    return [meeting.meetingLeaderEmployeeId, ...meeting.internalParticipantEmployeeIds];
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private weekEndIso(today: string): string {
    const start = new Date(`${today}T00:00:00Z`);
    return new Date(start.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  }
}
