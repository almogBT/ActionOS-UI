import { inject, Injectable, signal } from '@angular/core';
import { ActionosI18nService } from '../i18n/actionos-i18n.service';
import { ActionosAuthService } from './auth.service';
import {
  ActivityLog, AgendaItem, Attachment, AttachmentEntityType, BoardTemplate, CalendarEvent, CalendarEventKind, ChecklistItem, Comment, CreateCustomerInput, CreateCustomerMeetingInput, CreateMeetingNoteInput, CreateMeetingTaskInput, CreateMemberInput, CreateTaskInput, Customer, CustomerMeeting, CustomerMeetingStatus, CustomerParticipant, CustomerPreparationSummary, Employee, InboxFeedItem, InboxState, MailNotificationPrefs, Meeting, MeetingNote, Task, TaskStatus, Member, MyWorkTab, NoteType, QuickCaptureType, UpdateCustomerMeetingInput, UpdateMeetingNoteInput, UpdateMeetingTaskInput, UpdateTaskInput } from '../models/actionos.models';
import { ACTIONOS_BOARD_TEMPLATES } from '../config/actionos-ui.config';
import {
  CustomerRepositoryPort,
  InMemoryCustomerRepository
} from './customer-repository.port';
import {
  CustomerMeetingRepositoryPort,
  InMemoryCustomerMeetingRepository
} from './meeting-repository.port';
import { hasFritzDomain } from './employee-directory.port';
import {
  AttachmentStoragePort,
  InMemoryAttachmentStorage
} from './attachment-storage.port';
import {
  ActionosApiAttachmentDto,
  ActionosApiCustomerDto,
  ActionosApiCustomerMeetingDto,
  ActionosApiMeetingNoteDto,
  ActionosApiTaskDto,
  ActionosApiUserDto,
  ActionosBootstrapDto,
  ActionosRepositoryService
} from './actionos-repository.service';
import { HostContextService } from './host-context.service';

interface TeamWorkload {
  member: Member;
  openCount: number;
  blockedCount: number;
  meetingOpenCount: number;
  meetingBlockedCount: number;
}

interface RevisionCache<T> {
  revision: number;
  value: T;
}

interface ActionosBackendIssue {
  message: string;
  detail?: string;
  occurredAt: string;
}

interface PendingCustomerMutation {
  operation: (customerId: string) => Promise<unknown>;
  failureMessage?: string;
}

interface DirectoryUserMergeInput {
  id?: string | null;
  azureObjectId?: string | null;
  displayName?: string | null;
  email?: string | null;
  isActive?: boolean | null;
}

interface BackendMutationOptions<TResult> {
  failureMessage?: string;
  onSuccess?: (result: TResult) => void;
  onFailure?: (error: unknown) => void;
}

const UNIFIED_TASK_STATUSES: TaskStatus[] = [
  'New',
  'Sent To Owner',
  'In Progress',
  'Waiting For Customer',
  'Waiting For Internal',
  'Done',
  'Cancelled'
];

const DEFAULT_MAIL_NOTIFICATION_PREFS: MailNotificationPrefs = {
  newTasks: false,
  overdueTasks: false,
  dueTodayTasks: false,
  meetingSummaries: false
};

@Injectable({ providedIn: 'root' })
export class ActionosWorkspaceService {
  private readonly realtimeRefreshIntervalMs = 15000;
  private readonly minRefreshGapMs = 3000;
  private readonly auth = inject(ActionosAuthService);
  private readonly i18n = inject(ActionosI18nService);
  private readonly actionosApi = inject(ActionosRepositoryService);
  private readonly hostContext = inject(HostContextService);
  private currentOrgGroupId: string | null = null;
  private initScheduled = false;
  private bootstrapInFlight: Promise<void> | null = null;
  private refreshInFlight: Promise<void> | null = null;
  private lastBootstrapKey: string | null = null;
  private lastRefreshStartedAt = 0;
  private refreshScheduled = false;
  private pendingMutationCount = 0;
  private mutationRefreshPending = false;
  private realtimeRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private realtimeListenersAttached = false;
  private readonly taskChecklistMeta = new Map<string, Array<{ id: number; label: string }>>();
  private readonly meetingIdAliases = new Map<string, string>();
  private readonly meetingNoteIdAliases = new Map<string, string>();
  private readonly pendingMeetingMutations = new Map<string, Array<(meetingIdNumeric: number) => Promise<unknown>>>();
  private readonly pendingMeetingNoteMutations = new Map<string, Array<(meetingIdNumeric: number, noteIdNumeric: number) => Promise<unknown>>>();
  private readonly taskIdAliases = new Map<string, string>();
  private readonly pendingTaskMutations = new Map<string, Array<(taskIdNumeric: number) => Promise<unknown>>>();
  private readonly customerIdAliases = new Map<string, string>();
  private readonly pendingCustomerIds = new Set<string>();
  private readonly pendingCustomerMutations = new Map<string, PendingCustomerMutation[]>();
  private readonly dataRevisionState = signal(0);
  private get dataRevision(): number {
    return this.dataRevisionState();
  }
  private readonly emptyTasks: Task[] = [];
  private readonly emptyMeetings: CustomerMeeting[] = [];
  private readonly allTasksCache: RevisionCache<Task[]> = { revision: -1, value: [] };
  private readonly openTasksCache: RevisionCache<Task[]> = { revision: -1, value: [] };
  private readonly archivedTasksCache: RevisionCache<Task[]> = { revision: -1, value: [] };
  private readonly customersCache: RevisionCache<Customer[]> = { revision: -1, value: [] };
  private readonly customerByIdCache: RevisionCache<Map<string, Customer>> = { revision: -1, value: new Map() };
  private readonly customerByExternalGroupCache: RevisionCache<Map<string, Customer>> = { revision: -1, value: new Map() };
  private readonly taskClientOptionsCache: RevisionCache<Array<{ id: string; name: string }>> = { revision: -1, value: [] };
  private readonly customerMeetingsCache: RevisionCache<CustomerMeeting[]> = { revision: -1, value: [] };
  private readonly customerMeetingsByCustomerCache: RevisionCache<Map<string, CustomerMeeting[]>> = { revision: -1, value: new Map() };
  private readonly meetingTasksByCustomerCache: RevisionCache<Map<string, Task[]>> = { revision: -1, value: new Map() };
  private readonly meetingTasksByMeetingCache: RevisionCache<Map<string, Task[]>> = { revision: -1, value: new Map() };
  private readonly employeeByIdCache: RevisionCache<Map<string, Employee>> = { revision: -1, value: new Map() };
  private readonly memberByIdCache: RevisionCache<Map<string, Member>> = { revision: -1, value: new Map() };
  private readonly teamWorkloadCache: RevisionCache<TeamWorkload[]> = { revision: -1, value: [] };
  private readonly myUnconvertedActionItemsCache: RevisionCache<Array<{ note: MeetingNote; meeting: CustomerMeeting }>> & { currentEmployeeId: string } = {
    revision: -1,
    currentEmployeeId: '',
    value: []
  };
  private readonly inboxFeedCache: RevisionCache<InboxFeedItem[]> & {
    currentEmployeeId: string;
    currentUserId: string;
    dismissedKey: string;
    language: string;
    today: string;
  } = {
    revision: -1,
    currentEmployeeId: '',
    currentUserId: '',
    dismissedKey: '',
    language: '',
    today: '',
    value: []
  };
  private readonly calendarEventsCache: RevisionCache<CalendarEvent[]> = { revision: -1, value: [] };
  private readonly myCalendarEventsCache: RevisionCache<CalendarEvent[]> & { currentEmployeeId: string; currentUserId: string } = {
    revision: -1,
    currentEmployeeId: '',
    currentUserId: '',
    value: []
  };

  currentUserId = '';
  currentEmployeeId = '';
  readonly backendIssue = signal<ActionosBackendIssue | null>(null);
  /** Set before navigating to the meetings view to auto-open a specific meeting. Consumed and cleared by MeetingsComponent.ngOnInit. */
  pendingOpenMeetingId: string | null = null;
  /** ID of the meeting currently open in the meeting modal. Null means no existing meeting is open. */
  openMeetingId: string | null = null;
  /** Customer ID for a new meeting being created in the modal. Null means not creating. */
  openNewMeetingCustomerId: string | null = null;
  /** ISO date to prefill into the new-meeting form (set when creating from a calendar slot). Consumed and cleared by the meeting form. */
  pendingNewMeetingDate: string | null = null;

  /** Last selected client on the Clients page — held on the singleton so it
   *  survives the component being destroyed/recreated on navigation away/back. */
  boardClientId = '';

  get meetingModalOpen(): boolean {
    return this.openMeetingId !== null || this.openNewMeetingCustomerId !== undefined && this.openNewMeetingCustomerId !== null;
  }

  openMeetingDrawer(id: string): void {
    this.openNewMeetingCustomerId = null;
    this.openMeetingId = id;
  }

  openNewMeetingModal(customerId: string | null = null, date: Date | null = null): void {
    this.openMeetingId = null;
    this.openNewMeetingCustomerId = customerId ?? '';
    this.pendingNewMeetingDate = date ? date.toISOString() : null;
  }

  closeMeetingDrawer(): void {
    this.openMeetingId = null;
    this.openNewMeetingCustomerId = null;
    this.pendingNewMeetingDate = null;
  }

  /** Customer whose catch-up brief is open in the bottom drawer. Null = closed. */
  catchUpCustomerId: string | null = null;

  get catchUpDrawerOpen(): boolean {
    return this.catchUpCustomerId !== null;
  }

  openCatchUpDrawer(customerId: string): void {
    this.catchUpCustomerId = customerId;
  }

  closeCatchUpDrawer(): void {
    this.catchUpCustomerId = null;
  }

  private readonly MAIL_NOTIF_KEY = 'actionos.mail-notif-prefs';

  readonly mailNotifPrefs = signal<MailNotificationPrefs>(this.loadMailNotifPrefs());

  private loadMailNotifPrefs(): MailNotificationPrefs {
    try {
      const raw = localStorage.getItem(this.MAIL_NOTIF_KEY);
      return raw
        ? this.normalizeMailNotifPrefs(JSON.parse(raw) as Partial<MailNotificationPrefs>)
        : { ...DEFAULT_MAIL_NOTIFICATION_PREFS };
    } catch {
      return { ...DEFAULT_MAIL_NOTIFICATION_PREFS };
    }
  }

  toggleMailNotif(key: keyof MailNotificationPrefs): void {
    const previous = this.mailNotifPrefs();
    const updated = { ...previous, [key]: !previous[key] };
    this.mailNotifPrefs.set(updated);
    this.persistMailNotifPrefs(updated);

    const orgGroupId = this.getOrgGroupForMutation();
    if (!orgGroupId) {
      return;
    }

    this.persistAndRefresh(
      this.actionosApi.updateMailNotificationPreferences(orgGroupId, updated),
      {
        failureMessage: 'ActionOS could not save mail notification preferences.',
        onSuccess: (saved) => {
          const normalized = this.normalizeMailNotifPrefs(saved);
          this.mailNotifPrefs.set(normalized);
          this.persistMailNotifPrefs(normalized);
        },
        onFailure: () => {
          this.mailNotifPrefs.set(previous);
          this.persistMailNotifPrefs(previous);
        }
      }
    );
  }

  private normalizeMailNotifPrefs(prefs?: Partial<MailNotificationPrefs> | null): MailNotificationPrefs {
    return {
      newTasks: prefs?.newTasks ?? DEFAULT_MAIL_NOTIFICATION_PREFS.newTasks,
      overdueTasks: prefs?.overdueTasks ?? DEFAULT_MAIL_NOTIFICATION_PREFS.overdueTasks,
      dueTodayTasks: prefs?.dueTodayTasks ?? DEFAULT_MAIL_NOTIFICATION_PREFS.dueTodayTasks,
      meetingSummaries: prefs?.meetingSummaries ?? DEFAULT_MAIL_NOTIFICATION_PREFS.meetingSummaries
    };
  }

  private persistMailNotifPrefs(prefs: MailNotificationPrefs): void {
    try {
      localStorage.setItem(this.MAIL_NOTIF_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage failures; the API is the source of truth in backend mode.
    }
  }

  // ── Inbox feed read/dismiss state ───────────────────────────────────────
  // Notifications are *derived* from live task/meeting data (see `inboxFeed`),
  // so there is no notification table to persist. We only persist which item
  // ids the user has read or dismissed, in localStorage (same pattern as the
  // mail-notification prefs above). Ids are capped so storage cannot grow
  // unbounded as items churn.
  private readonly INBOX_STATE_KEY = 'actionos.inbox-state';
  private readonly inboxStateSig = signal<InboxState>(this.loadInboxState());

  private loadInboxState(): InboxState {
    try {
      const raw = localStorage.getItem(this.INBOX_STATE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        read: Array.isArray(parsed?.read) ? parsed.read : [],
        dismissed: Array.isArray(parsed?.dismissed) ? parsed.dismissed : []
      };
    } catch {
      return { read: [], dismissed: [] };
    }
  }

  private persistInboxState(next: InboxState): void {
    const cap = (ids: string[]) => (ids.length > 500 ? ids.slice(-500) : ids);
    const trimmed: InboxState = { read: cap(next.read), dismissed: cap(next.dismissed) };
    this.inboxStateSig.set(trimmed);
    try {
      localStorage.setItem(this.INBOX_STATE_KEY, JSON.stringify(trimmed));
    } catch {
      /* storage full / unavailable — keep the in-memory signal */
    }
  }

  isInboxUnread(id: string): boolean {
    return !this.inboxStateSig().read.includes(id);
  }

  markInboxRead(id: string): void {
    const state = this.inboxStateSig();
    if (state.read.includes(id)) {
      return;
    }
    this.persistInboxState({ ...state, read: [...state.read, id] });
  }

  markAllInboxRead(): void {
    const ids = this.inboxFeed.map(item => item.id);
    const state = this.inboxStateSig();
    this.persistInboxState({ ...state, read: Array.from(new Set([...state.read, ...ids])) });
  }

  /** Hide an item from the feed permanently (also marks it read). */
  dismissInboxItem(id: string): void {
    const state = this.inboxStateSig();
    const dismissed = state.dismissed.includes(id) ? state.dismissed : [...state.dismissed, id];
    const read = state.read.includes(id) ? state.read : [...state.read, id];
    this.persistInboxState({ read, dismissed });
  }

  get inboxUnreadCount(): number {
    return this.inboxFeed.filter(item => this.isInboxUnread(item.id)).length;
  }

  // ── Statuses (built-in + user-added custom) ──────────────────────────────
  // Custom statuses are free-form labels the user adds from the task drawer or
  // table. They persist in localStorage and can be assigned to any task without
  // transition rules (built-in statuses keep their state-machine).
  private readonly CUSTOM_STATUS_KEY = 'actionos.custom-statuses';
  private customStatusesState: string[] = this.loadCustomStatuses();

  /** Built-in statuses followed by any user-added custom ones. */
  get statuses(): TaskStatus[] {
    return [...UNIFIED_TASK_STATUSES, ...this.customStatusesState] as TaskStatus[];
  }
  get meetingTaskStatuses(): TaskStatus[] { return this.statuses; }
  get customStatuses(): string[] { return this.customStatusesState; }

  isCustomStatus(status: string): boolean {
    return !(UNIFIED_TASK_STATUSES as string[]).includes(status);
  }

  /** Add a reusable custom status; returns the stored label (existing or new). */
  addCustomStatus(label: string): string | null {
    const trimmed = label.trim();
    if (!trimmed) return null;
    const existing = this.statuses.find(s => s.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;                 // already a built-in or custom status
    this.customStatusesState = [...this.customStatusesState, trimmed];
    this.persistCustomStatuses();
    return trimmed;
  }

  private loadCustomStatuses(): string[] {
    try {
      const raw = localStorage.getItem(this.CUSTOM_STATUS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed.filter((s: unknown): s is string => typeof s === 'string') : [];
    } catch {
      return [];
    }
  }

  private persistCustomStatuses(): void {
    try {
      localStorage.setItem(this.CUSTOM_STATUS_KEY, JSON.stringify(this.customStatusesState));
    } catch { /* storage unavailable — ignore */ }
  }

  readonly templates = ACTIONOS_BOARD_TEMPLATES;
  externalCustomerGroups: { id: string; name: string }[] = [];
  private readonly meetingTaskTransitions: Partial<Record<TaskStatus, TaskStatus[]>> = {
    'New': ['Sent To Owner', 'In Progress', 'Waiting For Customer', 'Waiting For Internal', 'Done', 'Cancelled'],
    'Sent To Owner': ['In Progress', 'Waiting For Customer', 'Waiting For Internal', 'Done', 'Cancelled'],
    'In Progress': ['Waiting For Customer', 'Waiting For Internal', 'Done', 'Cancelled'],
    'Waiting For Customer': ['In Progress', 'Done', 'Cancelled'],
    'Waiting For Internal': ['In Progress', 'Done', 'Cancelled'],
    'Done': ['In Progress'],
    'Cancelled': ['In Progress']
  };

  selectedTaskId = '';
  drawerOpen = false;
  selectedTaskKind: 'board-task' | 'meeting-task' = 'meeting-task';
  private quickCaptureTaskDraft: Task | null = null;
  private quickCaptureDraftNumber = 0;
  /**
   * A second, independent new-task draft used by the embedded task form on the
   * Tasks page (the right-pane form). It is deliberately separate from
   * `quickCaptureTaskDraft` (which is owned by the drawer / quick-capture flow)
   * so the always-present page form never collides with selecting/editing an
   * existing task in the drawer. Like the quick-capture draft it lives only in
   * memory until the user explicitly saves it.
   */
  private embeddedTaskDraft: Task | null = null;

  private membersState: Member[] = [];
  private tasksState: Task[] = [];
  private meetingState: Meeting = this.createEmptyMeeting();
  private commentsState: Comment[] = [];
  private activityState: ActivityLog[] = [];

  // v3 state — wrapped in objects so ports can hold a stable reference
  private readonly customerStore = { customers: [] as Customer[] };
  private readonly employeeStore = { employees: [] as Employee[] };
  private sortedEmployeeSource: Employee[] | null = null;
  private sortedEmployees: Employee[] = [];
  private readonly customerMeetingStore = {
    customerMeetings: [] as CustomerMeeting[]
  };
  private readonly attachmentStore = { attachments: [] as Attachment[] };

  private nextNoteNumber = 1;
  private nextTaskNumber = 1;
  private nextMemberNumber = 1;
  private nextCommentNumber = 1;
  private nextActivityNumber = 1;
  private nextAgendaNumber = 1;
  private nextCustomerNumber = 1;
  private nextCustomerMeetingNumber = 1;
  private nextCustomerMeetingNoteNumber = 100;
  private nextAttachmentNumber = 1;

  // Ports — instantiated with shared state references and a save callback
  private readonly customerRepo: CustomerRepositoryPort = new InMemoryCustomerRepository(
    this.customerStore,
    () => this.saveToStorage(),
    () => `local-${this.nextCustomerNumber++}`,
    () => new Date().toISOString()
  );
  private readonly customerMeetingRepo: CustomerMeetingRepositoryPort =
    new InMemoryCustomerMeetingRepository(
      this.customerMeetingStore,
      () => this.saveToStorage(),
      () => `cmeet-${this.nextCustomerMeetingNumber++}`,
      () => new Date().toISOString()
    );
  private readonly attachments: AttachmentStoragePort = new InMemoryAttachmentStorage(
    this.attachmentStore,
    () => this.saveToStorage(),
    () => `att-${this.nextAttachmentNumber++}`,
    () => new Date().toISOString()
  );

  constructor() {
    this.startRealtimeSync();
    this.hostContext.selectedOrg$.subscribe(() => {
      this.scheduleInitialize();
    });
    this.auth.tokenChanged$.subscribe(() => {
      this.scheduleInitialize();
    });
  }

  private startRealtimeSync(): void {
    if (typeof window === 'undefined' || this.realtimeListenersAttached) {
      return;
    }

    this.realtimeListenersAttached = true;

    const refreshOnForeground = (): void => {
      this.requestRealtimeRefresh(true);
    };

    window.addEventListener('focus', refreshOnForeground);
    window.addEventListener('online', refreshOnForeground);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        refreshOnForeground();
      }
    });

    this.realtimeRefreshTimer = window.setInterval(() => {
      this.requestRealtimeRefresh(false);
    }, this.realtimeRefreshIntervalMs);
  }

  private requestRealtimeRefresh(force: boolean): void {
    if (!this.currentOrgGroupId) {
      return;
    }

    const now = Date.now();
    if (!force && now - this.lastRefreshStartedAt < this.minRefreshGapMs) {
      return;
    }

    if (this.bootstrapInFlight || this.refreshInFlight) {
      return;
    }

    // Never let a background poll / window-focus refresh overwrite optimistic
    // state while the user has unsaved (in-flight or queued) writes — doing so
    // is what made just-entered values briefly revert or disappear entirely.
    // The post-mutation refresh (scheduleBackendRefresh) re-pulls authoritative
    // data once every pending write settles.
    if (this.hasPendingWrites) {
      return;
    }

    void this.refreshFromBackend();
  }

  /**
   * True when the client holds optimistic changes the backend has not confirmed
   * yet: an HTTP mutation in flight, a queued mutation waiting on a parent's
   * server id, or a locally-created entity not yet promoted. While this is true
   * we must not apply a server snapshot, or we would clobber the user's edit.
   */
  private get hasPendingWrites(): boolean {
    return (
      this.pendingMutationCount > 0 ||
      this.pendingTaskMutations.size > 0 ||
      this.pendingMeetingMutations.size > 0 ||
      this.pendingMeetingNoteMutations.size > 0 ||
      this.pendingCustomerMutations.size > 0 ||
      this.pendingCustomerIds.size > 0
    );
  }

  private scheduleInitialize(): void {
    if (this.initScheduled) {
      return;
    }

    this.initScheduled = true;
    setTimeout(() => {
      this.initScheduled = false;
      void this.initialize();
    }, 50);
  }

  async initialize(): Promise<void> {
    const selectedOrg = this.normalizeOrgGroupId(this.hostContext.snapshot.selectedOrg);
    this.currentOrgGroupId = selectedOrg;
    const token = this.auth.getToken() ?? '';

    if (!token) {
      this.clearRuntimeState();
      this.lastBootstrapKey = null;
      return;
    }

    const bootstrapKey = token;
    if (this.lastBootstrapKey === bootstrapKey) {
      return;
    }

    if (this.bootstrapInFlight) {
      return this.bootstrapInFlight;
    }

    this.bootstrapInFlight = (async () => {
      try {
        const bootstrap = await this.actionosApi.bootstrap(selectedOrg);
        this.applyBootstrap(bootstrap);
        const directoryOrgId = selectedOrg || bootstrap.orgGroupId || bootstrap.allowedOrgs?.[0]?.orgGroupId || null;
        if (directoryOrgId) {
          await this.refreshDirectoryUsers(directoryOrgId);
        }
        this.clearBackendIssue();
        this.lastBootstrapKey = bootstrapKey;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[ActionOS] Failed to load ActionOS bootstrap data. Access is fail-closed.', error);
        this.clearRuntimeState();
        this.reportBackendIssue(this.bootstrapFailureMessage(error), error);
      } finally {
        this.bootstrapInFlight = null;
      }
    })();

    return this.bootstrapInFlight;
  }

