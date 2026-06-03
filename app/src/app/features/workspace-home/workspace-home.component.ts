import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CalendarEvent, Customer, MeetingNote, Task, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { IconComponent } from '../../shared/icons/icon.component';
import { CustomerListComponent } from '../customers/customer-list.component';
import { CalendarStatsComponent } from '../../shared/calendar-stats/calendar-stats.component';
import { StatTileComponent } from '../../shared/stat-tile/stat-tile.component';
import { ACTIONOS_NAV_ITEMS } from '../../core/config/actionos-ui.config';
import { IconName } from '../../shared/icons/icon.component';
import { BoardPreviewModalComponent, BoardPreviewType } from './board-preview-modal.component';
import { MetricModalMode, MetricTasksModalComponent } from './metric-tasks-modal.component';

/** Which metric tile's popup is open (null = none). */
export type MetricKey = 'open' | 'overdue' | 'blocked' | 'debt';

export type HomeCalFilter = 'all' | 'my-work' | 'i-opened' | 'opened-for-me' | 'by-employee';

@Component({
  selector: 'app-workspace-home',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, IconComponent, CustomerListComponent, MetricTasksModalComponent, BoardPreviewModalComponent, CalendarStatsComponent, StatTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-home.component.html',
  styleUrl: './workspace-home.component.scss'
})
export class WorkspaceHomeComponent {
  @Output() viewChange = new EventEmitter<ViewId>();
  /** A customer row was clicked on Home — open the Customer 360 detail. */
  @Output() openCustomer = new EventEmitter<Customer>();
  /** "Prepare meeting" was clicked on a Home customer row. */
  @Output() prepareCustomerMeeting = new EventEmitter<Customer>();
  /** "New meeting" clicked in the board preview popup for a client. */
  @Output() newCustomerMeeting = new EventEmitter<Customer>();

  readonly workspace = inject(ActionosWorkspaceService);
  readonly i18n = inject(ActionosI18nService);

  readonly navTiles = ACTIONOS_NAV_ITEMS.filter(i => i.id !== 'home');

  iconFor(id: ViewId): IconName {
    const map: Record<ViewId, IconName> = {
      home: 'home',
      inbox: 'inbox',
      'my-work': 'check-square',
      tasks: 'check-circle',
      boards: 'columns',
      meetings: 'calendar',
      customers: 'users',
    };
    return map[id] ?? 'home';
  }

  workloadSearch = '';

  workloadFilter: 'all' | 'assigned-by-me' | 'assigned-me' | 'met-with-me' = 'all';

  // ── Home calendar ─────────────────────────────────────────────────────────
  readonly homeCalFilter = signal<HomeCalFilter>('all');
  readonly homeCalEmpId  = signal('');

  readonly homeCalEvents = computed<CalendarEvent[]>(() => {
    switch (this.homeCalFilter()) {
      case 'my-work':      return this.workspace.myCalendarEvents;
      case 'i-opened':     return this.workspace.iOpenedCalendarEvents;
      case 'opened-for-me': return this.workspace.openedForMeCalendarEvents;
      case 'by-employee':
        return this.homeCalEmpId()
          ? this.workspace.calendarEventsForEmployee(this.homeCalEmpId())
          : this.workspace.calendarEvents;
      default:             return this.workspace.calendarEvents;
    }
  });

  onHomeCalEventOpened(evt: CalendarEvent): void {
    if (evt.kind === 'task') {
      const task = this.workspace.openTasks.find(t => t.id === evt.sourceId);
      if (task) {
        this.workspace.selectMeetingTask(task);
      }
    } else {
      this.workspace.openMeetingDrawer(evt.sourceId);
    }
  }

  // Which metric tile popup is open. Signal so the OnPush view repaints on change.
  readonly openMetric = signal<MetricKey | null>(null);

  /** Title + data for the currently open metric popup, or null when closed. */
  readonly activeMetric = computed<
    { title: string; mode: MetricModalMode; tasks: Task[]; meetingTasks: Task[]; notes: MeetingNote[] } | null
  >(() => {
    switch (this.openMetric()) {
      case 'open':
        return {
          title: 'home.openWork',
          mode: 'tasks',
          tasks: [],
          meetingTasks: this.workspace.openMeetingTasks,
          notes: []
        };
      case 'overdue':
        return {
          title: 'home.overdue',
          mode: 'tasks',
          tasks: [],
          meetingTasks: this.workspace.overdueMeetingTasks,
          notes: []
        };
      case 'blocked':
        return {
          title: 'home.blocked',
          mode: 'tasks',
          tasks: [],
          meetingTasks: this.workspace.blockedMeetingTasks,
          notes: []
        };
      case 'debt':
        return { title: 'home.followUpDebt', mode: 'notes', tasks: [], meetingTasks: [], notes: this.workspace.openMeetingActions };
      default:
        return null;
    }
  });