  clearBackendIssue(): void {
    this.backendIssue.set(null);
  }

  get members(): Member[] {
    return this.membersState;
  }

  get allTasks(): Task[] {
    if (this.allTasksCache.revision !== this.dataRevision) {
      this.allTasksCache.revision = this.dataRevision;
      this.allTasksCache.value = this.tasksState.filter(task => !task.archivedAt);
    }
    return this.allTasksCache.value;
  }

  get tasks(): Task[] {
    return this.allTasks;
  }

  get archivedTasks(): Task[] {
    if (this.archivedTasksCache.revision !== this.dataRevision) {
      this.archivedTasksCache.revision = this.dataRevision;
      this.archivedTasksCache.value = this.tasksState.filter(task => !!task.archivedAt);
    }
    return this.archivedTasksCache.value;
  }

  get meeting(): Meeting {
    return this.meetingState;
  }

  get activity(): ActivityLog[] {
    return this.activityState.slice(0, 12);
  }

  get todayIso(): string {
    return this.toDateOnly(new Date());
  }

  get openTasks(): Task[] {
    if (this.openTasksCache.revision !== this.dataRevision) {
      this.openTasksCache.revision = this.dataRevision;
      this.openTasksCache.value = this.allTasks.filter(task => this.isTaskOpen(task.status));
    }
    return this.openTasksCache.value;
  }

  get myTasks(): Task[] {
    return this.openTasks.filter(task => task.assigneeIds.includes(this.currentUserId));
  }

  get watchedTasks(): Task[] {
    return this.openTasks.filter(task => task.watcherIds.includes(this.currentUserId));
  }

  get inboxTasks(): Task[] {
    return this.openTasks.filter(task => task.status === 'New');
  }

  get blockedTasks(): Task[] {
    return this.openTasks.filter(
      task =>
        !!task.blockedBy ||
        !!task.waitingReason ||
        task.status === 'Waiting For Customer' ||
        task.status === 'Waiting For Internal'
    );
  }

  get overdueTasks(): Task[] {
    return this.openTasks.filter(task => task.dueDate < this.todayIso);
  }

  get dueSoonTasks(): Task[] {
    const soon = this.addDays(this.todayIso, 7);

    return this.openTasks.filter(task => task.dueDate >= this.todayIso && task.dueDate <= soon);
  }

  get overdueMeetingTasks(): Task[] {
    return this.openMeetingTasks.filter(task => !!task.dueDate && task.dueDate < this.todayIso);
  }

  get blockedMeetingTasks(): Task[] {
    return this.openMeetingTasks.filter(
      task => task.status === 'Waiting For Customer' || task.status === 'Waiting For Internal'
    );
  }

  get openOperationalTaskCount(): number {
    return this.openTasks.length;
  }

  get overdueOperationalTaskCount(): number {
    return this.overdueTasks.length;
  }

  get blockedOperationalTaskCount(): number {
    return this.blockedTasks.length;
  }

  get topThreeToday(): Task[] {
    return this.myTasks
      .filter(task => task.dueDate <= this.addDays(this.todayIso, 1))
      .slice()
      .sort((left, right) => this.priorityScore(right.priority) - this.priorityScore(left.priority))
      .slice(0, 3);
  }

  get triageQueue(): Task[] {
    const riskyTasks = this.openTasks.filter(
      task => task.status === 'New' || !task.assignedToEmployeeId || task.dueDate < this.todayIso
    );

    return this.uniqueTasks(riskyTasks).slice(0, 12);
  }

  get myTriageQueue(): Task[] {
    const uid = this.currentUserId;
    const riskyTasks = this.openTasks.filter(task =>
      task.assigneeIds.includes(uid) &&
      ((task.status === 'Inbox' || task.status === 'New' || task.status === 'Sent To Owner') || (!!task.dueDate && task.dueDate < this.todayIso))
    );
    return this.uniqueTasks(riskyTasks).slice(0, 12);
  }

  get myInboxTasks(): Task[] {
    const uid = this.currentUserId;
    return this.openTasks.filter(task =>
      (task.status === 'Inbox' || task.status === 'New' || task.status === 'Sent To Owner')
      && task.assigneeIds.includes(uid)
    );
  }

  get myBlockedTasks(): Task[] {
    const uid = this.currentUserId;
    return this.openTasks.filter(task =>
      task.assigneeIds.includes(uid)
      && (!!task.blockedBy || task.status === 'Waiting' || task.status === 'Waiting For Customer' || task.status === 'Waiting For Internal')
    );
  }

  get openMeetingActions(): MeetingNote[] {
    const legacy = this.legacyOpenMeetingActions;
    const customerActions = this.customerMeetings.flatMap(meeting =>
      meeting.notes.filter(note => note.type === 'action' && !note.convertedTaskId)
    );
    return [...legacy, ...customerActions];
  }

  /** Unconverted action notes from meetings the current user was part of (leader or participant). */
  get myUnconvertedActionItems(): Array<{ note: MeetingNote; meeting: CustomerMeeting }> {
    if (
      this.myUnconvertedActionItemsCache.revision === this.dataRevision &&
      this.myUnconvertedActionItemsCache.currentEmployeeId === this.currentEmployeeId
    ) {
      return this.myUnconvertedActionItemsCache.value;
    }

    const empId = this.currentEmployeeId;
    const value = this.customerMeetings
      .filter(m =>
        m.meetingLeaderEmployeeId === empId ||
        m.internalParticipantEmployeeIds.includes(empId)
      )
      .flatMap(meeting =>
        meeting.notes
          .filter(note => note.type === 'action' && !note.convertedTaskId)
          .map(note => ({ note, meeting }))
      );

    this.myUnconvertedActionItemsCache.revision = this.dataRevision;
    this.myUnconvertedActionItemsCache.currentEmployeeId = this.currentEmployeeId;
    this.myUnconvertedActionItemsCache.value = value;
    return value;
  }

  // ── Inbox feed assembly ─────────────────────────────────────────────────
  /**
   * The unified Inbox stream: every "thing that needs me", newest first.
   * Assembled from live data (no notification table), then dismissed items are
   * filtered out. Read/unread is layered on top via `isInboxUnread`.
   *
   * Sources:
   *  1. New tasks assigned to me OR opened by me (status New / Inbox / Sent To Owner)
   *  2. Unconverted action items from meetings I attended
   *  3. Decisions and notes from meetings I attended
   *  4. My blocked / waiting tasks
   *  5. My tasks due today or overdue (that aren't already in 1 or 4)
   */
  get inboxFeed(): InboxFeedItem[] {
    const uid = this.currentUserId;
    const empId = this.currentEmployeeId;
    const today = this.todayIso;
    const dismissedIds = this.inboxStateSig().dismissed;
    const dismissedKey = dismissedIds.join('|');
    const language = this.i18n.language;
    if (
      this.inboxFeedCache.revision === this.dataRevision &&
      this.inboxFeedCache.currentEmployeeId === empId &&
      this.inboxFeedCache.currentUserId === uid &&
      this.inboxFeedCache.dismissedKey === dismissedKey &&
      this.inboxFeedCache.language === language &&
      this.inboxFeedCache.today === today
    ) {
      return this.inboxFeedCache.value;
    }

    const dismissed = new Set(dismissedIds);
    const fallbackTs = `${today}T00:00:00`;
    const newStatuses: TaskStatus[] = ['Inbox', 'New', 'Sent To Owner'];
    const items: InboxFeedItem[] = [];

    const mineTask = (task: Task): boolean =>
      task.assigneeIds.includes(uid) || task.assignedToEmployeeId === empId;
    const openedByMe = (task: Task): boolean =>
      task.createdByUserId === uid || task.openedByEmployeeId === empId;

    // 1. New tasks assigned to me, or that I opened, still in a "new" status.
    for (const task of this.openTasks) {
      if (!newStatuses.includes(task.status)) {
        continue;
      }
      const assigned = mineTask(task);
      if (!assigned && !openedByMe(task)) {
        continue;
      }
      // Show "assigned to you by <name>" only when someone *else* assigned it.
      const assignerName = assigned && !openedByMe(task) ? this.inboxAssignerName(task) : '';
      const useAssignedBy = !!assignerName;
      items.push({
        id: `task-new:${task.id}`,
        kind: assigned ? 'task-assigned' : 'task-opened',
        category: 'tasks',
        tone: 'info',
        glyph: '🟦',
        titleKey: !assigned
          ? 'inbox.feed.taskOpened'
          : useAssignedBy
            ? 'inbox.feed.taskAssignedBy'
            : 'inbox.feed.taskAssigned',
        titleParams: useAssignedBy ? { by: assignerName } : undefined,
        primaryText: task.title,
        contextText: this.inboxTaskContext(task),
        timestamp: task.updatedAt || task.createdAt || fallbackTs,
        taskId: task.id,
        actions: [
          { id: 'open-task', labelKey: 'inbox.act.open', variant: 'ghost' },
          { id: 'done', labelKey: 'inbox.act.done', variant: 'primary' }
        ]
      });
    }

    // 2. Unconverted action items from meetings I attended.
    for (const { note, meeting } of this.myUnconvertedActionItems) {
      items.push({
        id: `mtg-action:${meeting.id}:${note.id}`,
        kind: 'meeting-action',
        category: 'meetings',
        tone: 'success',
        glyph: '🟩',
        titleKey: 'inbox.feed.meetingAction',
        primaryText: note.content,
        contextText: this.inboxMeetingContext(meeting, note),
        groupLabel: this.inboxMeetingContext(meeting),
        timestamp: note.createdAt || meeting.meetingDate || fallbackTs,
        meetingId: meeting.id,
        noteId: note.id,
        actions: [
          { id: 'make-task', labelKey: 'inbox.act.makeTask', variant: 'primary' },
          { id: 'view-meeting', labelKey: 'inbox.act.viewMeeting', variant: 'ghost' }
        ]
      });
    }

    // 3. Decisions and notes from meetings I attended.
    const myMeetings = this.customerMeetings.filter(
      m => m.meetingLeaderEmployeeId === empId || m.internalParticipantEmployeeIds.includes(empId)
    );
    for (const meeting of myMeetings) {
      for (const note of meeting.notes) {
        if (note.type !== 'decision' && note.type !== 'note') {
          continue;
        }
        const isDecision = note.type === 'decision';
        items.push({
          id: `mtg-${note.type}:${meeting.id}:${note.id}`,
          kind: isDecision ? 'meeting-decision' : 'meeting-note',
          category: 'meetings',
          tone: isDecision ? 'info' : 'neutral',
          glyph: isDecision ? '✅' : '📝',
          titleKey: isDecision ? 'inbox.feed.meetingDecision' : 'inbox.feed.meetingNote',
          primaryText: note.content,
          contextText: this.inboxMeetingContext(meeting),
          groupLabel: this.inboxMeetingContext(meeting),
          timestamp: note.createdAt || meeting.meetingDate || fallbackTs,
          meetingId: meeting.id,
          noteId: note.id,
          actions: [{ id: 'view-meeting', labelKey: 'inbox.act.viewMeeting', variant: 'ghost' }]
        });
      }
    }

    // 4. My blocked / waiting tasks.
    const blockedIds = new Set<string>();
    for (const task of this.myBlockedTasks) {
      blockedIds.add(task.id);
      items.push({
        id: `task-wait:${task.id}`,
        kind: 'task-waiting',
        category: 'waiting',
        tone: 'warning',
        glyph: '⏳',
        titleKey: 'inbox.feed.taskWaiting',
        primaryText: task.title,
        contextText: task.waitingReason || task.blockedBy || this.inboxTaskContext(task),
        timestamp: task.updatedAt || task.createdAt || fallbackTs,
        taskId: task.id,
        actions: [{ id: 'open-task', labelKey: 'inbox.act.open', variant: 'ghost' }]
      });
    }

    // 5. My tasks due today / overdue, that aren't already surfaced in 1 or 4.
    for (const task of this.openTasks) {
      if (!mineTask(task) || !task.dueDate || task.dueDate > today) {
        continue;
      }
      if (newStatuses.includes(task.status) || blockedIds.has(task.id)) {
        continue;
      }
      const overdue = task.dueDate < today;
      items.push({
        id: `task-due:${task.id}`,
        kind: 'task-due',
        category: 'tasks',
        tone: overdue ? 'danger' : 'warning',
        glyph: overdue ? '🔴' : '🟠',
        titleKey: overdue ? 'inbox.feed.taskOverdue' : 'inbox.feed.taskDueToday',
        primaryText: task.title,
        contextText: this.inboxTaskContext(task),
        timestamp: `${task.dueDate.slice(0, 10)}T09:00:00`,
        taskId: task.id,
        actions: [
          { id: 'open-task', labelKey: 'inbox.act.open', variant: 'ghost' },
          { id: 'done', labelKey: 'inbox.act.done', variant: 'primary' }
        ]
      });
    }

    const value = items
      .filter(item => !dismissed.has(item.id))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    this.inboxFeedCache.revision = this.dataRevision;
    this.inboxFeedCache.currentEmployeeId = empId;
    this.inboxFeedCache.currentUserId = uid;
    this.inboxFeedCache.dismissedKey = dismissedKey;
    this.inboxFeedCache.language = language;
    this.inboxFeedCache.today = today;
    this.inboxFeedCache.value = value;
    return value;
  }

  /**
   * Name of whoever opened/assigned a task — for the "assigned by …" headline.
   * Returns '' when no real name is known, so the caller falls back to the
   * plain "assigned to you" headline rather than showing a placeholder.
   */
  private inboxAssignerName(task: Task): string {
    const byEmployee = task.openedByEmployeeId ? this.employeeName(task.openedByEmployeeId) : '';
    if (byEmployee && byEmployee !== '—') {
      return byEmployee;
    }
    const byMember = task.createdByUserId ? this.memberName(task.createdByUserId) : '';
    if (byMember && byMember !== 'Unknown') {
      return byMember;
    }
    return '';
  }

  /** Secondary line for a task feed item: "Board · High · due 2026-06-05". */
  private inboxTaskContext(task: Task): string {
    const parts: string[] = [];
    const place = task.customerId ? this.clientName(task.customerId) : task.board;
    if (place) {
      parts.push(place);
    }
    if (task.priority) {
      parts.push(this.i18n.translate('priority.' + this.statusClass(task.priority)));
    }
    if (task.dueDate) {
      parts.push(`${this.i18n.translate('common.due')} ${task.dueDate.slice(0, 10)}`);
    }
    return parts.join(' · ');
  }

  /** Secondary line for a meeting feed item: "Acme · Quarterly review". */
  private inboxMeetingContext(meeting: CustomerMeeting, note?: MeetingNote): string {
    const parts: string[] = [];
    const customerName = this.clientName(meeting.customerId);
    if (customerName) {
      parts.push(customerName);
    }
    if (meeting.subject) {
      parts.push(meeting.subject);
    }
    if (note?.dueDate) {
      parts.push(`${this.i18n.translate('common.due')} ${note.dueDate.slice(0, 10)}`);
    }
    return parts.join(' · ');
  }

  /** Convert a CustomerMeeting action note into a MeetingTask. The note is marked as converted. */
  convertMeetingAction(meetingId: string, noteId: string): boolean {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    const resolvedNoteId = this.resolveMeetingNoteId(noteId);
    const meeting = this.customerMeetingRepo.get(resolvedMeetingId);
    if (!meeting) return false;
    const note = meeting.notes.find(n => n.id === resolvedNoteId);
    if (!note || note.type !== 'action' || note.convertedTaskId) return false;

    const assignee = note.createdByEmployeeId && this.isAssignable(note.createdByEmployeeId)
      ? note.createdByEmployeeId
      : this.currentEmployeeId;

    const task = this.createTaskFromMeeting(
      resolvedMeetingId,
      {
        title: note.content,
        assignedToEmployeeId: assignee,
        priority: 'Medium',
        dueDate: note.dueDate ?? this.addDays(this.todayIso, 3),
        sourceMeetingId: resolvedMeetingId
      },
      resolvedNoteId
    );
    return !!task;
  }

  get meetingDecisions(): MeetingNote[] {
    return this.meetingState.notes.filter(note => note.type === 'decision');
  }

  get completedAgendaCount(): number {
    return this.meetingState.agenda.filter(item => item.completed).length;
  }

  get recentlyConvertedTasks(): Task[] {
    return this.tasks.filter(task => !!task.sourceMeetingId).slice(0, 5);
  }

  get selectedTask(): Task | undefined {
    const draft = this.quickCaptureTaskDraft;
    if (draft?.id === this.selectedTaskId) {
      return draft;
    }
    const resolvedTaskId = this.resolveTaskId(this.selectedTaskId);
    return this.tasksState.find(task => task.id === resolvedTaskId && !task.archivedAt);
  }

  get unconvertedActionCount(): number {
    return this.openMeetingActions.length;
  }

  get teamWorkload(): TeamWorkload[] {
    if (this.teamWorkloadCache.revision === this.dataRevision) {
      return this.teamWorkloadCache.value;
    }

    const workloads = this.membersState.map(member => ({
      member,
      openCount: 0,
      blockedCount: 0,
      meetingOpenCount: 0,
      meetingBlockedCount: 0
    }));
    const byMemberId = new Map(workloads.map(workload => [workload.member.id, workload]));
    const memberIdByEmployeeId = new Map<string, string>();

    for (const member of this.membersState) {
      const employeeId = this.employeeIdForMember(member);
      if (employeeId) {
        memberIdByEmployeeId.set(employeeId, member.id);
      }
    }

    for (const task of this.openTasks) {
      if (task.source === 'meeting') {
        continue;
      }
      for (const memberId of task.assigneeIds) {
        const workload = byMemberId.get(memberId);
        if (!workload) {
          continue;
        }
        workload.openCount += 1;
        if (!!task.blockedBy || task.status === 'Waiting') {
          workload.blockedCount += 1;
        }
      }
    }

    for (const task of this.openMeetingTasks) {
      const memberId = memberIdByEmployeeId.get(task.assignedToEmployeeId);
      const workload = memberId ? byMemberId.get(memberId) : undefined;
      if (!workload) {
        continue;
      }
      workload.meetingOpenCount += 1;
      if (task.status === 'Waiting For Customer' || task.status === 'Waiting For Internal') {
        workload.meetingBlockedCount += 1;
      }
    }

    this.teamWorkloadCache.revision = this.dataRevision;
    this.teamWorkloadCache.value = workloads;
    return workloads;
  }

  tasksByStatus(status: TaskStatus): Task[] {
    const normalizedStatus = this.toUnifiedStatus(status);
    return this.tasks.filter(task => task.status === normalizedStatus);
  }

  myWorkTasks(tab: MyWorkTab): Task[] {
    if (tab === 'today') {
      return this.myTasks.filter(task => task.dueDate <= this.todayIso);
    }

    if (tab === 'upcoming') {
      return this.myTasks.filter(task => task.dueDate > this.todayIso);
    }

    if (tab === 'watched') {
      return this.watchedTasks;
    }

    return this.blockedTasks.filter(
      task => task.assigneeIds.includes(this.currentUserId) || task.watcherIds.includes(this.currentUserId)
    );
  }

  selectTask(task: Task, openDrawer = true): void {
    this.selectedTaskId = task.id;
    this.selectedTaskKind = 'meeting-task';
    this.drawerOpen = openDrawer;
    if (this.quickCaptureTaskDraft?.id !== task.id) {
      this.saveToStorage();
    }
  }

  openTaskDrawer(task?: Task): void {
    if (task) {
      this.selectedTaskId = task.id;
      this.selectedTaskKind = 'meeting-task';
    }

    this.drawerOpen = !!this.selectedTask;
  }

  /**
   * Open the task drawer on a fresh, unsaved task draft — the Tasks page
   * "New task" button. Mirrors the footer quick-capture flow: the draft lives
   * only in memory (quickCaptureTaskDraft) until the user explicitly saves it.
   */
  openNewTaskDraft(): void {
    this.quickCaptureTaskDraft = this.createQuickCaptureTaskDraft('');
    this.selectTask(this.quickCaptureTaskDraft, true);
  }

  /**
   * Create a task due on the given day (tasks have no time-of-day) and open it
   * in the task drawer for editing — used when a calendar time box is clicked.
   */
  startNewTaskAt(date: Date, title: string): Task {
    const task = this.addTask({
      title,
      description: '',
      board: 'Fritz Meetings',
      source: 'board',
      priority: 'Medium',
      dueDate: this.toLocalIsoDate(date),
      assigneeId: this.currentUserId,
    });
    this.selectTask(task, true);
    return task;
  }

  /** Local YYYY-MM-DD for a Date (avoids the UTC shift of toISOString). */
  private toLocalIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  closeTaskDrawer(): void {
    if (this.quickCaptureTaskDraft?.id === this.selectedTaskId) {
      this.quickCaptureTaskDraft = null;
      this.selectedTaskId = '';
      this.selectedTaskKind = 'meeting-task';
    }
    this.drawerOpen = false;
  }

  /**
   * Create (and return) a fresh in-memory draft for the embedded Tasks-page
   * form. Independent of the drawer: it does NOT touch selectedTaskId/drawerOpen.
   * The caller binds to it by id via `Task(id)` so the form always reads the
   * live draft object.
   */
  newEmbeddedTaskDraft(): Task {
    this.embeddedTaskDraft = this.createQuickCaptureTaskDraft('');
    return this.embeddedTaskDraft;
  }

  /** Discard the embedded draft (used when the page form is reset/closed). */
  clearEmbeddedTaskDraft(): void {
    this.embeddedTaskDraft = null;
  }

  updateStatus(task: Task, status: TaskStatus): void {
    this.updateTask(task.id, { status });
  }

  updateTask(taskId: string, changes: UpdateTaskInput): void {
    const resolvedTaskId = this.resolveTaskId(taskId);
    const task = this.tasksState.find(item => item.id === resolvedTaskId);

    if (!task) {
      return;
    }

    const nextStatus = changes.status ? this.toUnifiedStatus(changes.status) : undefined;
    const nextCustomerId = changes.customerId !== undefined ? this.resolveCustomerId(changes.customerId).trim() : undefined;
    const nextCustomerName = nextCustomerId ? this.clientName(nextCustomerId) : undefined;
    const nextAssigneeIds = changes.assigneeIds ? [...changes.assigneeIds] : task.assigneeIds;
    const nextAssignedToEmployeeId = changes.assigneeIds
      ? (nextAssigneeIds[0] ? this.employeeIdForMember(nextAssigneeIds[0]) ?? '' : '')
      : task.assignedToEmployeeId;
    const nextWatcherIds = changes.watcherIds ? [...changes.watcherIds] : task.watcherIds;
    const nextWatcherEmployeeIds = changes.watcherIds
      ? Array.from(new Set(
          nextWatcherIds
            .map(memberId => this.employeeIdForMember(memberId))
            .filter((id): id is string => !!id)
        ))
      : task.watcherEmployeeIds;
    const nextBlockedBy = changes.blockedBy !== undefined
      ? changes.blockedBy.trim() || undefined
      : task.blockedBy;
    const waitingStatus = nextStatus === 'Waiting For Customer' || nextStatus === 'Waiting For Internal';
    const nextWaitingReason = waitingStatus
      ? (nextBlockedBy || task.waitingReason || 'Waiting for next input')
      : (nextStatus ? undefined : task.waitingReason);
    const nextCompletedAt = nextStatus === 'Done'
      ? (task.completedAt || new Date().toISOString())
      : (nextStatus ? undefined : task.completedAt);

    this.tasksState = this.tasksState.map(item => {
      if (item.id !== resolvedTaskId) {
        return item;
      }

      return {
        ...item,
        ...changes,
        source: item.source,
        status: nextStatus ?? item.status,
        title: changes.title?.trim() || item.title,
        board: changes.board?.trim() || nextCustomerName || item.board,
        customerId: nextCustomerId !== undefined ? nextCustomerId : item.customerId,
        description: changes.description ?? item.description,
        assigneeIds: nextAssigneeIds,
        assignedToEmployeeId: nextAssignedToEmployeeId,
        watcherIds: nextWatcherIds,
        watcherEmployeeIds: nextWatcherEmployeeIds,
        sourceMeetingId: changes.sourceMeetingId !== undefined ? changes.sourceMeetingId.trim() : item.sourceMeetingId,
        blockedBy: nextBlockedBy,
        waitingReason: nextWaitingReason,
        completedAt: nextCompletedAt,
        updatedAt: new Date().toISOString()
      };
    });
    this.selectedTaskId = resolvedTaskId;
    this.selectedTaskKind = 'meeting-task';
    this.recordActivity('task', resolvedTaskId, 'Task updated', task.title);
    this.saveToStorage();

    this.runTaskMutation(resolvedTaskId, (taskIdNumeric) =>
      this.actionosApi.updateTask(taskIdNumeric, {
        title: changes.title !== undefined ? changes.title : undefined,
        description: changes.description !== undefined ? changes.description : undefined,
        customerId: changes.customerId !== undefined ? (nextCustomerId || null) : undefined,
        status: changes.status !== undefined ? nextStatus : undefined,
        statusChangeReason: changes.status !== undefined && nextStatus && nextStatus !== task.status
          ? 'Updated in ActionOS UI'
          : undefined,
        priority: changes.priority !== undefined ? changes.priority : undefined,
        waitingReason: changes.blockedBy !== undefined || changes.status !== undefined ? nextWaitingReason : undefined,
        treatmentNotes: undefined,
        assignedUserId: changes.assigneeIds !== undefined ? (nextAssignedToEmployeeId || null) : undefined,
        dueDateUtc: changes.dueDate !== undefined
          ? (changes.dueDate ? new Date(`${changes.dueDate}T12:00:00.000Z`).toISOString() : null)
          : undefined
      })
    );
  }

  addTask(input: CreateTaskInput): Task {
    const assigneeId = input.assigneeId || this.currentUserId;
    const assignedToEmployeeId =
      input.assignedToEmployeeId ||
      this.employeeIdForMember(assigneeId) ||
      this.employee(assigneeId)?.id ||
      this.currentEmployeeId;
    const resolvedAssigneeMemberId = this.memberIdForEmployee(assignedToEmployeeId) || assigneeId;
    const openedByEmployeeId = input.openedByEmployeeId || this.currentEmployeeId;
    const customerId = input.customerId ? this.resolveCustomerId(input.customerId).trim() : '';
    const customerName = customerId ? this.clientName(customerId) : undefined;
    const source: Task['source'] = input.source ?? (input.sourceMeetingId ? 'meeting' : 'board');
    const now = new Date().toISOString();
    const task: Task = {
      id: `task-${this.nextTaskNumber++}`,
      title: input.title.trim(),
      description: input.description?.trim() || '',
      source,
      board: input.board?.trim() || customerName || 'Fritz Meetings',
      customerId,
      status: input.status ?? 'New',
      priority: input.priority,
      dueDate: input.dueDate || this.todayIso,
      assigneeIds: [resolvedAssigneeMemberId],
      sourceMeetingId: input.sourceMeetingId ?? '',
      openedByEmployeeId,
      assignedToEmployeeId,
      watcherIds: input.watcherIds?.length ? input.watcherIds : [this.currentUserId],
      watcherEmployeeIds: input.watcherEmployeeIds?.length
        ? input.watcherEmployeeIds
        : Array.from(
            new Set([openedByEmployeeId, assignedToEmployeeId].filter((id): id is string => !!id))
          ),
      attachmentIds: [],
      notifications: [],
      treatmentNotes: input.treatmentNotes ?? '',
      waitingReason: input.waitingReason,
      completedAt: input.completedAt,
      createdByUserId: this.currentUserId,
      createdAt: now,
      updatedAt: now,
      checklist: input.checklist?.map(item => ({ ...item })) ?? []
    };

    this.tasksState = [task, ...this.tasksState];
    this.selectedTaskId = task.id;
    this.selectedTaskKind = 'meeting-task';
    this.recordActivity('task', task.id, 'Task created', task.title);
    this.saveToStorage();

    const localTaskId = task.id;
    const orgGroupId = this.getOrgGroupForMutation();
    const resolvedSourceMeetingId = task.sourceMeetingId ? this.resolveMeetingId(task.sourceMeetingId) : '';
    if (orgGroupId) {
      const createTaskRequest = {
        orgGroupId,
        boardId: null,
        customerId: task.customerId || null,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        sourceType: task.source,
        waitingReason: task.waitingReason ?? null,
        treatmentNotes: task.treatmentNotes ?? null,
        assignedUserId: task.assignedToEmployeeId || null,
        dueDateUtc: task.dueDate ? new Date(`${task.dueDate}T12:00:00.000Z`).toISOString() : null,
        checklistItems: task.checklist.map((item, index) => ({
          label: item.label,
          isDone: item.done,
          sortOrder: index
        }))
      };
      const createAndPromote = (sourceMeetingId: number | null) =>
        this.actionosApi.createTask({
          ...createTaskRequest,
          sourceMeetingId
        }).then((created) => {
          this.promoteTaskId(localTaskId, created.id.toString());
          return created;
        }).catch((error) => {
          this.abandonLocalTask(localTaskId);
          throw error;
        });

      const sourceMeetingNumeric = this.parseNumericId(resolvedSourceMeetingId);
      if (resolvedSourceMeetingId && sourceMeetingNumeric == null) {
        this.runMeetingMutation(resolvedSourceMeetingId, (meetingIdNumeric) =>
          createAndPromote(meetingIdNumeric)
        );
      } else {
        this.persistAndRefresh(createAndPromote(sourceMeetingNumeric));
      }
    }

    return task;
  }

  quickCapture(kind: QuickCaptureType, content: string): Task | MeetingNote | null {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return null;
    }

    if (kind === 'task') {
      this.quickCaptureTaskDraft = this.createQuickCaptureTaskDraft(trimmedContent);
      return this.quickCaptureTaskDraft;
    }