  openMetricModal(metric: MetricKey): void {
    this.openMetric.set(metric);
  }

  closeMetricModal(): void {
    this.openMetric.set(null);
  }

  readonly currentMember = computed(() =>
    this.workspace.members.find(m => m.id === this.workspace.currentUserId)
  );

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return this.i18n.translate('home.greetingMorning');
    if (hour < 17) return this.i18n.translate('home.greetingAfternoon');
    return this.i18n.translate('home.greetingEvening');
  });

  readonly firstName = computed(() => (this.currentMember()?.name ?? this.i18n.translate('home.greetingFallbackName')).split(' ')[0]);

  readonly todayLabel = computed(() =>
    new Intl.DateTimeFormat(this.i18n.language === 'he' ? 'he-IL' : 'en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(new Date())
  );

  readonly summaryLine = computed(() => {
    const meetings = this.workspace.calendarEventsToday.length;
    const tasks = this.workspace.myOpenMeetingTasks.length;
    const overdue = this.workspace.overdueOperationalTaskCount;
    const parts: string[] = [];
    if (meetings) parts.push(this.i18n.translate(meetings === 1 ? 'home.summaryMeeting' : 'home.summaryMeetings', { n: meetings }));
    if (tasks) parts.push(this.i18n.translate(tasks === 1 ? 'home.summaryOpenTask' : 'home.summaryOpenTasks', { n: tasks }));
    if (overdue) parts.push(this.i18n.translate('home.summaryOverdueCount', { n: overdue }));
    if (!parts.length) return this.i18n.translate('home.summaryEmpty');
    return this.i18n.translate('home.summaryLine', { parts: parts.join(' · ') });
  });

  // --- Searchable Home lists ---
  // Each getter returns the section's data filtered by its search term. With no
  // term we keep the original (capped) view; while searching we drop the cap so
  // matches further down the list are still reachable.

  get filteredWorkload(): ActionosWorkspaceService['teamWorkload'] {
    const term = this.workloadSearch.trim().toLowerCase();
    let all = this.workspace.teamWorkload;

    if (this.workloadFilter === 'assigned-by-me') {
      const myId = this.workspace.currentUserId;
      const assigneeIds = new Set(
        this.workspace.openTasks
          .filter(t => t.createdByUserId === myId && !t.assigneeIds.every(a => a === myId))
          .flatMap(t => t.assigneeIds.filter(a => a !== myId))
      );
      all = all.filter(w => assigneeIds.has(w.member.id));
    } else if (this.workloadFilter === 'assigned-me') {
      const myId = this.workspace.currentUserId;
      const creatorIds = new Set(
        this.workspace.openTasks
          .filter(t => t.assigneeIds.includes(myId) && t.createdByUserId && t.createdByUserId !== myId)
          .map(t => t.createdByUserId!)
      );
      all = all.filter(w => creatorIds.has(w.member.id));
    } else if (this.workloadFilter === 'met-with-me') {
      const myEmpId = this.workspace.currentEmployeeId;
      const coAttendeeEmpIds = new Set(
        this.workspace.customerMeetings
          .filter(m => m.meetingLeaderEmployeeId === myEmpId || m.internalParticipantEmployeeIds.includes(myEmpId))
          .flatMap(m => [m.meetingLeaderEmployeeId, ...m.internalParticipantEmployeeIds])
          .filter(id => id !== myEmpId)
      );
      const coAttendeeMemberIds = new Set(
        [...coAttendeeEmpIds]
          .map(empId => this.workspace.memberIdForEmployee(empId))
          .filter((id): id is string => !!id)
      );
      all = all.filter(w => coAttendeeMemberIds.has(w.member.id));
    }

    if (!term) return all;
    return all.filter(w =>
      w.member.name.toLowerCase().includes(term) ||
      (w.member.team?.toLowerCase().includes(term) ?? false)
    );
  }

  openView(view: ViewId): void {
    this.viewChange.emit(view);
  }

  // ── Board preview popup ────────────────────────────────────────────────
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