    return this.addMeetingNote({
      type: kind,
      content: trimmedContent,
      ownerId: kind === 'action' || kind === 'blocker' ? this.currentUserId : undefined,
      dueDate: kind === 'action' ? this.addDays(this.todayIso, 2) : undefined
    });
  }

  private createQuickCaptureTaskDraft(title: string): Task {
    const assigneeId = this.currentUserId;
    const assignedToEmployeeId =
      this.employeeIdForMember(assigneeId) ||
      this.employee(assigneeId)?.id ||
      this.currentEmployeeId;
    const resolvedAssigneeMemberId = this.memberIdForEmployee(assignedToEmployeeId) || assigneeId;
    const openedByEmployeeId = this.currentEmployeeId;
    const now = new Date().toISOString();

    return {
      id: `draft-task-${++this.quickCaptureDraftNumber}`,
      title,
      description: '',
      source: 'board',
      board: 'Fritz Meetings',
      customerId: '',
      status: 'New',
      priority: 'Medium',
      dueDate: this.addDays(this.todayIso, 2),
      assigneeIds: [resolvedAssigneeMemberId],
      sourceMeetingId: '',
      openedByEmployeeId,
      assignedToEmployeeId,
      watcherIds: [this.currentUserId],
      watcherEmployeeIds: Array.from(
        new Set([openedByEmployeeId, assignedToEmployeeId].filter((id): id is string => !!id))
      ),
      attachmentIds: [],
      notifications: [],
      treatmentNotes: '',
      createdByUserId: this.currentUserId,
      createdAt: now,
      updatedAt: now,
      checklist: []
    };
  }

  archiveTask(task: Task): void {
    const resolvedTaskId = this.resolveTaskId(task.id);
    this.tasksState = this.tasksState.map(item => item.id === resolvedTaskId ? { ...item, archivedAt: new Date().toISOString() } : item);
    this.recordActivity('task', resolvedTaskId, 'Task archived', task.title);
    if (this.selectedTaskId === resolvedTaskId) {
      this.selectedTaskId = this.tasks[0]?.id ?? '';
      this.drawerOpen = false;
    }
    this.saveToStorage();

    this.runTaskMutation(resolvedTaskId, (taskIdNumeric) =>
      this.actionosApi.deleteTask(taskIdNumeric)
    );
  }

  applyTemplate(templateId: string): void {
    const template = this.templates.find(item => item.id === templateId);

    if (!template) {
      return;
    }

    template.tasks
      .slice()
      .reverse()
      .forEach(task => this.addTask({ ...task, assigneeId: this.currentUserId }));
    this.recordActivity('template', template.id, 'Template applied', template.name);
    this.saveToStorage();
  }

  convertAllOpenActions(): number {
    const actions = this.legacyOpenMeetingActions.slice();
    let convertedCount = 0;

    actions.forEach(note => {
      if (this.convertAction(note)) {
        convertedCount++;
      }
    });

    if (convertedCount) {
      this.recordActivity('meeting', this.meetingState.id, 'Meeting actions cleared', `${convertedCount} action(s) converted to tasks.`);
      this.saveToStorage();
    }

    return convertedCount;
  }

  convertAction(note: MeetingNote, overrides?: Partial<CreateTaskInput>): Task | null {
    if (note.type !== 'action' || note.convertedTaskId) {
      return null;
    }

    const task = this.addTask({
      title: overrides?.title || note.content,
      description: `Created from meeting: ${this.meetingState.title}`,
      board: overrides?.board || this.meetingState.linkedBoard,
      source: 'meeting',
      sourceMeetingId: this.meetingState.id,
      priority: overrides?.priority || 'High',
      dueDate: overrides?.dueDate || note.dueDate || this.addDays(this.todayIso, 3),
      assigneeId: overrides?.assigneeId || note.ownerId || this.currentUserId
    });

    note.convertedTaskId = task.id;
    this.recordActivity('meeting', this.meetingState.id, 'Meeting action converted', note.content);
    this.saveToStorage();

    return task;
  }

  addMeetingNote(input: CreateMeetingNoteInput): MeetingNote {
    const note: MeetingNote = {
      id: `note-${this.nextNoteNumber++}`,
      type: input.type,
      content: input.content.trim(),
      ownerId: input.ownerId || undefined,
      dueDate: input.dueDate || undefined
    };

    this.meetingState.notes = [note, ...this.meetingState.notes];
    this.recordActivity('meeting', this.meetingState.id, 'Meeting note added', note.content);
    this.saveToStorage();

    return note;
  }

  meetingNotesByType(type: NoteType | 'all'): MeetingNote[] {
    if (type === 'all') {
      return this.meetingState.notes;
    }

    return this.meetingState.notes.filter(note => note.type === type);
  }

  addAgendaItem(title: string): AgendaItem | null {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return null;
    }

    const agendaItem: AgendaItem = {
      id: `agenda-${this.nextAgendaNumber++}`,
      title: trimmedTitle,
      completed: false
    };

    this.meetingState.agenda = [...this.meetingState.agenda, agendaItem];
    this.recordActivity('agenda', agendaItem.id, 'Agenda item added', agendaItem.title);
    this.saveToStorage();

    return agendaItem;
  }

  toggleAgendaItem(agendaItem: AgendaItem, completed: boolean): void {
    this.meetingState.agenda = this.meetingState.agenda.map(item => item.id === agendaItem.id ? { ...item, completed } : item);
    this.recordActivity('agenda', agendaItem.id, completed ? 'Agenda completed' : 'Agenda reopened', agendaItem.title);
    this.saveToStorage();
  }

  addMember(input: CreateMemberInput): Member {
    const member: Member = {
      id: `u${this.nextMemberNumber++}`,
      name: input.name.trim(),
      role: input.role.trim() || 'Member',
      team: input.team.trim() || 'General',
      availability: 'Available'
    };

    this.membersState = [member, ...this.membersState];
    this.recordActivity('member', member.id, 'Member invited', member.name);
    this.saveToStorage();

    return member;
  }

  updateChecklistItem(task: Task, checklistItem: ChecklistItem, done: boolean): void {
    const resolvedTaskId = this.resolveTaskId(task.id);
    this.tasksState = this.tasksState.map(item => {
      if (item.id !== resolvedTaskId) {
        return item;
      }

      return {
        ...item,
        checklist: item.checklist.map(entry => entry.label === checklistItem.label ? { ...entry, done } : entry),
        updatedAt: new Date().toISOString()
      };
    });
    this.recordActivity('task', resolvedTaskId, done ? 'Checklist item completed' : 'Checklist item reopened', checklistItem.label);
    this.saveToStorage();

    const resolvedTask = this.Task(resolvedTaskId) ?? task;
    const checklistId = this.resolveChecklistItemId(resolvedTask, checklistItem);
    if (checklistId != null) {
      this.runTaskMutation(resolvedTaskId, (taskIdNumeric) =>
        this.actionosApi.updateTaskChecklistItem(taskIdNumeric, checklistId, {
          label: null,
          isDone: done,
          sortOrder: null
        })
      );
    }
  }

  addChecklistItem(task: Task, label: string): void {
    const resolvedTaskId = this.resolveTaskId(task.id);
    const trimmedLabel = label.trim();

    if (!trimmedLabel) {
      return;
    }

    this.tasksState = this.tasksState.map(item => {
      if (item.id !== resolvedTaskId) {
        return item;
      }

      return {
        ...item,
        checklist: [...item.checklist, { label: trimmedLabel, done: false }],
        updatedAt: new Date().toISOString()
      };
    });
    this.recordActivity('task', resolvedTaskId, 'Checklist item added', trimmedLabel);
    this.saveToStorage();

    this.runTaskMutation(resolvedTaskId, (taskIdNumeric) =>
      this.actionosApi.addTaskChecklistItem(taskIdNumeric, trimmedLabel, false)
    );
  }

  promoteTask(task: Task, status: TaskStatus): void {
    this.updateTask(task.id, { status });
  }

  commentsForTask(taskId: string): Comment[] {
    const resolvedTaskId = this.resolveTaskId(taskId);
    return this.commentsState.filter(comment => comment.targetType === 'task' && comment.targetId === resolvedTaskId);
  }

  addTaskComment(task: Task, body: string): void {
    const resolvedTaskId = this.resolveTaskId(task.id);
    const trimmedBody = body.trim();

    if (!trimmedBody) {
      return;
    }

    const comment: Comment = {
      id: `comment-${this.nextCommentNumber++}`,
      targetType: 'task',
      targetId: resolvedTaskId,
      body: trimmedBody,
      createdByUserId: this.currentUserId,
      createdAt: new Date().toISOString()
    };

    this.commentsState = [comment, ...this.commentsState];
    this.recordActivity('task', resolvedTaskId, 'Comment added', task.title);
    this.saveToStorage();

    this.runTaskMutation(resolvedTaskId, (taskIdNumeric) =>
      this.actionosApi.addTaskNote(taskIdNumeric, trimmedBody)
    );
  }

  /**
   * Clears all user-data arrays (customers, meetings, tasks, notes, comments,
   * activity, attachments) but keeps reference data (employees, members)
   * so development/testing can start from a clean runtime state.
   */
  clearAllData(): void {
    this.selectedTaskId = '';
    this.drawerOpen = false;
    this.selectedTaskKind = 'meeting-task';
    this.tasksState = [];
    this.commentsState = [];
    this.activityState = [];
    this.meetingState = {
      ...this.meetingState,
      agenda: [],
      notes: []
    };
    this.customerStore.customers = [];
    this.customerMeetingStore.customerMeetings = [];
    this.attachmentStore.attachments = [];
    this.meetingIdAliases.clear();
    this.meetingNoteIdAliases.clear();
    this.pendingMeetingMutations.clear();
    this.pendingMeetingNoteMutations.clear();
    this.taskIdAliases.clear();
    this.pendingTaskMutations.clear();
    this.customerIdAliases.clear();
    this.pendingCustomerIds.clear();
    this.pendingCustomerMutations.clear();
    this.saveToStorage();
  }

  resetDemoData(): void {
    this.lastBootstrapKey = null;
    void this.initialize();
  }

  memberName(memberId: string): string {
    return this.memberById().get(memberId)?.name ?? 'Unknown';
  }

  initials(memberId: string): string {
    const name = this.memberName(memberId);
    return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  }

  private memberById(): Map<string, Member> {
    if (this.memberByIdCache.revision !== this.dataRevision) {
      this.memberByIdCache.revision = this.dataRevision;
      this.memberByIdCache.value = new Map(this.membersState.map(member => [member.id, member]));
    }
    return this.memberByIdCache.value;
  }

  employeeIdForMember(memberOrId: Member | string): string | undefined {
    const members = this.membersState;
    const employees = this.employeeStore.employees;
    const member = typeof memberOrId === 'string'
      ? this.memberById().get(memberOrId)
      : memberOrId;
    if (!member) {
      return undefined;
    }
    const normalized = member.name.trim().toLowerCase();
    const byDirectId = employees.find(e =>
      e.id === member.id || e.externalEmployeeId === member.id
    );
    if (byDirectId) {
      return byDirectId.id;
    }
    return employees.find(e => e.fullName.trim().toLowerCase() === normalized)?.id;
  }

  memberIdForEmployee(employeeId: string): string | undefined {
    const members = this.membersState;
    const employee = this.employeeById().get(employeeId);
    if (!employee) {
      return undefined;
    }
    const byId = members.find(m => m.id === employee.externalEmployeeId || m.id === employee.id);
    if (byId) {
      return byId.id;
    }
    const normalized = employee.fullName.trim().toLowerCase();
    return members.find(m => m.name.trim().toLowerCase() === normalized)?.id;
  }

  statusClass(value: string): string {
    return value.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Statuses a meeting task may legally move to, including its current status.
   * Mirrors the transition rules enforced in `updateMeetingTask` for built-in
   * statuses, then appends all custom statuses (which have no transition rules
   * and can be assigned freely).
   */
  allowedStatusesFor(task: Task): TaskStatus[] {
    const next = this.meetingTaskTransitions[task.status] ?? [];
    const custom = this.customStatusesState.filter(s => s !== task.status) as TaskStatus[];
    return [task.status, ...next, ...custom];
  }

  dateAfter(days: number): string {
    return this.addDays(this.todayIso, days);
  }

  checklistProgress(task: Task): number {
    if (!task.checklist.length) {
      return 0;
    }

    const done = task.checklist.filter(item => item.done).length;
    return Math.round((done / task.checklist.length) * 100);
  }

  private canTransitionMeetingTask(
    from: TaskStatus,
    to: TaskStatus
  ): boolean {
    if (from === to) {
      return true;
    }
    return (this.meetingTaskTransitions[from] ?? []).includes(to);
  }

  private resolveCurrentEmployeeId(): string {
    const employees = this.employeeStore.employees;
    if (!employees.length) {
      return this.currentEmployeeId;
    }

    const claims = this.readAuthClaims();
    const idCandidates = [
      claims['oid'],
      claims['sub'],
      claims['uid'],
      claims['userId'],
      claims['nameid']
    ].filter((value): value is string => typeof value === 'string' && !!value.trim());

    if (idCandidates.length) {
      const byId = employees.find(e =>
        idCandidates.includes(e.id) ||
        (!!e.externalEmployeeId && idCandidates.includes(e.externalEmployeeId))
      );
      if (byId) {
        return byId.id;
      }

      return idCandidates[0];
    }

    const nameCandidates = [
      claims['name'],
      claims['preferred_username'],
      claims['upn'],
      claims['unique_name']
    ].filter((value): value is string => typeof value === 'string' && !!value.trim())
      .map(value => value.trim().toLowerCase());

    if (nameCandidates.length) {
      const byName = employees.find(e => nameCandidates.includes(e.fullName.trim().toLowerCase()));
      if (byName) {
        return byName.id;
      }
    }

    if (employees.some(e => e.id === this.currentEmployeeId)) {
      return this.currentEmployeeId;
    }

    return this.currentEmployeeId || '';
  }

  private resolveCurrentMemberId(): string {
    if (!this.membersState.length) return this.currentUserId;

    const claims = this.readAuthClaims();
    const idCandidates = [
      claims['oid'], claims['sub'], claims['uid'], claims['userId'], claims['nameid']
    ].filter((v): v is string => typeof v === 'string' && !!v.trim());

    if (idCandidates.length) {
      const byId = this.membersState.find(m => idCandidates.includes(m.id));
      if (byId) return byId.id;

      return idCandidates[0];
    }

    const nameCandidates = [
      claims['name'], claims['preferred_username'], claims['upn'], claims['unique_name']
    ].filter((v): v is string => typeof v === 'string' && !!v.trim())
      .map(v => v.trim().toLowerCase());

    if (nameCandidates.length) {
      const byName = this.membersState.find(m => nameCandidates.includes(m.name.trim().toLowerCase()));
      if (byName) return byName.id;
    }

    if (this.membersState.some(m => m.id === this.currentUserId)) return this.currentUserId;
    return this.currentUserId || '';
  }

  private readAuthClaims(): Record<string, unknown> {
    const token = this.auth.getToken();
    if (!token) {
      return {};
    }
    const parts = token.split('.');
    if (parts.length < 2) {
      return {};
    }
    try {
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
      const decoded = atob(padded);
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private get legacyOpenMeetingActions(): MeetingNote[] {
    return this.meetingState.notes.filter(note => note.type === 'action' && !note.convertedTaskId);
  }

  private recordActivity(targetType: ActivityLog['targetType'], targetId: string, action: string, detail: string): void {
    const activity: ActivityLog = {
      id: `activity-${this.nextActivityNumber++}`,
      targetType,
      targetId,
      action,
      detail,
      createdAt: new Date().toISOString()
    };

    this.activityState = [activity, ...this.activityState].slice(0, 50);
  }

  private normalizeOrgGroupId(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private clearRuntimeState(): void {
    this.membersState = [];
    this.tasksState = [];
    this.meetingState = this.createEmptyMeeting();
    this.commentsState = [];
    this.activityState = [];
    this.customerStore.customers = [];
    this.employeeStore.employees = [];
    this.customerMeetingStore.customerMeetings = [];
    this.attachmentStore.attachments = [];
    this.externalCustomerGroups = [];
    this.taskChecklistMeta.clear();
    this.meetingIdAliases.clear();
    this.meetingNoteIdAliases.clear();
    this.pendingMeetingMutations.clear();
    this.pendingMeetingNoteMutations.clear();
    this.taskIdAliases.clear();
    this.pendingTaskMutations.clear();
    this.customerIdAliases.clear();
    this.pendingCustomerIds.clear();
    this.pendingCustomerMutations.clear();
    this.selectedTaskId = '';
    this.drawerOpen = false;
    this.currentUserId = '';
    this.currentEmployeeId = '';
    this.bumpDataRevision();
  }

  private applyBootstrap(bootstrap: ActionosBootstrapDto): void {
    const now = new Date().toISOString();
    const users = bootstrap.users ?? [];
    const customers = (bootstrap.customers ?? []).map((row) => this.mapCustomerFromApi(row, now));
    const customerById = new Map(customers.map((c) => [c.id, c] as const));

    this.employeeStore.employees = users.map((user) => this.mapEmployeeFromApi(user));
    this.membersState = users.map((user) => this.mapMemberFromApi(user));
    this.customerStore.customers = customers;
    const mailPrefs = this.normalizeMailNotifPrefs(bootstrap.mailNotificationPrefs);
    this.mailNotifPrefs.set(mailPrefs);
    this.persistMailNotifPrefs(mailPrefs);

    this.customerMeetingStore.customerMeetings = (bootstrap.meetings ?? []).map((row) =>
      this.mapCustomerMeetingFromApi(row)
    );
    this.taskChecklistMeta.clear();
    this.tasksState = this.cloneTasks((bootstrap.tasks ?? []).map((row) =>
      this.mapTaskFromApi(row, customerById)
    ));
    this.commentsState = (bootstrap.tasks ?? [])
      .flatMap((taskRow) =>
        (taskRow.notes ?? []).map((note) => ({
          id: `task-note-${note.id}`,
          targetType: 'task' as const,
          targetId: taskRow.id.toString(),
          body: note.content ?? '',
          createdByUserId: note.authorUserId ?? '',
          createdAt: note.createdAtUtc ?? now
        }))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    this.attachmentStore.attachments = (bootstrap.attachments ?? []).map((row) =>
      this.mapAttachmentFromApi(row)
    );

    const allowedOrgs = (bootstrap.allowedOrgs ?? [])
      .filter((row) => !!row.orgGroupId?.trim())
      .map((row) => ({
        id: row.orgGroupId.trim(),
        name: row.displayName?.trim() || row.orgGroupId.trim()
      }));
    this.externalCustomerGroups = allowedOrgs.length
      ? allowedOrgs
      : customers
          .filter((customer) => !!customer.externalGroupId)
          .map((customer) => ({
            id: customer.externalGroupId!,
            name: customer.name
          }));

    this.nextTaskNumber = this.computeNextTaskNumber(this.tasksState);
    this.nextMemberNumber = this.membersState.length + 1;
    this.nextCommentNumber = this.computeNextCommentNumber(this.commentsState);
    this.nextActivityNumber = this.activityState.length + 1;
    this.nextCustomerNumber = customers.length + 1;
    this.nextCustomerMeetingNumber = this.customerMeetingStore.customerMeetings.length + 1;
    this.nextAttachmentNumber = this.attachmentStore.attachments.length + 1;

    // An unsaved quick-capture draft (footer "new task") lives only in memory
    // via quickCaptureTaskDraft — it is never part of tasksState until it is
    // persisted. A background refresh must NOT touch the selection/drawer in
    // that case, otherwise the not-in-tasksState branch below force-closes the
    // drawer the moment any refresh lands (e.g. the same cycle that fires the
    // directory-users call), making the drawer vanish after a second or two.
    const draftIsOpen =
      !!this.quickCaptureTaskDraft && this.quickCaptureTaskDraft.id === this.selectedTaskId;
    if (!draftIsOpen) {
      // Resolve through id aliases so a just-created task whose local id was
      // promoted to a server id is still recognised after the post-mutation
      // refresh — otherwise the open drawer would be force-closed because the
      // raw local id no longer matches.
      const resolvedSelectedTaskId = this.resolveTaskId(this.selectedTaskId);
      if (this.tasksState.some((task) => task.id === resolvedSelectedTaskId)) {
        this.selectedTaskId = resolvedSelectedTaskId;
      } else {
        this.selectedTaskId = this.tasksState[0]?.id ?? '';
        this.drawerOpen = false;
      }
    }

    this.currentEmployeeId = this.resolveCurrentEmployeeId();
    this.currentUserId = this.resolveCurrentMemberId();
    this.bumpDataRevision();
  }

  private mapEmployeeFromApi(user: ActionosApiUserDto): Employee {
    return {
      id: user.userId,
      externalEmployeeId: user.userId,
      fullName: user.displayName?.trim() || user.userId,
      email: user.email?.trim() || '',
      team: '',
      role: '',
      isActive: user.isActive ?? true,
      sourceSystem: 'Fritz'
    };
  }

  private mapMemberFromApi(user: ActionosApiUserDto): Member {
    return {
      id: user.userId,
      name: user.displayName?.trim() || user.userId,
      role: 'Member',
      team: 'Fritz',
      availability: 'Available'
    };
  }

  private async refreshDirectoryUsers(orgGroupId: string): Promise<void> {
    try {
      const users = await this.actionosApi.getOrgUsers(orgGroupId);
      this.mergeDirectoryUsersFromApi(users ?? []);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[ActionOS] Failed to refresh ActionOS combined users directory.', error);
    }
  }

  private mergeDirectoryUsersFromApi(users: ActionosApiUserDto[]): void {
    this.mergeDirectoryUsers(users.map(user => ({
      id: user.userId,
      azureObjectId: user.azureObjectId,
      displayName: user.displayName,
      email: user.email,
      isActive: user.isActive ?? true
    })));
  }

  private mergeDirectoryUsers(users: DirectoryUserMergeInput[]): void {
    const normalizedUsers = users
      .map(user => ({
        id: user.id?.trim() || user.azureObjectId?.trim() || user.email?.trim() || '',
        azureObjectId: user.azureObjectId?.trim() ?? '',
        displayName: user.displayName?.trim() ?? '',
        email: user.email?.trim() ?? '',
        isActive: user.isActive ?? true
      }))
      .filter(user => !!user.id);

    if (!normalizedUsers.length) {
      return;
    }

    const employees = [...this.employeeStore.employees];
    const members = [...this.membersState];
    const employeeByKey = new Map<string, number>();
    const memberById = new Map<string, number>();

    const addEmployeeKey = (
      kind: 'id' | 'oid' | 'email',
      value: string | undefined | null,
      index: number
    ): void => {
      const key = this.directoryKey(value);
      if (key) {
        employeeByKey.set(`${kind}:${key}`, index);
      }
    };

    const employeeKeysForUser = (user: DirectoryUserMergeInput): string[] => {
      const keys: string[] = [];
      const addKey = (kind: 'id' | 'oid' | 'email', value: string | undefined | null): void => {
        const key = this.directoryKey(value);
        if (!key) {
          return;
        }
        keys.push(`${kind}:${key}`);
        if (kind === 'id' && key.includes('@')) {
          keys.push(`email:${key}`);
        }
      };

      addKey('id', user.id);
      addKey('oid', user.azureObjectId);
      addKey('email', user.email);
      return keys;
    };

    const indexEmployee = (employee: Employee, index: number): void => {
      addEmployeeKey('id', employee.id, index);
      addEmployeeKey('oid', employee.externalEmployeeId, index);
      addEmployeeKey('id', employee.externalEmployeeId, index);
      addEmployeeKey('email', employee.email, index);
      if (employee.id.includes('@')) {
        addEmployeeKey('email', employee.id, index);
      }
    };

    const indexMember = (member: Member, index: number): void => {
      memberById.set(this.directoryKey(member.id), index);
    };

    employees.forEach(indexEmployee);
    members.forEach(indexMember);

    let changed = false;
    for (const user of normalizedUsers) {
      const name = user.displayName || user.id;
      const idKey = this.directoryKey(user.id);
      const employeeIndex = employeeKeysForUser(user)
        .map(key => employeeByKey.get(key))
        .find(index => index !== undefined);

      if (employeeIndex === undefined) {
        const employee: Employee = {
          id: user.id,
          externalEmployeeId: user.azureObjectId || user.id,
          fullName: name,
          email: user.email,
          team: '',
          role: '',
          isActive: user.isActive,
          sourceSystem: 'Fritz'
        };
        const index = employees.length;
        employees.push(employee);
        indexEmployee(employee, index);
        changed = true;
      } else {
        const employee = employees[employeeIndex];
        const nextEmployee = {
          ...employee,
          externalEmployeeId: employee.externalEmployeeId || user.azureObjectId || user.id,
          fullName: this.shouldReplaceDirectoryName(employee.fullName, employee.id, name) ? name : employee.fullName,
          email: employee.email || user.email,
          isActive: employee.isActive || user.isActive
        };
        if (
          nextEmployee.externalEmployeeId !== employee.externalEmployeeId ||
          nextEmployee.fullName !== employee.fullName ||
          nextEmployee.email !== employee.email ||
          nextEmployee.isActive !== employee.isActive
        ) {
          employees[employeeIndex] = nextEmployee;
          indexEmployee(employees[employeeIndex], employeeIndex);
          changed = true;
        }
      }

      const memberId = employeeIndex === undefined ? user.id : employees[employeeIndex].id;
      const memberKey = this.directoryKey(memberId);
      const memberIndex = memberById.get(idKey) ?? memberById.get(memberKey);
      if (memberIndex === undefined) {
        const member: Member = {
          id: memberId,
          name,
          role: 'Member',
          team: 'Fritz',
          availability: 'Available'
        };
        const index = members.length;
        members.push(member);
        indexMember(member, index);
        changed = true;
      } else {
        const member = members[memberIndex];
        if (this.shouldReplaceDirectoryName(member.name, member.id, name)) {
          members[memberIndex] = { ...member, name };
          indexMember(members[memberIndex], memberIndex);
          changed = true;
        }
      }
    }

    if (!changed) {
      return;
    }

    this.employeeStore.employees = employees;
    this.membersState = members;
    this.nextMemberNumber = this.membersState.length + 1;
    this.currentEmployeeId = this.resolveCurrentEmployeeId();
    this.currentUserId = this.resolveCurrentMemberId();
    this.bumpDataRevision();
  }

  private shouldReplaceDirectoryName(currentName: string | undefined, id: string, nextName: string): boolean {
    const current = currentName?.trim() ?? '';
    const next = nextName.trim();
    if (!next || next.toLowerCase() === 'unknown') {
      return false;
    }
    return !current || current === id || current.toLowerCase() === 'unknown';
  }

  private directoryKey(value: string | undefined | null): string {
    return (value ?? '').trim().toLowerCase();
  }

  private mapCustomerFromApi(row: ActionosApiCustomerDto, nowIso: string): Customer {
    return {
      id: row.id,
      externalGroupId: row.externalGroupId ?? (row.type === 'Existing' ? row.id : null),
      name: row.name?.trim() || row.id,
      type: row.type === 'Prospect' ? 'Prospect' : 'Existing',
      status: row.status === 'Prospect' || row.status === 'At Risk' || row.status === 'Inactive'
        ? row.status
        : 'Active',
      primaryContactName: row.primaryContactName ?? undefined,
      primaryContactEmail: row.primaryContactEmail ?? undefined,
      primaryContactPhone: row.primaryContactPhone ?? undefined,
      accountOwnerEmployeeId: row.accountOwnerUserId ?? undefined,
      createdAt: row.createdAtUtc ?? nowIso,
      updatedAt: row.updatedAtUtc ?? nowIso
    };
  }

  private mapCustomerMeetingFromApi(row: ActionosApiCustomerMeetingDto): CustomerMeeting {
    const participants = row.participants ?? [];
    const notes = row.notes ?? [];
    const nextMeetingDate = row.nextMeetingDateUtc ? row.nextMeetingDateUtc.slice(0, 10) : undefined;
    const customerId = this.canonicalCustomerId(row.customerId);

    return {
      id: row.id.toString(),
      customerId,
      subject: row.subject,
      meetingDate: row.meetingDateUtc,
      meetingLeaderEmployeeId: row.meetingLeaderUserId,
      internalParticipantEmployeeIds: participants
        .filter((participant) => participant.isInternal && !!participant.userId)
        .map((participant) => participant.userId as string),
      // Internal participants with no userId are our-side guests (non-users), not employees.
      internalGuestParticipants: participants
        .filter((participant) => participant.isInternal && !participant.userId)
        .map((participant) => ({
          name: participant.displayName,
          email: participant.email ?? undefined,
          phone: participant.phone ?? undefined,
          role: participant.role ?? undefined
        })),
      customerParticipants: participants
        .filter((participant) => !participant.isInternal)
        .map((participant) => ({
          name: participant.displayName,
          email: participant.email ?? undefined,
          phone: participant.phone ?? undefined,
          role: participant.role ?? undefined
        })),
      goal: row.goal ?? undefined,
      summary: row.summary ?? undefined,
      publishedRecap: row.publishedRecap ?? undefined,
      notes: notes.map((note) => ({
        id: note.id.toString(),
        type: this.toNoteType(note.noteType),
        content: note.content,
        ownerId: note.ownerUserId ?? undefined,
        dueDate: note.dueDateUtc ? note.dueDateUtc.slice(0, 10) : undefined,
        convertedTaskId: note.convertedTaskId?.toString() ?? undefined,
        createdByEmployeeId: note.createdByUserId ?? undefined,
        createdAt: note.createdAtUtc
      })),
      nextMeetingDate,
      nextMeetingNotes: row.nextMeetingNotes ?? undefined,
      status: this.toMeetingStatus(row.status),
      attachmentIds: [],
      createdAt: row.createdAtUtc,
      updatedAt: row.updatedAtUtc
    };
  }

  private mapTaskFromApi(row: ActionosApiTaskDto, customerById: Map<string, Customer>): Partial<Task> {
    const assigneeId = row.assignedUserId ?? '';
    const sourceMeetingId = row.sourceMeetingId?.toString() ?? '';
    const watcherIds = (row.watchers ?? []).map((watcher) => watcher.userId).filter((id) => !!id);
    const status = this.toUnifiedStatus(row.status as TaskStatus);
    const dueDate = row.dueDateUtc ? row.dueDateUtc.slice(0, 10) : this.todayIso;
    const meetingName = sourceMeetingId ? this.customerMeeting(sourceMeetingId)?.subject : undefined;
    const customerName = row.customerId ? customerById.get(row.customerId)?.name : undefined;
    const waitingReason = row.waitingReason ?? undefined;
    this.taskChecklistMeta.set(row.id.toString(), (row.checklistItems ?? []).map((item) => ({
      id: item.id,
      label: item.label
    })));

    return {
      id: row.id.toString(),
      title: row.title,
      description: row.description ?? '',
      source: sourceMeetingId ? 'meeting' : 'board',
      board: customerName || meetingName || 'ActionOS',
      customerId: row.customerId ?? '',
      status,
      priority: row.priority as Task['priority'],
      dueDate,
      assigneeIds: assigneeId ? [assigneeId] : [],
      watcherIds,
      assignedToEmployeeId: assigneeId,
      openedByEmployeeId: row.openedByUserId ?? this.currentEmployeeId,
      watcherEmployeeIds: Array.from(new Set(watcherIds)),
      attachmentIds: [],
      notifications: (row.notifications ?? []).map((notification) => ({
        event: (notification.eventType as 'assigned' | 'status-changed' | 'due-soon'),
        channel: (notification.channel as 'email' | 'in-app'),
        sentAt: notification.sentAtUtc,
        recipientEmployeeId: notification.recipientUserId
      })),
      sourceMeetingId,
      waitingReason,
      completedAt: row.completedAtUtc ?? undefined,
      treatmentNotes: row.treatmentNotes ?? '',
      blockedBy: status === 'Waiting For Internal' ? waitingReason : undefined,
      createdByUserId: row.openedByUserId ?? undefined,
      createdAt: row.createdAtUtc,
      updatedAt: row.updatedAtUtc,
      checklist: (row.checklistItems ?? []).map((item) => ({
        label: item.label,
        done: item.isDone
      })),
      progressionNotes: (row.activityNotes ?? []).map((note) => ({
        id: note.id.toString(),
        content: note.content,
        authorEmployeeId: note.authorUserId,
        createdAt: note.createdAtUtc
      }))
    };
  }

  private mapAttachmentFromApi(row: ActionosApiAttachmentDto): Attachment {
    const entityType = this.toAttachmentEntityType(row.entityType);
    return {
      id: row.id.toString(),
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      url: row.storageUrl,
      linkedEntityType: entityType,
      linkedEntityId: row.entityId,
      uploadedAt: row.uploadedAtUtc,
      uploadedByEmployeeId: row.uploadedByUserId
    };
  }

  private toNoteType(value: string | undefined): NoteType {
    switch ((value ?? '').toLowerCase()) {
      case 'action':
        return 'action';
      case 'decision':
        return 'decision';
      case 'blocker':
        return 'blocker';
      default:
        return 'note';
    }
  }

  private toMeetingStatus(status: string | undefined): CustomerMeetingStatus {
    switch ((status ?? '').toLowerCase()) {
      case 'closed':
        return 'Closed';
      case 'tasks created':
        return 'Tasks Created';
      case 'draft summary':
        return 'Draft Summary';
      default:
        return 'Planned';
    }
  }

  private toAttachmentEntityType(value: string): AttachmentEntityType {
    if (value === 'customer' || value === 'customer-meeting' || value === 'meeting-task' || value === 'meeting-note') {
      return value;
    }

    return 'meeting-note';
  }

  private scheduleBackendRefresh(): void {
    if (this.refreshScheduled) {
      return;
    }

    this.refreshScheduled = true;
    setTimeout(() => {
      this.refreshScheduled = false;
      void this.refreshFromBackend();
    }, 200);
  }

  private async refreshFromBackend(): Promise<void> {
    const token = this.auth.getToken() ?? '';
    if (!token) {
      return;
    }

    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    if (this.bootstrapInFlight) {
      return this.bootstrapInFlight;
    }

    // Don't start a refresh while writes are pending — the post-mutation
    // refresh will run once they settle. Applying a snapshot now would revert
    // the user's optimistic edit.
    if (this.hasPendingWrites) {
      return;
    }

    const orgGroupId = this.currentOrgGroupId;
    this.lastRefreshStartedAt = Date.now();
    // Snapshot the data revision before fetching. If any optimistic write lands
    // while the snapshot is in flight, the revision changes and we must discard
    // the now-stale snapshot rather than overwrite the fresh local edit.
    const revisionAtStart = this.dataRevision;

    this.refreshInFlight = (async () => {
      try {
        const bootstrap = await this.actionosApi.bootstrap(orgGroupId);
        if (this.hasPendingWrites || this.dataRevision !== revisionAtStart) {
          // Local optimistic state changed (a new edit or a queued write) while
          // we were fetching. Applying this snapshot would clobber it, so drop
          // it. The write that changed the revision schedules its own refresh on
          // settle, guaranteeing eventual reconciliation.
          return;
        }
        this.applyBootstrap(bootstrap);
        const directoryOrgId = orgGroupId || bootstrap.orgGroupId || bootstrap.allowedOrgs?.[0]?.orgGroupId || null;
        if (directoryOrgId) {
          await this.refreshDirectoryUsers(directoryOrgId);
        }
        this.lastBootstrapKey = token;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[ActionOS] Failed to refresh ActionOS data after mutation.', error);
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  private persistAndRefresh<TResult>(
    operation: Promise<TResult>,
    options: BackendMutationOptions<TResult> = {}
  ): void {
    this.pendingMutationCount += 1;
    void operation
      .then((result) => {
        options.onSuccess?.(result);
        this.mutationRefreshPending = true;
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('[ActionOS] Backend mutation failed.', error);
        options.onFailure?.(error);
        this.reportBackendIssue(
          options.failureMessage ?? 'ActionOS could not save this change to the database.',
          error
        );
        this.mutationRefreshPending = true;
      })
      .finally(() => {
        this.pendingMutationCount = Math.max(0, this.pendingMutationCount - 1);
        if (this.pendingMutationCount === 0 && this.mutationRefreshPending) {
          this.mutationRefreshPending = false;
          this.scheduleBackendRefresh();
        }
      });
  }

  private bumpDataRevision(): void {
    this.dataRevisionState.update(revision => revision + 1);
  }

  private saveToStorage(): void {
    this.bumpDataRevision();
    // Real backend mode: keep state in memory and backend only.
  }

  private getOrgGroupForMutation(): string | null {
    const orgGroupId = this.currentOrgGroupId ?? this.normalizeOrgGroupId(this.hostContext.snapshot.selectedOrg);
    return orgGroupId;
  }

  private reportBackendIssue(message: string, error?: unknown): void {
    this.backendIssue.set({
      message,
      detail: this.describeBackendError(error),
      occurredAt: new Date().toISOString()
    });
  }

  private describeBackendError(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const httpError = error as {
      status?: number;
      statusText?: string;
      message?: string;
      error?: unknown;
    };
    const detail =
      typeof httpError.error === 'string'
        ? httpError.error
        : typeof (httpError.error as { message?: unknown } | null)?.message === 'string'
          ? (httpError.error as { message: string }).message
          : undefined;

    if (typeof httpError.status === 'number' && httpError.status > 0) {
      const label = httpError.statusText ? ` ${httpError.statusText}` : '';
      return detail ? `HTTP ${httpError.status}${label}: ${detail}` : `HTTP ${httpError.status}${label}`;
    }

    return detail ?? httpError.message;
  }

  private bootstrapFailureMessage(error: unknown): string {
    return this.isForbiddenError(error)
      ? 'You do not have permission to access ActionOS.'
      : 'ActionOS could not load your workspace.';
  }

  private isForbiddenError(error: unknown): boolean {
    return !!error
      && typeof error === 'object'
      && (error as { status?: number }).status === 403;
  }

  private resolveCustomerId(customerId: string): string {
    let current = customerId;
    const seen = new Set<string>();
    while (this.customerIdAliases.has(current) && !seen.has(current)) {
      seen.add(current);
      current = this.customerIdAliases.get(current) as string;
    }
    return current;
  }

  private runCustomerMutation(
    customerId: string,
    operation: (customerId: string) => Promise<unknown>,
    failureMessage?: string
  ): void {
    const resolvedCustomerId = this.resolveCustomerId(customerId).trim();
    if (!resolvedCustomerId) {
      return;
    }

    if (this.pendingCustomerIds.has(resolvedCustomerId)) {
      const queued = this.pendingCustomerMutations.get(resolvedCustomerId) ?? [];
      queued.push({ operation, failureMessage });
      this.pendingCustomerMutations.set(resolvedCustomerId, queued);
      return;
    }

    this.persistAndRefresh(operation(resolvedCustomerId), { failureMessage });
  }

  private flushPendingCustomerMutations(canonicalCustomerId: string): void {
    if (!this.pendingCustomerMutations.size) {
      return;
    }

    const operations: PendingCustomerMutation[] = [];
    for (const [key, queue] of this.pendingCustomerMutations.entries()) {
      if (this.resolveCustomerId(key) !== canonicalCustomerId) {
        continue;
      }
      operations.push(...queue);
      this.pendingCustomerMutations.delete(key);
    }

    for (const queued of operations) {
      this.persistAndRefresh(queued.operation(canonicalCustomerId), {
        failureMessage: queued.failureMessage
      });
    }
  }

  private promoteCustomerId(localCustomerId: string, canonicalCustomerId: string): void {
    const local = localCustomerId.trim();
    const canonical = canonicalCustomerId.trim();
    if (!local || !canonical) {
      return;
    }

    this.customerIdAliases.set(local, canonical);
    this.pendingCustomerIds.delete(local);
    this.pendingCustomerIds.delete(canonical);

    if (local !== canonical) {
      this.customerStore.customers = this.customerStore.customers.map((customer) =>
        customer.id === local
          ? { ...customer, id: canonical }
          : customer
      );
      this.customerMeetingStore.customerMeetings = this.customerMeetingStore.customerMeetings.map((meeting) =>
        meeting.customerId === local
          ? { ...meeting, customerId: canonical }
          : meeting
      );
      this.tasksState = this.tasksState.map((task) =>
        task.customerId === local
          ? { ...task, customerId: canonical }
          : task
      );
      if (this.openNewMeetingCustomerId === local) {
        this.openNewMeetingCustomerId = canonical;
      }
      if (this.catchUpCustomerId === local) {
        this.catchUpCustomerId = canonical;
      }
      this.bumpDataRevision();
    }

    this.flushPendingCustomerMutations(canonical);
  }

  private resolveMeetingId(meetingId: string): string {
    let current = meetingId;
    const seen = new Set<string>();
    while (this.meetingIdAliases.has(current) && !seen.has(current)) {
      seen.add(current);
      current = this.meetingIdAliases.get(current) as string;
    }
    return current;
  }

  private resolveMeetingNoteId(noteId: string): string {
    let current = noteId;
    const seen = new Set<string>();
    while (this.meetingNoteIdAliases.has(current) && !seen.has(current)) {
      seen.add(current);
      current = this.meetingNoteIdAliases.get(current) as string;
    }
    return current;
  }

  // ── Failed-create rollback ───────────────────────────────────────────────
  // When a create call rejects, the optimistic entity never gets a server id.
  // We must drop it from the store (so the user sees the change roll back) AND
  // clear its pending-mutation queue / id sets — otherwise the queue strands and
  // `hasPendingWrites` stays true forever, permanently blocking refresh.

  private abandonLocalTask(localTaskId: string): void {
    const local = localTaskId.trim();
    if (!local) {
      return;
    }
    this.taskIdAliases.delete(local);
    this.pendingTaskMutations.delete(local);
    this.tasksState = this.tasksState.filter((task) => task.id !== local);
    if (this.selectedTaskId === local) {
      this.selectedTaskId = this.tasksState[0]?.id ?? '';
      this.drawerOpen = false;
    }
    this.bumpDataRevision();
  }

  private abandonLocalMeeting(localMeetingId: string): void {
    const local = localMeetingId.trim();
    if (!local) {
      return;
    }
    this.meetingIdAliases.delete(local);
    this.pendingMeetingMutations.delete(local);
    // Cascade: any task or note created against this not-yet-saved meeting can
    // never persist either, so roll them back too (and clear their queues).
    for (const task of this.tasksState.filter((item) => item.sourceMeetingId === local)) {
      this.abandonLocalTask(task.id);
    }
    const meeting = this.customerMeetingStore.customerMeetings.find((item) => item.id === local);
    if (meeting) {
      for (const note of [...meeting.notes]) {
        this.pendingMeetingNoteMutations.delete(note.id);
        this.meetingNoteIdAliases.delete(note.id);
      }
    }
    this.customerMeetingStore.customerMeetings = this.customerMeetingStore.customerMeetings.filter(
      (item) => item.id !== local
    );
    if (this.openMeetingId === local) {
      this.openMeetingId = null;
    }
    if (this.pendingOpenMeetingId === local) {
      this.pendingOpenMeetingId = null;
    }
    this.bumpDataRevision();
  }

  private abandonLocalMeetingNote(meetingId: string, localNoteId: string): void {
    const local = localNoteId.trim();
    if (!local) {
      return;
    }
    this.meetingNoteIdAliases.delete(local);
    this.pendingMeetingNoteMutations.delete(local);
    const meeting = this.customerMeetingRepo.get(this.resolveMeetingId(meetingId));
    if (meeting) {
      meeting.notes = meeting.notes.filter((note) => note.id !== local);
    }
    this.bumpDataRevision();
  }

  private abandonLocalCustomer(localCustomerId: string): void {
    const local = localCustomerId.trim();
    if (!local) {
      return;
    }
    this.customerIdAliases.delete(local);
    this.pendingCustomerIds.delete(local);
    this.pendingCustomerMutations.delete(local);
    this.customerStore.customers = this.customerStore.customers.filter((customer) => customer.id !== local);
    this.bumpDataRevision();
  }

  private runMeetingMutation(
    meetingId: string,
    operation: (meetingIdNumeric: number) => Promise<unknown>
  ): void {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    const meetingIdNumeric = this.parseNumericId(resolvedMeetingId);
    if (meetingIdNumeric != null) {
      this.persistAndRefresh(operation(meetingIdNumeric));
      return;
    }

    const queueKey = resolvedMeetingId.trim();
    if (!queueKey) {
      return;
    }
    const queued = this.pendingMeetingMutations.get(queueKey) ?? [];
    queued.push(operation);
    this.pendingMeetingMutations.set(queueKey, queued);
  }

  private flushPendingMeetingMutations(canonicalMeetingId: string): void {
    const meetingIdNumeric = this.parseNumericId(canonicalMeetingId);
    if (meetingIdNumeric == null || !this.pendingMeetingMutations.size) {
      return;
    }

    const operations: Array<(meetingIdNumeric: number) => Promise<unknown>> = [];
    for (const [key, queue] of this.pendingMeetingMutations.entries()) {
      if (this.resolveMeetingId(key) !== canonicalMeetingId) {
        continue;
      }
      operations.push(...queue);
      this.pendingMeetingMutations.delete(key);
    }

    for (const queuedOperation of operations) {
      this.persistAndRefresh(queuedOperation(meetingIdNumeric));
    }
  }

  private runMeetingNoteMutation(
    meetingId: string,
    noteId: string,
    operation: (meetingIdNumeric: number, noteIdNumeric: number) => Promise<unknown>
  ): void {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    const resolvedNoteId = this.resolveMeetingNoteId(noteId);
    const noteIdNumeric = this.parseNumericId(resolvedNoteId);
    if (noteIdNumeric != null) {
      this.runMeetingMutation(resolvedMeetingId, (meetingIdNumeric) =>
        operation(meetingIdNumeric, noteIdNumeric)
      );
      return;
    }

    const queueKey = resolvedNoteId.trim();
    if (!queueKey) {
      return;
    }
    const queued = this.pendingMeetingNoteMutations.get(queueKey) ?? [];
    queued.push(operation);
    this.pendingMeetingNoteMutations.set(queueKey, queued);
  }

  private flushPendingMeetingNoteMutations(canonicalMeetingId: string, canonicalNoteId: string): void {
    const noteIdNumeric = this.parseNumericId(canonicalNoteId);
    if (noteIdNumeric == null || !this.pendingMeetingNoteMutations.size) {
      return;
    }

    const operations: Array<(meetingIdNumeric: number, noteIdNumeric: number) => Promise<unknown>> = [];
    for (const [key, queue] of this.pendingMeetingNoteMutations.entries()) {
      if (this.resolveMeetingNoteId(key) !== canonicalNoteId) {
        continue;
      }
      operations.push(...queue);
      this.pendingMeetingNoteMutations.delete(key);
    }

    for (const queuedOperation of operations) {
      this.runMeetingMutation(canonicalMeetingId, (meetingIdNumeric) =>
        queuedOperation(meetingIdNumeric, noteIdNumeric)
      );
    }
  }

  private resolveTaskId(taskId: string): string {
    let current = taskId;
    const seen = new Set<string>();
    while (this.taskIdAliases.has(current) && !seen.has(current)) {
      seen.add(current);
      current = this.taskIdAliases.get(current) as string;
    }
    return current;
  }

  private runTaskMutation(
    taskId: string,
    operation: (taskIdNumeric: number) => Promise<unknown>
  ): void {
    const resolvedTaskId = this.resolveTaskId(taskId);
    const taskIdNumeric = this.parseNumericId(resolvedTaskId);
    if (taskIdNumeric != null) {
      this.persistAndRefresh(operation(taskIdNumeric));
      return;
    }

    const queueKey = resolvedTaskId.trim();
    if (!queueKey) {
      return;
    }
    const queued = this.pendingTaskMutations.get(queueKey) ?? [];
    queued.push(operation);
    this.pendingTaskMutations.set(queueKey, queued);
  }

  private flushPendingTaskMutations(canonicalTaskId: string): void {
    const taskIdNumeric = this.parseNumericId(canonicalTaskId);
    if (taskIdNumeric == null || !this.pendingTaskMutations.size) {
      return;
    }

    const operations: Array<(taskIdNumeric: number) => Promise<unknown>> = [];
    for (const [key, queue] of this.pendingTaskMutations.entries()) {
      if (this.resolveTaskId(key) !== canonicalTaskId) {
        continue;
      }
      operations.push(...queue);
      this.pendingTaskMutations.delete(key);
    }

    for (const queuedOperation of operations) {
      this.persistAndRefresh(queuedOperation(taskIdNumeric));
    }
  }

  private promoteTaskId(localTaskId: string, canonicalTaskId: string): void {
    const local = localTaskId.trim();
    const canonical = canonicalTaskId.trim();
    if (!local || !canonical) {
      return;
    }

    this.taskIdAliases.set(local, canonical);
    this.flushPendingTaskMutations(canonical);
    if (local === canonical) {
      return;
    }

    this.tasksState = this.tasksState.map((task) =>
      task.id === local
        ? { ...task, id: canonical }
        : task
    );

    this.customerMeetingStore.customerMeetings = this.customerMeetingStore.customerMeetings.map((meeting) => ({
      ...meeting,
      notes: meeting.notes.map((note) =>
        note.convertedTaskId === local
          ? { ...note, convertedTaskId: canonical }
          : note
      )
    }));

    this.meetingState = {
      ...this.meetingState,
      notes: this.meetingState.notes.map((note) =>
        note.convertedTaskId === local
          ? { ...note, convertedTaskId: canonical }
          : note
      )
    };

    this.commentsState = this.commentsState.map((comment) =>
      comment.targetType === 'task' && comment.targetId === local
        ? { ...comment, targetId: canonical }
        : comment
    );

    this.attachmentStore.attachments = this.attachmentStore.attachments.map((attachment) =>
      attachment.linkedEntityType === 'meeting-task' && attachment.linkedEntityId === local
        ? { ...attachment, linkedEntityId: canonical }
        : attachment
    );

    if (this.selectedTaskId === local) {
      this.selectedTaskId = canonical;
    }
    this.bumpDataRevision();
  }

  private promoteMeetingId(localMeetingId: string, canonicalMeetingId: string): void {
    const local = localMeetingId.trim();
    const canonical = canonicalMeetingId.trim();
    if (!local || !canonical) {
      return;
    }

    this.meetingIdAliases.set(local, canonical);
    this.flushPendingMeetingMutations(canonical);
    if (local === canonical) {
      return;
    }

    const meeting = this.customerMeetingStore.customerMeetings.find((item) => item.id === local);
    if (meeting) {
      meeting.id = canonical;
    }

    this.tasksState = this.tasksState.map((task) =>
      task.sourceMeetingId === local
        ? { ...task, sourceMeetingId: canonical }
        : task
    );

    if (this.pendingOpenMeetingId === local) {
      this.pendingOpenMeetingId = canonical;
    }
    if (this.openMeetingId === local) {
      this.openMeetingId = canonical;
    }
    if (this.meetingState.id === local) {
      this.meetingState = { ...this.meetingState, id: canonical };
    }
    this.bumpDataRevision();
  }

  private promoteMeetingNoteId(
    meetingId: string,
    localNoteId: string,
    created: ActionosApiMeetingNoteDto
  ): void {
    const canonicalMeetingId = this.resolveMeetingId(meetingId);
    const canonicalNoteId = created.id.toString();
    if (!canonicalNoteId || localNoteId === canonicalNoteId) {
      return;
    }

    this.meetingNoteIdAliases.set(localNoteId, canonicalNoteId);
    this.flushPendingMeetingNoteMutations(canonicalMeetingId, canonicalNoteId);

    const meeting = this.customerMeetingRepo.get(canonicalMeetingId);
    if (!meeting) {
      return;
    }

    const note = meeting.notes.find((item) => item.id === localNoteId);
    if (!note) {
      return;
    }

    note.id = canonicalNoteId;
    this.attachmentStore.attachments = this.attachmentStore.attachments.map((attachment) =>
      attachment.linkedEntityType === 'meeting-note' && attachment.linkedEntityId === localNoteId
        ? { ...attachment, linkedEntityId: canonicalNoteId }
        : attachment
    );
    this.bumpDataRevision();
  }

  private parseNumericId(value: string | undefined | null): number | null {
    if (!value) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private resolveChecklistItemId(task: Task, checklistItem: ChecklistItem): number | null {
    const meta = this.taskChecklistMeta.get(task.id);
    if (!meta?.length) {
      return null;
    }

    const itemIndex = task.checklist.findIndex((item) => item.label === checklistItem.label);
    if (itemIndex < 0 || itemIndex >= meta.length) {
      return null;
    }

    return meta[itemIndex]?.id ?? null;
  }

  private cloneTasks(tasks: Partial<Task>[]): Task[] {
    return tasks.map((task, index) => {
      const now = new Date().toISOString();
      const status = this.toUnifiedStatus(task.status);
      const assignedToEmployeeId =
        task.assignedToEmployeeId ||
        (task.assigneeIds?.[0] ? this.employeeIdForMember(task.assigneeIds[0]) : undefined) ||
        this.currentEmployeeId;
      const assigneeIds = task.assigneeIds?.length
        ? [...task.assigneeIds]
        : (this.memberIdForEmployee(assignedToEmployeeId)
          ? [this.memberIdForEmployee(assignedToEmployeeId) as string]
          : []);
      const openedByEmployeeId =
        task.openedByEmployeeId ||
        (task.createdByUserId ? this.employeeIdForMember(task.createdByUserId) : undefined) ||
        this.currentEmployeeId;
      const watcherIds = task.watcherIds?.length
        ? [...task.watcherIds]
        : (task.watcherEmployeeIds ?? [])
            .map(employeeId => this.memberIdForEmployee(employeeId))
            .filter((id): id is string => !!id);
      const watcherEmployeeIds = (task.watcherEmployeeIds?.length
        ? [...task.watcherEmployeeIds]
        : watcherIds
            .map(id => this.employeeIdForMember(id))
            .filter((id): id is string => !!id)
      );
      const createdByUserId = task.createdByUserId ?? this.memberIdForEmployee(openedByEmployeeId);
      const waitingReason = status === 'Waiting For Customer' || status === 'Waiting For Internal'
        ? (task.waitingReason || task.blockedBy || 'Waiting for next input')
        : undefined;
      const blockedBy = task.blockedBy ?? (status === 'Waiting For Internal' ? waitingReason : undefined);
      const source: Task['source'] = task.sourceMeetingId || task.source === 'meeting' ? 'meeting' : 'board';

      return {
        id: task.id ?? `task-${index + 1}`,
        title: task.title ?? 'Untitled task',
        description: task.description ?? '',
        source,
        board: task.board ?? 'ActionOS Core',
        customerId: task.customerId ?? '',
        status,
        priority: task.priority ?? 'Medium',
        dueDate: task.dueDate ?? this.todayIso,
        assigneeIds,
        watcherIds,
        assignedToEmployeeId,
        openedByEmployeeId,
        watcherEmployeeIds: Array.from(
          new Set(
            [openedByEmployeeId, assignedToEmployeeId, ...watcherEmployeeIds].filter(
              (id): id is string => !!id
            )
          )
        ),
        attachmentIds: [...(task.attachmentIds ?? [])],
        notifications: (task.notifications ?? []).map((n) => ({ ...n })),
        sourceMeetingId: task.sourceMeetingId ?? '',
        waitingReason,
        completedAt: task.completedAt,
        treatmentNotes: task.treatmentNotes ?? '',
        blockedBy,
        archivedAt: task.archivedAt,
        createdByUserId,
        createdAt: task.createdAt ?? now,
        updatedAt: task.updatedAt ?? now,
        checklist: (task.checklist ?? []).map(item => ({ ...item }))
      };
    });
  }

  private cloneMembers(members: Member[]): Member[] {
    return members.map(member => ({ ...member }));
  }

  private createEmptyMeeting(): Meeting {
    const now = new Date().toISOString();
    return {
      id: '',
      title: '',
      time: '',
      startsAt: now,
      durationMinutes: 30,
      attendeeIds: [],
      linkedBoard: '',
      agenda: [],
      notes: []
    };
  }

  private cloneMeeting(meeting: Partial<Meeting>): Meeting {
    const fallback = this.createEmptyMeeting();
    const agendaSource = meeting.agenda ?? fallback.agenda;

    return {
      id: meeting.id ?? fallback.id,
      title: meeting.title ?? fallback.title,
      time: meeting.time ?? fallback.time,
      startsAt: meeting.startsAt ?? fallback.startsAt,
      durationMinutes: meeting.durationMinutes ?? fallback.durationMinutes,
      attendeeIds: [...(meeting.attendeeIds ?? fallback.attendeeIds)],
      linkedBoard: meeting.linkedBoard ?? fallback.linkedBoard,
      agenda: agendaSource.map((item, index) => {
        if (typeof item === 'string') {
          return { id: `agenda-${index + 1}`, title: item, completed: false };
        }

        return { ...item };
      }),
      notes: (meeting.notes ?? fallback.notes).map(note => ({ ...note }))
    };
  }

  private addDays(dateIso: string, days: number): string {
    const date = new Date(`${dateIso}T00:00:00`);
    date.setDate(date.getDate() + days);
    return this.toDateOnly(date);
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Hard-unifies every stored/seeded task into the progression-capable task
   * shape while preserving whether it was born from a meeting or standalone.
   */
  private normalizeUnifiedTasks(tasks: Partial<Task>[]): Partial<Task>[] {
    const meetingTasks = tasks.filter(task => task.source === 'meeting');
    const legacyTasks = tasks.filter(task => task.source !== 'meeting');
    const convertedLegacy = legacyTasks.map(task => {
      const firstAssignee = task.assigneeIds?.[0] ?? task.createdByUserId ?? this.currentUserId;
      const assignedToEmployeeId =
        task.assignedToEmployeeId ||
        (firstAssignee ? this.employeeIdForMember(firstAssignee) : undefined) ||
        this.currentEmployeeId;
      const openedByEmployeeId =
        task.openedByEmployeeId ||
        (task.createdByUserId ? this.employeeIdForMember(task.createdByUserId) : undefined) ||
        this.currentEmployeeId;

      return {
        ...task,
        source: task.sourceMeetingId ? 'meeting' as const : 'board' as const,
        status: this.toUnifiedStatus(task.status),
        assignedToEmployeeId,
        openedByEmployeeId,
        waitingReason: task.waitingReason || task.blockedBy || undefined,
        treatmentNotes: task.treatmentNotes ?? ''
      };
    });

    const deduped: Partial<Task>[] = [];
    const seen = new Set<string>();
    for (const task of [...convertedLegacy, ...meetingTasks]) {
      const id = task.id?.trim();
      if (id && seen.has(id)) {
        continue;
      }
      if (id) {
        seen.add(id);
      }
      deduped.push(task);
    }
    return deduped;
  }

  private toUnifiedStatus(status: TaskStatus | undefined): TaskStatus {
    switch (status) {
      case 'Inbox':
        return 'New';
      case 'Planned':
        return 'Sent To Owner';
      case 'Waiting':
        return 'Waiting For Internal';
      default:
        return status ?? 'New';
    }
  }

  private isTaskOpen(status: TaskStatus): boolean {
    return this.isOpenMeetingTaskStatus(this.toUnifiedStatus(status));
  }

  private computeNextTaskNumber(tasks: Task[]): number {
    const maxSuffix = tasks.reduce((max, task) => {
      const match = task.id.match(/(?:task-|mtask-)(\d+)$/);
      const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN;
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, 0);
    return maxSuffix + 1;
  }

  private computeNextCommentNumber(comments: Comment[]): number {
    const maxSuffix = comments.reduce((max, comment) => {
      const match = comment.id.match(/^comment-(\d+)$/);
      const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN;
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, 0);
    return maxSuffix + 1;
  }

  private uniqueTasks(tasks: Task[]): Task[] {
    const seen = new Set<string>();

    return tasks.filter(task => {
      if (seen.has(task.id)) {
        return false;
      }

      seen.add(task.id);
      return true;
    });
  }

  private priorityScore(priority: Task['priority']): number {
    const scores: Record<Task['priority'], number> = {
      Low: 1,
      Medium: 2,
      High: 3,
      Critical: 4
    };

    return scores[priority];
  }

  // ─────────────────────────────────────────────────────────────────────
  // v3 Customer Meeting Management — public API
  // All methods delegate to the appropriate port. The ports own persistence
  // via the shared saveToStorage() callback injected at construction time.
  // ─────────────────────────────────────────────────────────────────────

  get customers(): Customer[] {
    if (this.customersCache.revision !== this.dataRevision) {
      this.customersCache.revision = this.dataRevision;
      this.customersCache.value = this.customerStore.customers
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return this.customersCache.value;
  }

  get clientOptions(): { id: string; name: string }[] {
    if (this.taskClientOptionsCache.revision === this.dataRevision) {
      return this.taskClientOptionsCache.value;
    }

    const byId = new Map<string, { id: string; name: string }>();
    const representedExternalIds = new Set<string>();
    const add = (id: string | null | undefined, name: string | null | undefined): void => {
      const trimmedId = id?.trim();
      if (!trimmedId || byId.has(trimmedId)) {
        return;
      }
      byId.set(trimmedId, { id: trimmedId, name: name?.trim() || trimmedId });
    };

    this.customers.forEach(customer => {
      add(customer.id, customer.name);
      if (customer.externalGroupId?.trim()) {
        representedExternalIds.add(customer.externalGroupId.trim().toLowerCase());
      }
    });
    this.externalCustomerGroups.forEach(group => {
      if (!representedExternalIds.has(group.id.trim().toLowerCase())) {
        add(group.id, group.name);
      }
    });

    const value = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
    this.taskClientOptionsCache.revision = this.dataRevision;
    this.taskClientOptionsCache.value = value;
    return value;
  }

  get taskClientOptions(): { id: string; name: string }[] {
    return this.clientOptions;
  }

  private customerById(): Map<string, Customer> {
    if (this.customerByIdCache.revision !== this.dataRevision) {
      this.customerByIdCache.revision = this.dataRevision;
      this.customerByIdCache.value = new Map(this.customerStore.customers.map(customer => [customer.id, customer]));
    }
    return this.customerByIdCache.value;
  }

  private customerByExternalGroupId(): Map<string, Customer> {
    if (this.customerByExternalGroupCache.revision !== this.dataRevision) {
      const byExternalGroupId = new Map<string, Customer>();
      for (const customer of this.customerStore.customers) {
        if (customer.externalGroupId) {
          byExternalGroupId.set(customer.externalGroupId, customer);
        }
      }
      this.customerByExternalGroupCache.revision = this.dataRevision;
      this.customerByExternalGroupCache.value = byExternalGroupId;
    }
    return this.customerByExternalGroupCache.value;
  }

  private canonicalCustomerId(customerId: string | null | undefined): string {
    const resolvedId = this.resolveCustomerId(customerId ?? '').trim();
    if (!resolvedId) {
      return '';
    }

    const customer = this.customerStore.customers.find((item) =>
      item.externalGroupId?.trim().toLowerCase() === resolvedId.toLowerCase()
    );
    return customer?.id ?? resolvedId;
  }

  customer(id: string): Customer | undefined {
    return this.customerById().get(this.canonicalCustomerId(id));
  }

  clientName(id: string): string | undefined {
    const resolvedId = this.resolveCustomerId(id).trim();
    if (!resolvedId) {
      return undefined;
    }

    const customer = this.customerById().get(resolvedId)
      ?? this.customerByExternalGroupId().get(resolvedId);
    if (customer) {
      return customer.name;
    }

    return this.externalCustomerGroups.find(group => group.id === resolvedId)?.name;
  }

  private clientLookupIds(id: string | undefined | null): string[] {
    const resolvedId = this.canonicalCustomerId(id);
    if (!resolvedId) {
      return [];
    }

    const ids = new Set<string>([resolvedId]);
    const customer = this.customerById().get(resolvedId)
      ?? this.customerByExternalGroupId().get(resolvedId);
    if (customer) {
      ids.add(customer.id);
      if (customer.externalGroupId?.trim()) {
        ids.add(customer.externalGroupId.trim());
      }
    }

    return [...ids];
  }

  customersByStatus(status: 'all' | Customer['status'] | Customer['type']): Customer[] {
    if (status === 'all') {
      return this.customers;
    }
    return this.customers.filter(
      (c) => c.status === status || c.type === status
    );
  }

  addCustomer(input: CreateCustomerInput): Customer | null {
    const orgGroupId = this.getOrgGroupForMutation();
    if (!orgGroupId) {
      this.reportBackendIssue('ActionOS could not save this customer because no organization is selected.');
      return null;
    }

    const customer = this.customerRepo.add(input);
    this.recordActivity('member', customer.id, 'Customer added', customer.name);
    this.pendingCustomerIds.add(customer.id);
    this.persistAndRefresh(this.actionosApi.createCustomer({
      orgGroupId,
      name: input.name,
      type: input.type,
      externalGroupId: input.externalGroupId ?? null,
      primaryContactName: input.primaryContactName ?? null,
      primaryContactEmail: input.primaryContactEmail ?? null,
      primaryContactPhone: input.primaryContactPhone ?? null,
      accountOwnerUserId: input.accountOwnerEmployeeId ?? null
    }), {
      failureMessage: `Customer "${customer.name}" was not saved to ActionOS.`,
      onSuccess: (created) => this.promoteCustomerId(customer.id, created.id),
      onFailure: () => this.abandonLocalCustomer(customer.id)
    });
    return customer;
  }

  updateCustomer(id: string, changes: Partial<Customer>): Customer | null {
    const updated = this.customerRepo.update(this.resolveCustomerId(id), changes);
    if (updated) {
      this.recordActivity('member', updated.id, 'Customer updated', updated.name);
      if (updated.id.toLowerCase().startsWith('local-')) {
        this.runCustomerMutation(
          updated.id,
          (customerId) => this.actionosApi.updateCustomer(customerId, {
            name: changes.name !== undefined ? changes.name : undefined,
            type: changes.type !== undefined ? changes.type : undefined,
            status: changes.status !== undefined ? changes.status : undefined,
            externalGroupId: changes.externalGroupId !== undefined ? changes.externalGroupId : undefined,
            primaryContactName: changes.primaryContactName !== undefined ? changes.primaryContactName : undefined,
            primaryContactEmail: changes.primaryContactEmail !== undefined ? changes.primaryContactEmail : undefined,
            primaryContactPhone: changes.primaryContactPhone !== undefined ? changes.primaryContactPhone : undefined,
            accountOwnerUserId: changes.accountOwnerEmployeeId !== undefined ? changes.accountOwnerEmployeeId : undefined
          }),
          `Customer "${updated.name}" was not updated in ActionOS.`
        );
      }
    }
    return updated;
  }

  promoteProspect(id: string, externalGroupId: string): Customer | null {
    const updated = this.customerRepo.promoteProspect(this.resolveCustomerId(id), externalGroupId);
    if (updated) {
      this.recordActivity('member', updated.id, 'Prospect promoted', updated.name);
      if (updated.id.toLowerCase().startsWith('local-')) {
        this.runCustomerMutation(
          updated.id,
          (customerId) => this.actionosApi.promoteProspect(customerId, externalGroupId),
          `Customer "${updated.name}" was not promoted in ActionOS.`
        );
      }
    }
    return updated;
  }

  // Employees — read-only Fritz directory

  get employees(): Employee[] {
    // Returns only active users from the combined assignable directory.
    if (this.sortedEmployeeSource !== this.employeeStore.employees) {
      this.sortedEmployeeSource = this.employeeStore.employees;
      this.sortedEmployees = this.employeeStore.employees
        .filter((employee) => employee.isActive)
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
    return this.sortedEmployees;
  }

  get allEmployees(): Employee[] {
    // Full directory list (for debugging / display of inactive history)
    return this.employeeStore.employees.slice();
  }

  employee(id: string): Employee | undefined {
    return this.employeeById().get(id);
  }

  employeeName(id: string | undefined): string {
    if (!id) {
      return '—';
    }
    return this.employeeById().get(id)?.fullName ?? '—';
  }

  isAssignable(id: string): boolean {
    return this.employeeById().get(id)?.isActive ?? false;
  }

  private employeeById(): Map<string, Employee> {
    if (this.employeeByIdCache.revision !== this.dataRevision) {
      this.employeeByIdCache.revision = this.dataRevision;
      this.employeeByIdCache.value = new Map(this.employeeStore.employees.map(employee => [employee.id, employee]));
    }
    return this.employeeByIdCache.value;
  }

  // Customer meetings

  get customerMeetings(): CustomerMeeting[] {
    if (this.customerMeetingsCache.revision !== this.dataRevision) {
      this.customerMeetingsCache.revision = this.dataRevision;
      this.customerMeetingsCache.value = this.customerMeetingStore.customerMeetings
        .slice()
        .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
    }
    return this.customerMeetingsCache.value;
  }

  customerMeeting(id: string): CustomerMeeting | undefined {
    return this.customerMeetingRepo.get(this.resolveMeetingId(id));
  }

  customerMeetingsByCustomer(customerId: string): CustomerMeeting[] {
    const ids = this.clientLookupIds(customerId);
    if (!ids.length) {
      return this.emptyMeetings;
    }
    const map = this.customerMeetingsByCustomerMap();
    const byId = new Map<string, CustomerMeeting>();
    ids.forEach(id => (map.get(id) ?? []).forEach(meeting => byId.set(meeting.id, meeting)));
    return byId.size ? [...byId.values()] : this.emptyMeetings;
  }

  private customerMeetingsByCustomerMap(): Map<string, CustomerMeeting[]> {
    if (this.customerMeetingsByCustomerCache.revision !== this.dataRevision) {
      const byCustomerId = new Map<string, CustomerMeeting[]>();
      for (const meeting of this.customerMeetings) {
        for (const clientId of this.clientLookupIds(meeting.customerId)) {
          const list = byCustomerId.get(clientId) ?? [];
          list.push(meeting);
          byCustomerId.set(clientId, list);
        }
      }
      this.customerMeetingsByCustomerCache.revision = this.dataRevision;
      this.customerMeetingsByCustomerCache.value = byCustomerId;
    }
    return this.customerMeetingsByCustomerCache.value;
  }

  /**
   * Whether a meeting's status chip should be displayed. Only the "completed"
   * stages — Tasks Created and Closed — show a status label; earlier draft stages
   * (Planned / Draft Summary) render no chip. The meeting itself is always shown;
   * this only controls the status badge.
   */
  shouldShowMeetingStatus(status: CustomerMeetingStatus): boolean {
    return status === 'Tasks Created' || status === 'Closed';
  }

  addCustomerMeeting(input: CreateCustomerMeetingInput): CustomerMeeting {
    const customerId = this.canonicalCustomerId(input.customerId);
    const meeting = this.customerMeetingRepo.add({ ...input, customerId });
    const localMeetingId = meeting.id;
    this.recordActivity('meeting', meeting.id, 'Customer meeting created', meeting.subject);
    const meetingDate = new Date(input.meetingDate);
    if (Number.isNaN(meetingDate.getTime())) {
      this.reportBackendIssue(`Meeting "${meeting.subject}" was not saved because its date is invalid.`);
      return meeting;
    }

    const createAndPromote = (persistedCustomerId: string) =>
      this.actionosApi.createCustomerMeeting(persistedCustomerId, {
        subject: input.subject,
        meetingDateUtc: meetingDate.toISOString(),
        meetingLeaderUserId: input.meetingLeaderEmployeeId,
        goal: input.goal ?? null,
        summary: null,
        status: 'Planned',
        participants: [
          {
            isInternal: true,
            userId: input.meetingLeaderEmployeeId,
            displayName: this.employeeName(input.meetingLeaderEmployeeId),
            email: this.employee(input.meetingLeaderEmployeeId)?.email ?? null,
            phone: null,
            role: 'Meeting Leader'
          },
          ...(input.internalParticipantEmployeeIds ?? []).map((employeeId) => ({
            isInternal: true,
            userId: employeeId,
            displayName: this.employeeName(employeeId),
            email: this.employee(employeeId)?.email ?? null,
            phone: null,
            role: 'Participant'
          })),
          // Our-side guests: internal but not a system user (no userId). Recorded on this
          // meeting only — never seeded into future meetings.
          ...(input.internalGuestParticipants ?? []).map((guest) => ({
            isInternal: true,
            userId: null,
            displayName: guest.name,
            email: guest.email ?? null,
            phone: guest.phone ?? null,
            role: guest.role ?? 'Guest'
          })),
          ...(input.customerParticipants ?? []).map((participant) => ({
            isInternal: false,
            userId: null,
            displayName: participant.name,
            email: participant.email ?? null,
            phone: participant.phone ?? null,
            role: participant.role ?? null
          }))
        ]
      }).then((created) => {
        this.promoteMeetingId(localMeetingId, created.id.toString());
        return created;
      }).catch((error) => {
        this.abandonLocalMeeting(localMeetingId);
        throw error;
      });

    this.runCustomerMutation(
      customerId,
      createAndPromote,
      `Meeting "${meeting.subject}" was not saved to ActionOS.`
    );
    return meeting;
  }

  updateCustomerMeetingSummary(
    meetingId: string,
    changes: UpdateCustomerMeetingInput
  ): CustomerMeeting | null {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    const updated = this.customerMeetingRepo.update(resolvedMeetingId, changes);
    if (updated) {
      this.recordActivity('meeting', updated.id, 'Customer meeting updated', updated.subject);
      const participantsChanged = changes.internalParticipantEmployeeIds !== undefined || changes.internalGuestParticipants !== undefined || changes.customerParticipants !== undefined;
      const meetingLeaderEmployeeId = changes.meetingLeaderEmployeeId ?? updated.meetingLeaderEmployeeId;
      const internalParticipantEmployeeIds = Array.from(new Set([
        meetingLeaderEmployeeId,
        ...(changes.internalParticipantEmployeeIds ?? updated.internalParticipantEmployeeIds)
      ].filter((employeeId): employeeId is string => !!employeeId)));
      const payload = {
        subject: changes.subject !== undefined ? changes.subject : undefined,
        meetingDateUtc: changes.meetingDate !== undefined
          ? (changes.meetingDate ? new Date(changes.meetingDate).toISOString() : null)
          : undefined,
        meetingLeaderUserId: changes.meetingLeaderEmployeeId !== undefined ? changes.meetingLeaderEmployeeId : undefined,
        goal: changes.goal !== undefined ? changes.goal : undefined,
        summary: changes.summary !== undefined ? changes.summary : undefined,
        publishedRecap: changes.publishedRecap !== undefined ? changes.publishedRecap : undefined,
        nextMeetingDateUtc: changes.nextMeetingDate !== undefined
          ? (changes.nextMeetingDate ? new Date(changes.nextMeetingDate).toISOString() : null)
          : undefined,
        nextMeetingNotes: changes.nextMeetingNotes !== undefined ? changes.nextMeetingNotes : undefined,
        status: changes.status !== undefined ? changes.status : undefined,
        participants: participantsChanged
          ? [
              ...(internalParticipantEmployeeIds.map((employeeId) => ({
                isInternal: true,
                userId: employeeId,
                displayName: this.employeeName(employeeId),
                email: this.employee(employeeId)?.email ?? null,
                phone: null,
                role: employeeId === meetingLeaderEmployeeId ? 'Meeting Leader' : 'Participant'
              }))),
              ...((changes.internalGuestParticipants ?? updated.internalGuestParticipants ?? []).map((guest) => ({
                isInternal: true,
                userId: null,
                displayName: guest.name,
                email: guest.email ?? null,
                phone: guest.phone ?? null,
                role: guest.role ?? 'Guest'
              }))),
              ...((changes.customerParticipants ?? updated.customerParticipants).map((participant) => ({
                isInternal: false,
                userId: null,
                displayName: participant.name,
                email: participant.email ?? null,
                phone: participant.phone ?? null,
                role: participant.role ?? null
              })))
            ]
          : undefined
      };
      this.runMeetingMutation(resolvedMeetingId, (meetingIdNumeric) =>
        this.actionosApi.updateCustomerMeeting(meetingIdNumeric, payload)
      );
    }
    return updated;
  }

  addCustomerMeetingNote(
    meetingId: string,
    input: CreateMeetingNoteInput
  ): MeetingNote | null {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    const noteId = `cnote-${this.nextCustomerMeetingNoteNumber++}`;
    const note = this.customerMeetingRepo.addNote(
      resolvedMeetingId,
      input,
      noteId,
      this.currentEmployeeId,
    );
    if (note) {
      this.recordActivity('meeting', resolvedMeetingId, 'Meeting note added', note.content);
      this.runMeetingMutation(resolvedMeetingId, (meetingIdNumeric) =>
        this.actionosApi.createCustomerMeetingNote(meetingIdNumeric, {
          noteType: input.type,
          content: input.content,
          ownerUserId: input.ownerId ?? null,
          dueDateUtc: input.dueDate ? new Date(`${input.dueDate}T12:00:00.000Z`).toISOString() : null
        }).then((created) => {
          this.promoteMeetingNoteId(resolvedMeetingId, noteId, created);
          return created;
        }).catch((error) => {
          this.abandonLocalMeetingNote(resolvedMeetingId, noteId);
          throw error;
        })
      );
    }
    return note;
  }

  updateCustomerMeetingNote(
    meetingId: string,
    noteId: string,
    changes: UpdateMeetingNoteInput
  ): MeetingNote | null {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    const resolvedNoteId = this.resolveMeetingNoteId(noteId);
    const updated = this.customerMeetingRepo.updateNote(resolvedMeetingId, resolvedNoteId, changes);
    if (updated) {
      this.recordActivity('meeting', resolvedMeetingId, 'Meeting note updated', updated.content);
      this.runMeetingNoteMutation(resolvedMeetingId, resolvedNoteId, (meetingIdNumeric, noteIdNumeric) =>
        this.actionosApi.updateCustomerMeetingNote(meetingIdNumeric, noteIdNumeric, {
          noteType: changes.type ?? null,
          content: changes.content ?? null,
          ownerUserId: changes.ownerId ?? null,
          dueDateUtc: changes.dueDate ? new Date(`${changes.dueDate}T12:00:00.000Z`).toISOString() : null
        })
      );
    }
    return updated;
  }

  removeCustomerMeetingNote(meetingId: string, noteId: string): boolean {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    const resolvedNoteId = this.resolveMeetingNoteId(noteId);
    const removed = this.customerMeetingRepo.removeNote(resolvedMeetingId, resolvedNoteId);
    if (removed) {
      this.recordActivity('meeting', resolvedMeetingId, 'Meeting note removed', noteId);
      this.runMeetingNoteMutation(resolvedMeetingId, resolvedNoteId, (meetingIdNumeric, noteIdNumeric) =>
        this.actionosApi.deleteCustomerMeetingNote(meetingIdNumeric, noteIdNumeric)
      );
    }
    return removed;
  }

  /**
   * Builds a multi-section recap for a customer meeting and saves it as the
   * meeting's summary. Sets status to Closed. Returns the recap string so the
   * caller can also surface it (e.g. for a "Copy to clipboard" affordance).
   */
  publishMeetingRecap(meetingId: string): string | null {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    const meeting = this.customerMeetingRepo.get(resolvedMeetingId);
    if (!meeting) {
      return null;
    }
    const customer = this.customer(meeting.customerId);
    const leaderName = this.employeeName(meeting.meetingLeaderEmployeeId);
    const internalNames = [
      ...meeting.internalParticipantEmployeeIds
        .map((id) => this.employeeName(id))
        .filter((n) => n && n !== '—'),
      ...(meeting.internalGuestParticipants ?? []).map((g) => g.name).filter(Boolean)
    ];
    const customerNames = meeting.customerParticipants.map((p) => p.name).filter(Boolean);

    const decisions = meeting.notes.filter((n) => n.type === 'decision');
    const blockers = meeting.notes.filter((n) => n.type === 'blocker');
    const otherNotes = meeting.notes.filter((n) => n.type === 'note');
    // Action notes not yet promoted to a task — the pre-publish checklist flags these,
    // so the recap must list them too (otherwise they vanish on publish).
    const openActions = meeting.notes.filter((n) => n.type === 'action' && !n.convertedTaskId);
    const tasksFromMeeting = this.meetingTasksByMeeting(meeting.id);

    const t = (key: string, params?: Record<string, string | number>) => this.i18n.translate(key, params);

    const lines: string[] = [];
    lines.push(`${t('recap.title')} — ${meeting.subject}`);
    lines.push(`${meeting.meetingDate.slice(0, 10)} · ${customer?.name ?? t('recap.unknownCustomer')}`);
    lines.push('');
    lines.push(`${t('recap.ledBy')}: ${leaderName}`);
    if (internalNames.length) {
      lines.push(`${t('recap.ourSide')}: ${internalNames.join(', ')}`);
    }
    if (customerNames.length) {
      lines.push(`${t('recap.customerSide')}: ${customerNames.join(', ')}`);
    }
    if (meeting.goal?.trim()) {
      lines.push('');
      lines.push(`${t('recap.goal')}: ${meeting.goal.trim()}`);
    }
    if (meeting.summary?.trim()) {
      lines.push('');
      lines.push(`${t('recap.whatHappened')}:`);
      lines.push(meeting.summary.trim());
    }
    if (decisions.length) {
      lines.push('');
      lines.push(`${t('recap.decisions')}:`);
      for (const d of decisions) {
        lines.push(`• ${d.content}`);
      }
    }
    if (tasksFromMeeting.length) {
      lines.push('');
      lines.push(`${t('recap.tasksCreated')}:`);
      for (const tk of tasksFromMeeting) {
        const owner = this.employeeName(tk.assignedToEmployeeId);
        const due = tk.dueDate ? ` · ${t('recap.due')} ${tk.dueDate}` : '';
        lines.push(`• ${tk.title} — ${owner}${due} [${tk.status}]`);
        if (tk.progressionNotes?.length) {
          for (const pn of tk.progressionNotes) {
            const author = this.employeeName(pn.authorEmployeeId);
            lines.push(`  ↳ ${pn.createdAt.slice(0, 10)} (${author}): ${pn.content}`);
          }
        }
      }
    }
    if (openActions.length) {
      lines.push('');
      lines.push(`${t('recap.followups')}:`);
      for (const a of openActions) {
        const owner = a.ownerId ? ` — ${this.employeeName(a.ownerId)}` : '';
        const due = a.dueDate ? ` · ${t('recap.due')} ${a.dueDate}` : '';
        lines.push(`• ${a.content}${owner}${due}`);
      }
    }
    if (blockers.length) {
      lines.push('');
      lines.push(`${t('recap.blockers')}:`);
      for (const b of blockers) {
        lines.push(`• ${b.content}`);
      }
    }
    if (otherNotes.length) {
      lines.push('');
      lines.push(`${t('recap.notes')}:`);
      for (const n of otherNotes) {
        lines.push(`• ${n.content}`);
      }
    }
    if (meeting.nextMeetingDate) {
      lines.push('');
      lines.push(`${t('recap.nextMeeting')}: ${meeting.nextMeetingDate.slice(0, 10)}`);
    }
    if (meeting.nextMeetingNotes?.trim()) {
      lines.push('');
      lines.push(`${t('recap.notesForNext')}:`);
      lines.push(meeting.nextMeetingNotes.trim());
    }
    const recap = lines.join('\n');

    // Publishing the recap ONLY saves the recap — it never changes the meeting's
    // status. Status is derived from the meeting's tasks (see syncMeetingStatusFromTasks):
    // a meeting is "Closed/Done" only once every task born from it is Done.
    this.customerMeetingRepo.update(resolvedMeetingId, { publishedRecap: recap });
    this.recordActivity('meeting', resolvedMeetingId, 'Recap published', meeting.subject);

    this.runMeetingMutation(resolvedMeetingId, (meetingIdNumeric) =>
      this.actionosApi.updateCustomerMeeting(meetingIdNumeric, {
        subject: null,
        meetingDateUtc: null,
        meetingLeaderUserId: null,
        goal: null,
        summary: meeting.summary ?? null,
        publishedRecap: recap,
        nextMeetingDateUtc: meeting.nextMeetingDate ? new Date(`${meeting.nextMeetingDate}T12:00:00.000Z`).toISOString() : null,
        nextMeetingNotes: meeting.nextMeetingNotes ?? null,
        status: null,
        participants: null
      })
    );
    return recap;
  }

  // Meeting tasks

  get meetingTasks(): Task[] {
    return this.allTasks;
  }

  /** True while a task is still an in-memory draft (not yet persisted to the
   *  backend). The meeting link can only be set at creation, so the task form
   *  offers the meeting picker only for unsaved drafts. */
  isUnsavedDraft(id: string): boolean {
    return this.quickCaptureTaskDraft?.id === id || this.embeddedTaskDraft?.id === id;
  }

  saveMeetingTaskDraft(id: string): Task | null {
    const resolvedTaskId = this.resolveTaskId(id);
    if (this.quickCaptureTaskDraft?.id === resolvedTaskId) {
      const saved = this.persistTaskDraft(this.quickCaptureTaskDraft);
      if (!saved) {
        return null;
      }
      this.quickCaptureTaskDraft = null;
      this.drawerOpen = true;
      return saved;
    }
    if (this.embeddedTaskDraft?.id === resolvedTaskId) {
      const saved = this.persistTaskDraft(this.embeddedTaskDraft);
      if (!saved) {
        return null;
      }
      this.embeddedTaskDraft = null;
      return saved;
    }
    return this.Task(resolvedTaskId) ?? null;
  }

  Task(id: string): Task | undefined {
    if (this.quickCaptureTaskDraft?.id === id) {
      return this.quickCaptureTaskDraft;
    }
    if (this.embeddedTaskDraft?.id === id) {
      return this.embeddedTaskDraft;
    }
    const resolvedTaskId = this.resolveTaskId(id);
    return this.allTasks.find(task => task.id === resolvedTaskId);
  }

  meetingTasksByCustomer(customerId: string): Task[] {
    const ids = this.clientLookupIds(customerId);
    if (!ids.length) {
      return this.emptyTasks;
    }
    const map = this.meetingTasksByCustomerMap();
    const byId = new Map<string, Task>();
    ids.forEach(id => (map.get(id) ?? []).forEach(task => byId.set(task.id, task)));
    return byId.size ? [...byId.values()] : this.emptyTasks;
  }

  meetingTasksByMeeting(meetingId: string): Task[] {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    return this.meetingTasksByMeetingMap().get(resolvedMeetingId) ?? this.emptyTasks;
  }

  private meetingTasksByCustomerMap(): Map<string, Task[]> {
    if (this.meetingTasksByCustomerCache.revision !== this.dataRevision) {
      const byCustomerId = new Map<string, Task[]>();
      for (const task of this.meetingTasks) {
        if (!task.customerId) {
          continue;
        }
        for (const clientId of this.clientLookupIds(task.customerId)) {
          const list = byCustomerId.get(clientId) ?? [];
          list.push(task);
          byCustomerId.set(clientId, list);
        }
      }
      this.meetingTasksByCustomerCache.revision = this.dataRevision;
      this.meetingTasksByCustomerCache.value = byCustomerId;
    }
    return this.meetingTasksByCustomerCache.value;
  }

  private meetingTasksByMeetingMap(): Map<string, Task[]> {
    if (this.meetingTasksByMeetingCache.revision !== this.dataRevision) {
      const byMeetingId = new Map<string, Task[]>();
      for (const task of this.meetingTasks) {
        if (!task.sourceMeetingId) {
          continue;
        }
        const list = byMeetingId.get(task.sourceMeetingId) ?? [];
        list.push(task);
        byMeetingId.set(task.sourceMeetingId, list);
      }
      this.meetingTasksByMeetingCache.revision = this.dataRevision;
      this.meetingTasksByMeetingCache.value = byMeetingId;
    }
    return this.meetingTasksByMeetingCache.value;
  }

  meetingTasksAssignedToMe(): Task[] {
    return this.meetingTasks.filter(task => task.assignedToEmployeeId === this.currentEmployeeId);
  }

  meetingTasksOpenedBy(employeeId: string): Task[] {
    return this.meetingTasks.filter(task => task.openedByEmployeeId === employeeId);
  }

  /**
   * Convert a meeting note (or anonymous task input) into a meeting task.
   * Validates the assignee is in the active combined directory.
   * Fires the "task assigned" notification automatically.
   */
  createTaskFromMeeting(
    meetingId: string,
    input: CreateMeetingTaskInput,
    sourceNoteId?: string
  ): Task | null {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    const meeting = this.customerMeetingRepo.get(resolvedMeetingId);
    if (!meeting) {
      return null;
    }
    if (!this.isAssignable(input.assignedToEmployeeId)) {
      // eslint-disable-next-line no-console
      console.warn('[ActionOS] Refused to assign task to inactive or unknown directory user:', input.assignedToEmployeeId);
      return null;
    }

    const now = new Date().toISOString();
    const assigneeMemberId = this.memberIdForEmployee(input.assignedToEmployeeId);
    const creatorMemberId = this.memberIdForEmployee(this.currentEmployeeId) ?? this.currentUserId;
    const task: Task = {
      id: `task-${this.nextTaskNumber++}`,
      source: 'meeting',
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      board: this.clientName(meeting.customerId) ?? 'Customer meeting',
      customerId: meeting.customerId,
      sourceMeetingId: resolvedMeetingId,
      openedByEmployeeId: this.currentEmployeeId,
      assignedToEmployeeId: input.assignedToEmployeeId,
      assigneeIds: assigneeMemberId ? [assigneeMemberId] : [],
      priority: input.priority ?? 'Medium',
      dueDate: input.dueDate ?? this.addDays(this.todayIso, 3),
      status: 'New',
      attachmentIds: [],
      watcherIds: creatorMemberId ? [creatorMemberId] : [],
      watcherEmployeeIds: Array.from(new Set([this.currentEmployeeId, input.assignedToEmployeeId])),
      checklist: [
        { label: 'Confirm owner acknowledgement', done: false },
        { label: 'Capture outcome for next meeting', done: false }
      ],
      notifications: [],
      createdByUserId: creatorMemberId,
      createdAt: now,
      updatedAt: now
    };
    this.tasksState = [task, ...this.tasksState];

    const resolvedSourceNoteId = sourceNoteId ? this.resolveMeetingNoteId(sourceNoteId) : undefined;
    if (resolvedSourceNoteId) {
      this.customerMeetingRepo.linkNoteToTask(resolvedMeetingId, resolvedSourceNoteId, task.id);
      this.cloneNoteAttachmentsToTask(resolvedMeetingId, resolvedSourceNoteId, task.id);
    }

    // A newly created task is open, so the meeting now has open work → "Tasks Created"
    // (this also reopens a meeting that had been Closed once all prior tasks were done).
    if (meeting.status !== 'Tasks Created') {
      this.customerMeetingRepo.setStatus(meeting.id, 'Tasks Created');
    }

    this.recordActivity('task', task.id, 'Meeting task created', task.title);
    this.saveToStorage();

    const localTaskId = task.id;
    const orgGroupId = this.getOrgGroupForMutation();
    if (orgGroupId) {
      if (resolvedSourceNoteId) {
        this.runMeetingNoteMutation(resolvedMeetingId, resolvedSourceNoteId, (meetingIdNumeric, noteIdNumeric) =>
          this.actionosApi.convertMeetingNoteToTask(meetingIdNumeric, noteIdNumeric, {
            title: input.title,
            assignedUserId: input.assignedToEmployeeId,
            priority: input.priority ?? 'Medium',
            dueDateUtc: (input.dueDate ?? task.dueDate) ? new Date(`${input.dueDate ?? task.dueDate}T12:00:00.000Z`).toISOString() : null,
            waitingReason: null
          }).then((created) => {
            this.promoteTaskId(localTaskId, created.id.toString());
            return created;
          }).catch((error) => {
            this.abandonLocalTask(localTaskId);
            throw error;
          })
        );
      } else {
        this.runMeetingMutation(resolvedMeetingId, (meetingIdNumeric) =>
          this.actionosApi.createTask({
            orgGroupId,
            boardId: null,
            customerId: task.customerId || null,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            sourceType: 'meeting',
            sourceMeetingId: meetingIdNumeric,
            waitingReason: null,
            treatmentNotes: task.treatmentNotes ?? null,
            assignedUserId: task.assignedToEmployeeId,
            dueDateUtc: task.dueDate ? new Date(`${task.dueDate}T12:00:00.000Z`).toISOString() : null,
            checklistItems: task.checklist.map((item, index) => ({
              label: item.label,
              isDone: item.done,
              sortOrder: index
            }))
          }).then((created) => {
            this.promoteTaskId(localTaskId, created.id.toString());
            return created;
          }).catch((error) => {
            this.abandonLocalTask(localTaskId);
            throw error;
          })
        );
      }
    }
    return task;
  }

  addTaskProgressionNote(taskId: string, content: string): Task | null {
    const task = this.Task(taskId);
    if (!task || !content.trim()) {
      return null;
    }
    const note = {
      id: `pnote-${taskId}-${(task.progressionNotes?.length ?? 0) + 1}`,
      content: content.trim(),
      authorEmployeeId: this.currentEmployeeId,
      createdAt: new Date().toISOString()
    };
    return this.updateMeetingTask(taskId, {
      progressionNotes: [...(task.progressionNotes ?? []), note]
    });
  }

  removeAttachment(id: string): void {
    this.attachments.remove(id);
    const attachmentId = this.parseNumericId(id);
    if (attachmentId != null) {
      this.persistAndRefresh(this.actionosApi.deleteAttachment(attachmentId));
    }
  }

  canCloseMeeting(meetingId: string): boolean {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    const tasks = this.meetingTasksByMeeting(resolvedMeetingId);
    if (!tasks.length) {
      return true;
    }
    return tasks.every(t => t.status === 'Done' || t.status === 'Cancelled');
  }

  /**
   * Keeps a meeting's status in lock-step with the tasks born from it:
   *   has tasks, all Done/Cancelled → Closed
   *   has tasks, at least one open  → Tasks Created
   *   no tasks                      → left as-is (Planned / Draft Summary)
   * So a meeting is "done" ONLY when every one of its tasks is done, and reopening
   * a task automatically reverts the meeting from Closed back to Tasks Created.
   */
  private syncMeetingStatusFromTasks(meetingId: string): void {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    const meeting = this.customerMeetingRepo.get(resolvedMeetingId);
    if (!meeting) {
      return;
    }
    const tasks = this.meetingTasksByMeeting(resolvedMeetingId);
    if (!tasks.length) {
      return;
    }
    const allDone = tasks.every(t => t.status === 'Done' || t.status === 'Cancelled');
    const desired: CustomerMeetingStatus = allDone ? 'Closed' : 'Tasks Created';
    if (meeting.status === desired) {
      return;
    }
    this.customerMeetingRepo.setStatus(resolvedMeetingId, desired);
    this.recordActivity(
      'meeting',
      resolvedMeetingId,
      allDone ? 'Meeting closed - all tasks done' : 'Meeting reopened - task still open',
      meeting.subject
    );
  }

  updateMeetingTask(id: string, changes: UpdateMeetingTaskInput, statusChangeReason?: string): Task | null {
    const resolvedTaskId = this.resolveTaskId(id);
    const before = this.Task(resolvedTaskId);
    if (!before) {
      return null;
    }
    const previousStatus = before.status;
    const next: UpdateMeetingTaskInput = { ...changes };
    const normalizedStatusChangeReason = statusChangeReason?.trim();

    if (next.customerId !== undefined) {
      next.customerId = this.resolveCustomerId(next.customerId).trim();
    }

    if (next.assignedToEmployeeId && !this.isAssignable(next.assignedToEmployeeId)) {
      // eslint-disable-next-line no-console
      console.warn('[ActionOS] Refused to reassign task to inactive or unknown directory user:', next.assignedToEmployeeId);
      delete next.assignedToEmployeeId;
    }

    if (next.status && next.status !== previousStatus) {
      // Custom statuses (and moves away from a custom status) have no transition
      // rules — they can be set freely. Only built-in→built-in moves are gated.
      const transitionAllowed =
        this.isCustomStatus(next.status) ||
        this.isCustomStatus(previousStatus) ||
        this.canTransitionMeetingTask(previousStatus, next.status);
      if (!transitionAllowed) {
        // eslint-disable-next-line no-console
        console.warn('[ActionOS] Invalid meeting task status transition:', previousStatus, '->', next.status);
        delete next.status;
      } else if (!normalizedStatusChangeReason) {
        // eslint-disable-next-line no-console
        console.warn('[ActionOS] A status change reason is required.');
        return null;
      } else if (
        (next.status === 'Waiting For Customer' || next.status === 'Waiting For Internal') &&
        !(next.waitingReason?.trim() || before.waitingReason?.trim())
      ) {
        // eslint-disable-next-line no-console
        console.warn('[ActionOS] Waiting statuses require a waiting reason.');
        return null;
      } else if (next.status === 'Done') {
        next.completedAt = new Date().toISOString();
      } else if (previousStatus === 'Done') {
        next.completedAt = undefined;
      }
      if (next.status !== 'Waiting For Customer' && next.status !== 'Waiting For Internal' && next.waitingReason === undefined) {
        next.waitingReason = undefined;
      }
    }

    if (next.treatmentNotes !== undefined) {
      next.treatmentNotes = next.treatmentNotes.trim();
    }
    if (this.quickCaptureTaskDraft?.id === resolvedTaskId) {
      return this.updateQuickCaptureTaskDraft(next);
    }
    if (this.embeddedTaskDraft?.id === resolvedTaskId) {
      return this.updateEmbeddedTaskDraft(next);
    }
    const index = this.tasksState.findIndex(task => task.id === resolvedTaskId);
    if (index < 0) {
      return null;
    }
    const updated: Task = {
      ...this.tasksState[index],
      ...next,
      board: next.customerId
        ? (this.clientName(next.customerId) ?? this.tasksState[index].board)
        : this.tasksState[index].board,
      updatedAt: new Date().toISOString()
    };
    this.tasksState = this.tasksState.map(task => task.id === resolvedTaskId ? updated : task);

    this.recordActivity('task', updated.id, 'Meeting task updated', updated.title);
    this.saveToStorage();

    this.runTaskMutation(updated.id, (taskIdNumeric) =>
      this.actionosApi.updateTask(taskIdNumeric, {
        title: next.title !== undefined ? next.title : undefined,
        description: next.description !== undefined ? next.description : undefined,
        customerId: next.customerId !== undefined ? (next.customerId || null) : undefined,
        status: next.status !== undefined ? next.status : undefined,
        statusChangeReason: next.status !== undefined && next.status !== previousStatus
          ? normalizedStatusChangeReason
          : undefined,
        priority: next.priority !== undefined ? next.priority : undefined,
        waitingReason: next.waitingReason !== undefined ? next.waitingReason : undefined,
        treatmentNotes: next.treatmentNotes !== undefined ? next.treatmentNotes : undefined,
        assignedUserId: next.assignedToEmployeeId !== undefined ? next.assignedToEmployeeId : undefined,
        dueDateUtc: next.dueDate !== undefined
          ? (next.dueDate ? new Date(`${next.dueDate}T12:00:00.000Z`).toISOString() : null)
          : undefined
      })
    );

    if ((next.progressionNotes?.length ?? 0) > (before.progressionNotes?.length ?? 0)) {
      const latestNote = next.progressionNotes?.[next.progressionNotes.length - 1];
      if (latestNote?.content?.trim()) {
        this.runTaskMutation(updated.id, (taskIdNumeric) =>
          this.actionosApi.addTaskActivityNote(taskIdNumeric, 'progress', latestNote.content.trim())
        );
      }
    }

    if (next.status && next.status !== previousStatus && updated.sourceMeetingId) {
      this.syncMeetingStatusFromTasks(updated.sourceMeetingId);
    }

    return updated;
  }

  private updateQuickCaptureTaskDraft(changes: UpdateMeetingTaskInput): Task | null {
    const draft = this.quickCaptureTaskDraft;
    if (!draft) {
      return null;
    }

    const updated = this.applyQuickCaptureDraftChanges(draft, changes);
    this.quickCaptureTaskDraft = updated;
    return updated;
  }

  /**
   * Embedded Tasks-page draft counterpart of `updateQuickCaptureTaskDraft`.
   * Keeps draft edits in memory until the form asks to save explicitly.
   */
  private updateEmbeddedTaskDraft(changes: UpdateMeetingTaskInput): Task | null {
    const draft = this.embeddedTaskDraft;
    if (!draft) {
      return null;
    }

    const updated = this.applyQuickCaptureDraftChanges(draft, changes);
    this.embeddedTaskDraft = updated;
    return updated;
  }

  private persistTaskDraft(draft: Task): Task | null {
    if (!draft.customerId || !draft.title.trim()) {
      return null;
    }
    return this.addTask({
      title: draft.title,
      description: draft.description,
      board: this.clientName(draft.customerId) ?? draft.board,
      source: draft.source,
      customerId: draft.customerId,
      sourceMeetingId: draft.sourceMeetingId || undefined,
      openedByEmployeeId: draft.openedByEmployeeId,
      assignedToEmployeeId: draft.assignedToEmployeeId,
      priority: draft.priority,
      status: draft.status,
      dueDate: draft.dueDate,
      assigneeId: draft.assigneeIds[0] || this.currentUserId,
      checklist: draft.checklist,
      watcherIds: draft.watcherIds,
      watcherEmployeeIds: draft.watcherEmployeeIds,
      waitingReason: draft.waitingReason,
      treatmentNotes: draft.treatmentNotes,
      completedAt: draft.completedAt
    });
  }

  private applyQuickCaptureDraftChanges(task: Task, changes: UpdateMeetingTaskInput): Task {
    const assignedToEmployeeId = changes.assignedToEmployeeId !== undefined
      ? changes.assignedToEmployeeId
      : task.assignedToEmployeeId;
    const assigneeMemberId = this.memberIdForEmployee(assignedToEmployeeId) || task.assigneeIds[0] || this.currentUserId;
    const customerId = changes.customerId !== undefined ? changes.customerId : task.customerId;
    const customerName = customerId ? this.clientName(customerId) : undefined;
    // A draft can be linked to one of the client's meetings before it's saved; the
    // link is sent to the backend as part of createTask. A linked draft is a meeting
    // task, otherwise a board task.
    const sourceMeetingId = changes.sourceMeetingId !== undefined ? changes.sourceMeetingId.trim() : task.sourceMeetingId;
    const hasWaitingReason = Object.prototype.hasOwnProperty.call(changes, 'waitingReason');
    const hasTreatmentNotes = Object.prototype.hasOwnProperty.call(changes, 'treatmentNotes');
    const hasCompletedAt = Object.prototype.hasOwnProperty.call(changes, 'completedAt');
    const hasProgressionNotes = Object.prototype.hasOwnProperty.call(changes, 'progressionNotes');
    const hasChecklist = Object.prototype.hasOwnProperty.call(changes, 'checklist');

    return {
      ...task,
      title: changes.title !== undefined ? (changes.title.trim() || task.title) : task.title,
      description: changes.description !== undefined ? changes.description : task.description,
      board: customerName ?? task.board,
      customerId,
      sourceMeetingId,
      source: sourceMeetingId ? 'meeting' : 'board',
      status: changes.status ?? task.status,
      priority: changes.priority ?? task.priority,
      dueDate: changes.dueDate !== undefined ? changes.dueDate : task.dueDate,
      assignedToEmployeeId,
      assigneeIds: changes.assignedToEmployeeId !== undefined ? [assigneeMemberId] : task.assigneeIds,
      watcherEmployeeIds: Array.from(
        new Set([task.openedByEmployeeId, assignedToEmployeeId, ...task.watcherEmployeeIds].filter((id): id is string => !!id))
      ),
      waitingReason: hasWaitingReason ? changes.waitingReason : task.waitingReason,
      treatmentNotes: hasTreatmentNotes ? changes.treatmentNotes : task.treatmentNotes,
      completedAt: hasCompletedAt ? changes.completedAt : task.completedAt,
      progressionNotes: hasProgressionNotes ? changes.progressionNotes : task.progressionNotes,
      checklist: hasChecklist ? changes.checklist ?? [] : task.checklist,
      updatedAt: new Date().toISOString()
    };
  }

  meetingTaskChecklistProgress(task: Task): number {
    if (!task.checklist.length) {
      return 0;
    }
    const done = task.checklist.filter(item => item.done).length;
    return Math.round((done / task.checklist.length) * 100);
  }

  updateMeetingTaskChecklistItem(task: Task, checklistItem: ChecklistItem, done: boolean): void {
    const updatedChecklist = task.checklist.map(item =>
      item.label === checklistItem.label ? { ...item, done } : item
    );
    this.updateMeetingTask(task.id, { checklist: updatedChecklist });
    this.recordActivity('task', task.id, done ? 'Meeting task checklist completed' : 'Meeting task checklist reopened', checklistItem.label);

    const checklistId = this.resolveChecklistItemId(task, checklistItem);
    if (checklistId != null) {
      this.runTaskMutation(task.id, (taskIdNumeric) =>
        this.actionosApi.updateTaskChecklistItem(taskIdNumeric, checklistId, {
        label: null,
        isDone: done,
        sortOrder: null
        })
      );
    }
  }

  addMeetingTaskChecklistItem(task: Task, label: string): void {
    const trimmed = label.trim();
    if (!trimmed) {
      return;
    }
    this.updateMeetingTask(task.id, {
      checklist: [...task.checklist, { label: trimmed, done: false }]
    });
    this.recordActivity('task', task.id, 'Meeting task checklist item added', trimmed);

    this.runTaskMutation(task.id, (taskIdNumeric) =>
      this.actionosApi.addTaskChecklistItem(taskIdNumeric, trimmed, false)
    );
  }

  toggleMeetingTaskWatcher(task: Task, employeeId: string, checked: boolean): void {
    if (!this.isAssignable(employeeId)) {
      return;
    }
    const watcherEmployeeIds = checked
      ? Array.from(new Set([...task.watcherEmployeeIds, employeeId]))
      : task.watcherEmployeeIds.filter(id => id !== employeeId);
    this.updateMeetingTask(task.id, { watcherEmployeeIds });

    this.runTaskMutation(task.id, (taskIdNumeric) =>
      checked
        ? this.actionosApi.addTaskWatcher(taskIdNumeric, employeeId)
        : this.actionosApi.removeTaskWatcher(taskIdNumeric, employeeId)
    );
  }

  commentsForMeetingTask(taskId: string): Comment[] {
    return this.commentsForTask(taskId);
  }

  addMeetingTaskComment(taskId: string, body: string): void {
    const task = this.Task(taskId);
    if (!task) {
      return;
    }
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      return;
    }

    const comment: Comment = {
      id: `comment-${this.nextCommentNumber++}`,
      targetType: 'task',
      targetId: task.id,
      body: trimmedBody,
      createdByUserId: this.currentUserId,
      createdAt: new Date().toISOString()
    };

    this.commentsState = [comment, ...this.commentsState];
    this.recordActivity('task', task.id, 'Meeting task comment added', task.title);
    this.saveToStorage();

    this.runTaskMutation(task.id, (taskIdNumeric) =>
      this.actionosApi.addTaskNote(taskIdNumeric, trimmedBody)
    );
  }

  nudgeMeetingTaskOwner(task: Task): void {
    this.recordActivity('task', task.id, 'Reminder sent', task.title);
    this.saveToStorage();

    this.runTaskMutation(task.id, async (taskIdNumeric) => {
      await this.actionosApi.addTaskActivityNote(taskIdNumeric, 'reminder', 'Reminder sent to task owner.');
      if (task.dueDate) {
        await this.actionosApi.updateTask(taskIdNumeric, {
          dueDateUtc: new Date(`${task.dueDate}T12:00:00.000Z`).toISOString()
        });
      }
    });
  }

  runMeetingTaskReminderSweep(daysAhead = 2): number {
    const horizon = this.addDays(this.todayIso, daysAhead);
    const sentToday = this.todayIso;
    let sent = 0;
    this.openMeetingTasks.forEach(task => {
      if (!task.dueDate || task.dueDate > horizon) {
        return;
      }
      const alreadySentToday = task.notifications.some(
        n => n.event === 'due-soon' && n.recipientEmployeeId === task.assignedToEmployeeId && n.sentAt.slice(0, 10) === sentToday
      );
      if (alreadySentToday) {
        return;
      }
      this.nudgeMeetingTaskOwner(task);
      sent++;
    });
    if (sent) {
      this.recordActivity('task', 'meeting-task-sweep', 'Due-soon reminders sent', `${sent} reminder(s) sent.`);
    }
    return sent;
  }

  /**
   * Builds the pre-meeting briefing for a customer: prior meetings, open tasks,
   * overdue tasks, completed since the previous meeting, and waiting-for-customer.
   * This is the R8 view from the Hebrew brief.
   */
  getCustomerPreparationSummary(customerId: string): CustomerPreparationSummary {
    const resolvedCustomerId = this.resolveCustomerId(customerId);
    const today = this.todayIso;
    const meetings = this.customerMeetingRepo.listByCustomer(resolvedCustomerId);
    const allTasks = this.meetingTasksByCustomer(resolvedCustomerId);

    const openTasks = allTasks.filter((t) => this.isOpenMeetingTaskStatus(t.status));
    const overdueTasks = allTasks.filter((t) => this.isMeetingTaskOverdue(t));
    const waitingForCustomer = allTasks.filter((t) => t.status === 'Waiting For Customer');

    // "Completed since last meeting" — Done tasks updated after the most recent prior meeting
    const sortedMeetings = meetings.slice().sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
    const lastMeeting = sortedMeetings[sortedMeetings.length - 1];
    const completedSinceLastMeeting = lastMeeting
      ? allTasks.filter(
          (t) => t.status === 'Done' && t.updatedAt >= lastMeeting.meetingDate
        )
      : allTasks.filter((t) => t.status === 'Done');

    const nextMeetingDate = sortedMeetings
      .map((m) => m.nextMeetingDate)
      .filter((d): d is string => !!d)
      .sort()
      .pop();

    return {
      customerId: resolvedCustomerId,
      priorMeetings: meetings, // already sorted newest-first by listByCustomer
      openTasks,
      overdueTasks,
      completedSinceLastMeeting,
      waitingForCustomer,
      latestMeetingDate: lastMeeting?.meetingDate,
      nextMeetingDate
    };
  }

  // Attachments

  attachmentsFor(entityType: AttachmentEntityType, entityId: string): Attachment[] {
    return this.attachments.list(entityType, entityId);
  }

  noteAttachments(noteId: string): Attachment[] {
    return this.attachments.list('meeting-note', this.resolveMeetingNoteId(noteId));
  }

  canDownloadAttachment(attachment: Attachment): boolean {
    const url = (attachment.url ?? '').trim();
    return (this.parseNumericId(attachment.id) != null && this.isActionosStoredAttachmentUrl(url))
      || this.isDirectAttachmentUrl(url);
  }

  async downloadAttachment(attachment: Attachment): Promise<void> {
    const url = (attachment.url ?? '').trim();
    const attachmentId = this.parseNumericId(attachment.id);
    try {
      if (attachmentId != null && this.isActionosStoredAttachmentUrl(url)) {
        const blob = await this.actionosApi.downloadAttachment(attachmentId);
        this.triggerBlobDownload(blob, attachment.fileName);
        return;
      }

      if (this.isDirectAttachmentUrl(url)) {
        this.triggerUrlDownload(url, attachment.fileName);
        return;
      }

      this.reportBackendIssue(
        `Attachment "${attachment.fileName}" is not available for download.`,
        { message: 'The file was saved before ActionOS had binary attachment storage. Please re-attach it.' }
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[ActionOS] Attachment download failed.', error);
      this.reportBackendIssue(`ActionOS could not download "${attachment.fileName}".`, error);
    }
  }

  async uploadAttachment(
    file: File,
    entityType: AttachmentEntityType,
    entityId: string
  ): Promise<Attachment> {
    const attachment = await this.attachments.upload(file, entityType, entityId, this.currentEmployeeId);
    this.recordActivity('task', entityId, 'Attachment uploaded', attachment.fileName);
    const orgGroupId = this.getOrgGroupForMutation();
    if (orgGroupId) {
      if (entityType === 'meeting-task') {
        this.runTaskMutation(entityId, (taskIdNumeric) =>
          this.actionosApi.uploadAttachment({
            orgGroupId,
            entityType,
            entityId: taskIdNumeric.toString(),
            file
          })
        );
      } else {
        this.persistAndRefresh(this.actionosApi.uploadAttachment({
          orgGroupId,
          entityType,
          entityId,
          file
        }));
      }
    }
    return attachment;
  }

  private isActionosStoredAttachmentUrl(url: string): boolean {
    return url.toLowerCase().startsWith('local://actionos-attachments/');
  }

  private isDirectAttachmentUrl(url: string): boolean {
    return /^(blob:|data:|https?:\/\/)/i.test(url);
  }

  private triggerBlobDownload(blob: Blob, fileName: string): void {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      this.reportBackendIssue(`ActionOS could not download "${fileName}".`);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    this.triggerUrlDownload(objectUrl, fileName);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  private triggerUrlDownload(url: string, fileName: string): void {
    if (typeof document === 'undefined') {
      this.reportBackendIssue(`ActionOS could not download "${fileName}".`);
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName || 'attachment';
    anchor.rel = 'noopener';
    anchor.target = '_blank';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async uploadNoteAttachment(meetingId: string, noteId: string, file: File): Promise<Attachment | null> {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    const resolvedNoteId = this.resolveMeetingNoteId(noteId);
    const meeting = this.customerMeetingRepo.get(resolvedMeetingId);
    if (!meeting) {
      return null;
    }
    const attachment = await this.attachments.upload(file, 'meeting-note', resolvedNoteId, this.currentEmployeeId);
    const note = meeting.notes.find(n => n.id === resolvedNoteId);
    if (note) {
      const updatedIds = [...(note.attachmentIds ?? []), attachment.id];
      this.customerMeetingRepo.updateNote(resolvedMeetingId, resolvedNoteId, { attachmentIds: updatedIds });
    }
    const orgGroupId = this.getOrgGroupForMutation();
    if (orgGroupId) {
      this.runMeetingNoteMutation(resolvedMeetingId, resolvedNoteId, (_meetingIdNumeric, noteIdNumeric) =>
        this.actionosApi.uploadAttachment({
          orgGroupId,
          entityType: 'meeting-note',
          entityId: noteIdNumeric.toString(),
          file
        })
      );
    }
    return attachment;
  }

  cloneNoteAttachmentsToTask(meetingId: string, noteId: string, taskId: string): void {
    const resolvedMeetingId = this.resolveMeetingId(meetingId);
    const resolvedNoteId = this.resolveMeetingNoteId(noteId);
    const resolvedTaskId = this.resolveTaskId(taskId);
    const meeting = this.customerMeetingRepo.get(resolvedMeetingId);
    if (!meeting) {
      return;
    }
    const note = meeting.notes.find(n => n.id === resolvedNoteId);
    if (!note?.attachmentIds?.length) {
      return;
    }
    const newIds: string[] = [];
    for (const attachId of note.attachmentIds) {
      const copy = this.attachments.clone(attachId, 'meeting-task', resolvedTaskId);
      if (copy) {
        newIds.push(copy.id);
      }
    }
    if (newIds.length) {
      const task = this.Task(resolvedTaskId);
      if (task) {
        this.updateMeetingTask(resolvedTaskId, {
          progressionNotes: task.progressionNotes
        });
        const index = this.tasksState.findIndex(t => t.id === resolvedTaskId);
        if (index >= 0) {
          this.tasksState[index] = {
            ...this.tasksState[index],
            attachmentIds: [...(this.tasksState[index].attachmentIds ?? []), ...newIds]
          };
          this.saveToStorage();
        }
      }
    }
  }

  // Drawer integration for meeting tasks

  selectMeetingTask(task: Task, openDrawer = true): void {
    this.selectedTaskId = task.id;
    this.selectedTaskKind = 'meeting-task';
    this.drawerOpen = openDrawer;
    this.saveToStorage();
  }

  selectBoardTask(task: Task, openDrawer = true): void {
    this.selectedTaskId = task.id;
    this.selectedTaskKind = 'meeting-task';
    this.drawerOpen = openDrawer;
    this.saveToStorage();
  }

  get selectedMeetingTask(): Task | undefined {
    return this.Task(this.selectedTaskId);
  }

  /**
   * Re-export helpers used by feature components.
   */
  isOpenMeetingTaskStatus(status: TaskStatus): boolean {
    return (
      status === 'New' ||
      status === 'Sent To Owner' ||
      status === 'In Progress' ||
      status === 'Waiting For Customer' ||
      status === 'Waiting For Internal'
    );
  }

  isMeetingTaskOverdue(task: Task): boolean {
    return !!task.dueDate && task.dueDate < this.todayIso && this.isOpenMeetingTaskStatus(task.status);
  }

  isFritzEmail(email: string): boolean {
    return hasFritzDomain(email);
  }

  // ─── Home / dashboard helpers ────────────────────────────────────────

  /** Customer meetings dated today (any status). */
  get meetingsToday(): CustomerMeeting[] {
    const today = this.todayIso;
    return this.customerMeetings.filter((m) => m.meetingDate.slice(0, 10) === today);
  }

  /** Customer meetings scheduled within the next 7 days, excluding today. */
  get meetingsUpcoming(): CustomerMeeting[] {
    const today = this.todayIso;
    const horizon = this.addDays(today, 7);
    return this.customerMeetings
      .filter((m) => {
        const day = m.meetingDate.slice(0, 10);
        return day > today && day <= horizon;
      })
      .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
  }

  /** Meeting tasks assigned to the current user that are still open. */
  get myOpenMeetingTasks(): Task[] {
    return this.meetingTasks.filter(
      (t) =>
        t.assignedToEmployeeId === this.currentEmployeeId &&
        this.isOpenMeetingTaskStatus(t.status)
    );
  }

  /** Open meeting tasks due today or already overdue. */
  get myMeetingTasksDueToday(): Task[] {
    const today = this.todayIso;
    return this.myOpenMeetingTasks.filter((t) => !!t.dueDate && t.dueDate <= today);
  }

  /** All open meeting tasks (across customers and assignees). */
  get openMeetingTasks(): Task[] {
    return this.meetingTasks.filter((t) => this.isOpenMeetingTaskStatus(t.status));
  }

  /**
   * Meeting tasks for the current user, filtered to match the semantics of the
   * MyWork tabs. Used to merge meeting tasks into the same personal queue as
   * board tasks (see my-work template).
   *
   *   today    → due today or overdue (open only)
   *   upcoming → due after today, within the next 30 days (open only)
   *   watched  → no equivalent for meeting tasks (returns [])
   *   blocked  → Waiting For Customer / Waiting For Internal
   */
  myWorkMeetingTasks(tab: MyWorkTab): Task[] {
    const mine = this.myOpenMeetingTasks;
    if (tab === 'today') {
      const today = this.todayIso;
      return mine.filter((t) => !!t.dueDate && t.dueDate <= today);
    }
    if (tab === 'upcoming') {
      const today = this.todayIso;
      const horizon = this.addDays(today, 30);
      return mine.filter((t) => !!t.dueDate && t.dueDate > today && t.dueDate <= horizon);
    }
    if (tab === 'blocked') {
      return mine.filter(
        (t) => t.status === 'Waiting For Customer' || t.status === 'Waiting For Internal'
      );
    }
    if (tab === 'watched') {
      return this.openMeetingTasks.filter(t => t.watcherEmployeeIds.includes(this.currentEmployeeId));
    }
    return [];
  }

  // ─── Calendar ────────────────────────────────────────────────────────

  /**
   * Unified list of calendar events drawn from both the legacy internal
   * meeting and the v3 customer meetings. Sorted ascending by start time.
   * Used by the home calendar and the meetings page.
   */
  get calendarEvents(): CalendarEvent[] {
    if (this.calendarEventsCache.revision === this.dataRevision) {
      return this.calendarEventsCache.value;
    }

    const internal: CalendarEvent = {
      id: `internal-${this.meetingState.id}`,
      title: this.meetingState.title,
      startsAt: this.meetingState.startsAt,
      durationMinutes: this.meetingState.durationMinutes || 30,
      kind: 'internal',
      linkedBoard: this.meetingState.linkedBoard,
      attendeeCount: this.meetingState.attendeeIds.length,
      sourceId: this.meetingState.id
    };

    const customers: CalendarEvent[] = this.customerMeetings.map(meeting => ({
      id: `customer-${meeting.id}`,
      title: meeting.subject,
      startsAt: meeting.meetingDate,
      durationMinutes: 60,
      kind: 'customer',
      customerName: this.clientName(meeting.customerId),
      attendeeCount:
        meeting.internalParticipantEmployeeIds.length + meeting.customerParticipants.length + 1,
      sourceId: meeting.id
    }));

    // Surface scheduled follow-up meetings (nextMeetingDate) as separate events
    const followUps: CalendarEvent[] = this.customerMeetings
      .filter(m => !!m.nextMeetingDate)
      .map(meeting => ({
        id: `customer-${meeting.id}-next`,
        title: `Follow-up: ${meeting.subject}`,
        startsAt: meeting.nextMeetingDate as string,
        durationMinutes: 60,
        kind: 'customer',
        customerName: this.clientName(meeting.customerId),
        attendeeCount: meeting.internalParticipantEmployeeIds.length + 1,
        sourceId: meeting.id
      }));

    const tasks: CalendarEvent[] = this.openTasks
      .filter(t => !!t.dueDate)
      .map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        startsAt: `${t.dueDate}T09:00:00`,
        durationMinutes: 30,
        kind: 'task' as CalendarEventKind,
        customerName: t.customerId ? this.clientName(t.customerId) : undefined,
        attendeeCount: 0,
        sourceId: t.id
      }));

    const value = [internal, ...customers, ...followUps, ...tasks].sort((left, right) =>
      left.startsAt.localeCompare(right.startsAt)
    );
    this.calendarEventsCache.revision = this.dataRevision;
    this.calendarEventsCache.value = value;
    return value;
  }

  /** Same shape as calendarEvents but scoped to the current user's meetings and tasks. */
  get myCalendarEvents(): CalendarEvent[] {
    const empId = this.currentEmployeeId;
    const uid   = this.currentUserId;
    if (
      this.myCalendarEventsCache.revision === this.dataRevision &&
      this.myCalendarEventsCache.currentEmployeeId === empId &&
      this.myCalendarEventsCache.currentUserId === uid
    ) {
      return this.myCalendarEventsCache.value;
    }

    // Only surface the internal meeting on "My Work" when the current user is
    // actually one of its attendees (attendeeIds hold member ids, e.g. "u1").
    // It must NOT leak in unconditionally the way it does for the home page.
    const internal: CalendarEvent[] =
      this.meetingState.id && this.meetingState.attendeeIds.includes(uid)
        ? [{
            id: `internal-${this.meetingState.id}`,
            title: this.meetingState.title,
            startsAt: this.meetingState.startsAt,
            durationMinutes: this.meetingState.durationMinutes || 30,
            kind: 'internal',
            linkedBoard: this.meetingState.linkedBoard,
            attendeeCount: this.meetingState.attendeeIds.length,
            sourceId: this.meetingState.id
          }]
        : [];

    const myMeetings = this.customerMeetings.filter(
      m => m.meetingLeaderEmployeeId === empId || m.internalParticipantEmployeeIds.includes(empId)
    );

    const customers: CalendarEvent[] = myMeetings.map(meeting => ({
      id: `customer-${meeting.id}`,
      title: meeting.subject,
      startsAt: meeting.meetingDate,
      durationMinutes: 60,
      kind: 'customer' as const,
      customerName: this.clientName(meeting.customerId),
      attendeeCount:
        meeting.internalParticipantEmployeeIds.length + meeting.customerParticipants.length + 1,
      sourceId: meeting.id
    }));

    const followUps: CalendarEvent[] = myMeetings
      .filter(m => !!m.nextMeetingDate)
      .map(meeting => ({
        id: `customer-${meeting.id}-next`,
        title: `Follow-up: ${meeting.subject}`,
        startsAt: meeting.nextMeetingDate as string,
        durationMinutes: 60,
        kind: 'customer' as const,
        customerName: this.clientName(meeting.customerId),
        attendeeCount: meeting.internalParticipantEmployeeIds.length + 1,
        sourceId: meeting.id
      }));

    const tasks: CalendarEvent[] = this.openTasks
      .filter(t => t.assignedToEmployeeId === empId || t.assigneeIds.includes(uid))
      .filter(t => !!t.dueDate)
      .map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        startsAt: `${t.dueDate}T09:00:00`,
        durationMinutes: 30,
        kind: 'task' as CalendarEventKind,
        customerName: t.customerId ? this.clientName(t.customerId) : undefined,
        attendeeCount: 0,
        sourceId: t.id
      }));

    const value = [...internal, ...customers, ...followUps, ...tasks].sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt)
    );
    this.myCalendarEventsCache.revision = this.dataRevision;
    this.myCalendarEventsCache.currentEmployeeId = empId;
    this.myCalendarEventsCache.currentUserId = uid;
    this.myCalendarEventsCache.value = value;
    return value;
  }

  // ── Filtered calendar event builders ────────────────────────────────────────

  private buildCalendarEventsFromFiltered(
    meetings: CustomerMeeting[],
    meetingTasks: Task[],
    boardTasks: Task[]
  ): CalendarEvent[] {
    const customers: CalendarEvent[] = meetings.map(m => ({
      id: `customer-${m.id}`,
      title: m.subject,
      startsAt: m.meetingDate,
      durationMinutes: 60,
      kind: 'customer' as const,
      customerName: this.clientName(m.customerId),
      attendeeCount: m.internalParticipantEmployeeIds.length + m.customerParticipants.length + 1,
      sourceId: m.id
    }));
    const followUps: CalendarEvent[] = meetings
      .filter(m => !!m.nextMeetingDate)
      .map(m => ({
        id: `customer-${m.id}-next`,
        title: `Follow-up: ${m.subject}`,
        startsAt: m.nextMeetingDate as string,
        durationMinutes: 60,
        kind: 'customer' as const,
        customerName: this.clientName(m.customerId),
        attendeeCount: m.internalParticipantEmployeeIds.length + 1,
        sourceId: m.id
      }));
    const uniqueTasks = Array.from(
      new Map([...meetingTasks, ...boardTasks].map(task => [task.id, task])).values()
    );
    const tasks: CalendarEvent[] = uniqueTasks
      .filter(t => !!t.dueDate)
      .map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        startsAt: `${t.dueDate}T09:00:00`,
        durationMinutes: 30,
        kind: 'task' as CalendarEventKind,
        customerName: t.customerId ? this.clientName(t.customerId) : undefined,
        attendeeCount: 0,
        sourceId: t.id
      }));
    return [...customers, ...followUps, ...tasks].sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt)
    );
  }

  /** Meetings I led + tasks I created (for me or for others). */
  get iOpenedCalendarEvents(): CalendarEvent[] {
    const empId = this.currentEmployeeId;
    const uid   = this.currentUserId;
    return this.buildCalendarEventsFromFiltered(
      this.customerMeetings.filter(m => m.meetingLeaderEmployeeId === empId),
      this.openMeetingTasks.filter(t => t.openedByEmployeeId === empId),
      this.openTasks.filter(t => t.createdByUserId === uid)
    );
  }

  /** Meetings I participated in (not led) + tasks assigned to me by others. */
  get openedForMeCalendarEvents(): CalendarEvent[] {
    const empId = this.currentEmployeeId;
    const uid   = this.currentUserId;
    return this.buildCalendarEventsFromFiltered(
      this.customerMeetings.filter(
        m => m.internalParticipantEmployeeIds.includes(empId) && m.meetingLeaderEmployeeId !== empId
      ),
      this.openMeetingTasks.filter(
        t => t.assignedToEmployeeId === empId && t.openedByEmployeeId !== empId
      ),
      this.openTasks.filter(t => t.assigneeIds.includes(uid) && t.createdByUserId !== uid)
    );
  }

  /** All meetings and meeting tasks for a given employee. */
  calendarEventsForEmployee(empId: string): CalendarEvent[] {
    return this.buildCalendarEventsFromFiltered(
      this.customerMeetings.filter(
        m => m.meetingLeaderEmployeeId === empId || m.internalParticipantEmployeeIds.includes(empId)
      ),
      this.openMeetingTasks.filter(
        t => t.assignedToEmployeeId === empId || t.openedByEmployeeId === empId
      ),
      []
    );
  }

  calendarEventsForDay(date: Date): CalendarEvent[] {
    const key = this.toDateOnly(date);
    return this.calendarEvents.filter(event => event.startsAt.slice(0, 10) === key);
  }

  calendarEventCountsByDay(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const event of this.calendarEvents) {
      const key = event.startsAt.slice(0, 10);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }

  /** Next upcoming meeting from "now" (tasks excluded). */
  get nextCalendarEvent(): CalendarEvent | undefined {
    const now = new Date().toISOString();
    return this.calendarEvents.find(event => event.kind !== 'task' && event.startsAt >= now);
  }

  /** Calendar events scheduled for today (any time of day). */
  get calendarEventsToday(): CalendarEvent[] {
    return this.calendarEventsForDay(new Date());
  }

  // ─── v3 clone helpers ───────────────────────────────────────────────

  private cloneCustomers(source: Customer[]): Customer[] {
    return source.map((c) => ({ ...c }));
  }

  private cloneEmployees(source: Employee[]): Employee[] {
    return source.map((e) => ({ ...e }));
  }

  private cloneCustomerMeetings(source: CustomerMeeting[]): CustomerMeeting[] {
    return source.map((m) => ({
      ...m,
      internalParticipantEmployeeIds: [...m.internalParticipantEmployeeIds],
      customerParticipants: m.customerParticipants.map((p) => ({ ...p })),
      notes: m.notes.map((n) => ({ ...n })),
      attachmentIds: [...m.attachmentIds]
    }));
  }

  private cloneAttachments(source: Attachment[]): Attachment[] {
    return source.map((a) => ({ ...a }));
  }
}
