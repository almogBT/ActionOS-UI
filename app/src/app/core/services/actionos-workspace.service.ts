import { Injectable } from '@angular/core';
import {
  ACTIONOS_ATTACHMENTS,
  ACTIONOS_BOARD_TEMPLATES,
  ACTIONOS_CUSTOMER_MEETINGS,
  ACTIONOS_CUSTOMERS,
  ACTIONOS_EMPLOYEES,
  ACTIONOS_EXTERNAL_CUSTOMER_GROUPS,
  ACTIONOS_MEETING,
  ACTIONOS_MEETING_TASKS,
  ACTIONOS_MEMBERS,
  ACTIONOS_TASK_STATUSES,
  ACTIONOS_TASKS
} from '../mock-data/actionos.mock-data';
import {
  ActivityLog,
  AgendaItem,
  Attachment,
  AttachmentEntityType,
  BoardTemplate,
  CalendarEvent,
  ChecklistItem,
  Comment,
  CreateCustomerInput,
  CreateCustomerMeetingInput,
  CreateMeetingNoteInput,
  CreateMeetingTaskInput,
  CreateMemberInput,
  CreateTaskInput,
  Customer,
  CustomerMeeting,
  CustomerMeetingStatus,
  CustomerPreparationSummary,
  Employee,
  Meeting,
  MeetingNote,
  MeetingTask,
  MeetingTaskStatus,
  Member,
  MyWorkTab,
  NoteType,
  QuickCaptureType,
  TaskItem,
  TaskStatus,
  UpdateCustomerMeetingInput,
  UpdateMeetingTaskInput,
  UpdateTaskInput
} from '../models/actionos.models';
import { ActionosPersistencePort, LocalStorageActionosPersistence } from './actionos-persistence.port';
import {
  CustomerRepositoryPort,
  InMemoryCustomerRepository
} from './customer-repository.port';
import {
  CustomerMeetingRepositoryPort,
  InMemoryCustomerMeetingRepository
} from './meeting-repository.port';
import {
  InMemoryMeetingTaskRepository,
  MeetingTaskRepositoryPort,
  isOpenStatus,
  isOverdue
} from './meeting-task-repository.port';
import {
  EmployeeDirectoryPort,
  InMemoryEmployeeDirectory,
  hasFritzDomain
} from './employee-directory.port';
import {
  LocalMockNotificationAdapter,
  NotificationPort
} from './notification.port';
import {
  AttachmentStoragePort,
  InMemoryAttachmentStorage
} from './attachment-storage.port';

interface ActionosPersistedState {
  selectedTaskId: string;
  tasks: TaskItem[];
  members: Member[];
  meeting: Meeting;
  comments: Comment[];
  activity: ActivityLog[];
  // v3 additions:
  customers?: Customer[];
  employees?: Employee[];
  customerMeetings?: CustomerMeeting[];
  meetingTasks?: MeetingTask[];
  attachments?: Attachment[];
  nextNoteNumber: number;
  nextTaskNumber: number;
  nextMemberNumber: number;
  nextCommentNumber: number;
  nextActivityNumber: number;
  nextAgendaNumber: number;
  nextCustomerNumber?: number;
  nextCustomerMeetingNumber?: number;
  nextMeetingTaskNumber?: number;
  nextAttachmentNumber?: number;
}

interface TeamWorkload {
  member: Member;
  openCount: number;
  blockedCount: number;
}

const STORAGE_KEY_V2 = 'actionos.local-state.v2';
const STORAGE_KEY_V3 = 'actionos.local-state.v3';

@Injectable({ providedIn: 'root' })
export class ActionosWorkspaceService {
  private readonly persistence: ActionosPersistencePort<ActionosPersistedState> =
    new LocalStorageActionosPersistence<ActionosPersistedState>(STORAGE_KEY_V3);

  readonly currentUserId = 'u1';
  readonly currentEmployeeId = 'emp-1';
  readonly statuses = ACTIONOS_TASK_STATUSES;
  readonly templates = ACTIONOS_BOARD_TEMPLATES;
  readonly externalCustomerGroups = ACTIONOS_EXTERNAL_CUSTOMER_GROUPS;
  readonly meetingTaskStatuses: MeetingTaskStatus[] = [
    'New',
    'Sent To Owner',
    'In Progress',
    'Waiting For Customer',
    'Waiting For Internal',
    'Done',
    'Cancelled'
  ];

  selectedTaskId = 'task-2';
  drawerOpen = false;
  // 'board-task' = legacy TaskItem, 'meeting-task' = v3 MeetingTask
  selectedTaskKind: 'board-task' | 'meeting-task' = 'board-task';

  private membersState: Member[] = this.cloneMembers(ACTIONOS_MEMBERS);
  private tasksState: TaskItem[] = this.cloneTasks(ACTIONOS_TASKS);
  private meetingState: Meeting = this.cloneMeeting(ACTIONOS_MEETING);
  private commentsState: Comment[] = [];
  private activityState: ActivityLog[] = [
    {
      id: 'activity-1',
      targetType: 'meeting',
      targetId: 'meet-1',
      action: 'Prototype created',
      detail: 'ActionOS local MVP started with workspace, boards, meetings, and My Work.',
      createdAt: '2026-05-25T10:00:00.000Z'
    }
  ];

  // v3 state — wrapped in objects so ports can hold a stable reference
  private readonly customerStore = { customers: this.cloneCustomers(ACTIONOS_CUSTOMERS) };
  private readonly employeeStore = { employees: this.cloneEmployees(ACTIONOS_EMPLOYEES) };
  private readonly customerMeetingStore = {
    customerMeetings: this.cloneCustomerMeetings(ACTIONOS_CUSTOMER_MEETINGS)
  };
  private readonly meetingTaskStore = {
    meetingTasks: this.cloneMeetingTasks(ACTIONOS_MEETING_TASKS)
  };
  private readonly attachmentStore = { attachments: this.cloneAttachments(ACTIONOS_ATTACHMENTS) };

  private nextNoteNumber = ACTIONOS_MEETING.notes.length + 1;
  private nextTaskNumber = ACTIONOS_TASKS.length + 1;
  private nextMemberNumber = ACTIONOS_MEMBERS.length + 1;
  private nextCommentNumber = 1;
  private nextActivityNumber = 2;
  private nextAgendaNumber = ACTIONOS_MEETING.agenda.length + 1;
  private nextCustomerNumber = ACTIONOS_CUSTOMERS.length + 1;
  private nextCustomerMeetingNumber = ACTIONOS_CUSTOMER_MEETINGS.length + 1;
  private nextCustomerMeetingNoteNumber = 100;
  private nextMeetingTaskNumber = ACTIONOS_MEETING_TASKS.length + 1;
  private nextAttachmentNumber = 1;

  // Ports — instantiated with shared state references and a save callback
  private readonly customerRepo: CustomerRepositoryPort = new InMemoryCustomerRepository(
    this.customerStore,
    () => this.saveToStorage(),
    () => `cust-${this.nextCustomerNumber++}`,
    () => new Date().toISOString()
  );
  private readonly employeeDirectory: EmployeeDirectoryPort = new InMemoryEmployeeDirectory(
    this.employeeStore
  );
  private readonly customerMeetingRepo: CustomerMeetingRepositoryPort =
    new InMemoryCustomerMeetingRepository(
      this.customerMeetingStore,
      () => this.saveToStorage(),
      () => `cmeet-${this.nextCustomerMeetingNumber++}`,
      () => new Date().toISOString()
    );
  private readonly meetingTaskRepo: MeetingTaskRepositoryPort =
    new InMemoryMeetingTaskRepository(
      this.meetingTaskStore,
      () => this.saveToStorage(),
      () => `mtask-${this.nextMeetingTaskNumber++}`,
      () => new Date().toISOString()
    );
  private readonly notifier: NotificationPort = new LocalMockNotificationAdapter(
    () => this.saveToStorage(),
    () => new Date().toISOString()
  );
  private readonly attachments: AttachmentStoragePort = new InMemoryAttachmentStorage(
    this.attachmentStore,
    () => this.saveToStorage(),
    () => `att-${this.nextAttachmentNumber++}`,
    () => new Date().toISOString()
  );

  constructor() {
    this.migrateAndLoad();
  }

  get members(): Member[] {
    return this.membersState;
  }

  get tasks(): TaskItem[] {
    return this.tasksState.filter(task => !task.archivedAt);
  }

  get archivedTasks(): TaskItem[] {
    return this.tasksState.filter(task => !!task.archivedAt);
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

  get openTasks(): TaskItem[] {
    return this.tasks.filter(task => task.status !== 'Done');
  }

  get myTasks(): TaskItem[] {
    return this.openTasks.filter(task => task.assigneeIds.includes(this.currentUserId));
  }

  get watchedTasks(): TaskItem[] {
    return this.openTasks.filter(task => task.watcherIds.includes(this.currentUserId));
  }

  get inboxTasks(): TaskItem[] {
    return this.openTasks.filter(task => task.status === 'Inbox');
  }

  get blockedTasks(): TaskItem[] {
    return this.openTasks.filter(task => !!task.blockedBy || task.status === 'Waiting');
  }

  get overdueTasks(): TaskItem[] {
    return this.openTasks.filter(task => task.dueDate < this.todayIso);
  }

  get dueSoonTasks(): TaskItem[] {
    const soon = this.addDays(this.todayIso, 7);

    return this.openTasks.filter(task => task.dueDate >= this.todayIso && task.dueDate <= soon);
  }

  get topThreeToday(): TaskItem[] {
    return this.myTasks
      .filter(task => task.dueDate <= this.addDays(this.todayIso, 1))
      .slice()
      .sort((left, right) => this.priorityScore(right.priority) - this.priorityScore(left.priority))
      .slice(0, 3);
  }

  get triageQueue(): TaskItem[] {
    const riskyTasks = this.openTasks.filter(task => task.status === 'Inbox' || !task.assigneeIds.length || task.dueDate < this.todayIso);

    return this.uniqueTasks(riskyTasks).slice(0, 12);
  }

  get openMeetingActions(): MeetingNote[] {
    return this.meetingState.notes.filter(note => note.type === 'action' && !note.convertedTaskId);
  }

  get meetingDecisions(): MeetingNote[] {
    return this.meetingState.notes.filter(note => note.type === 'decision');
  }

  get completedAgendaCount(): number {
    return this.meetingState.agenda.filter(item => item.completed).length;
  }

  get recentlyConvertedTasks(): TaskItem[] {
    return this.tasks.filter(task => !!task.sourceMeetingId).slice(0, 5);
  }

  get selectedTask(): TaskItem | undefined {
    return this.tasksState.find(task => task.id === this.selectedTaskId && !task.archivedAt);
  }

  get unconvertedActionCount(): number {
    return this.meetingState.notes.filter(note => note.type === 'action' && !note.convertedTaskId).length;
  }

  get teamWorkload(): TeamWorkload[] {
    return this.membersState.map(member => {
      const assigned = this.openTasks.filter(task => task.assigneeIds.includes(member.id));

      return {
        member,
        openCount: assigned.length,
        blockedCount: assigned.filter(task => !!task.blockedBy || task.status === 'Waiting').length
      };
    });
  }

  tasksByStatus(status: TaskStatus): TaskItem[] {
    return this.tasks.filter(task => task.status === status);
  }

  myWorkTasks(tab: MyWorkTab): TaskItem[] {
    if (tab === 'today') {
      return this.myTasks.filter(task => task.dueDate <= this.todayIso);
    }

    if (tab === 'upcoming') {
      return this.myTasks.filter(task => task.dueDate > this.todayIso);
    }

    if (tab === 'watched') {
      return this.watchedTasks;
    }

    return this.blockedTasks.filter(task => task.assigneeIds.includes(this.currentUserId) || task.watcherIds.includes(this.currentUserId));
  }

  selectTask(task: TaskItem, openDrawer = true): void {
    this.selectedTaskId = task.id;
    this.drawerOpen = openDrawer;
    this.saveToStorage();
  }

  openTaskDrawer(task?: TaskItem): void {
    if (task) {
      this.selectedTaskId = task.id;
    }

    this.drawerOpen = !!this.selectedTask;
  }

  closeTaskDrawer(): void {
    this.drawerOpen = false;
  }

  updateStatus(task: TaskItem, status: TaskStatus): void {
    this.updateTask(task.id, { status });
  }

  updateTask(taskId: string, changes: UpdateTaskInput): void {
    const task = this.tasksState.find(item => item.id === taskId);

    if (!task) {
      return;
    }

    this.tasksState = this.tasksState.map(item => {
      if (item.id !== taskId) {
        return item;
      }

      return {
        ...item,
        ...changes,
        title: changes.title?.trim() || item.title,
        board: changes.board?.trim() || item.board,
        description: changes.description ?? item.description,
        assigneeIds: changes.assigneeIds ? [...changes.assigneeIds] : item.assigneeIds,
        watcherIds: changes.watcherIds ? [...changes.watcherIds] : item.watcherIds,
        blockedBy: changes.blockedBy !== undefined ? changes.blockedBy.trim() || undefined : item.blockedBy,
        updatedAt: new Date().toISOString()
      };
    });
    this.selectedTaskId = taskId;
    this.recordActivity('task', taskId, 'Task updated', task.title);
    this.saveToStorage();
  }

  addTask(input: CreateTaskInput): TaskItem {
    const now = new Date().toISOString();
    const task: TaskItem = {
      id: `task-${this.nextTaskNumber++}`,
      title: input.title.trim(),
      description: input.description?.trim() || '',
      board: input.board.trim() || 'ActionOS Core',
      status: 'Inbox',
      priority: input.priority,
      dueDate: input.dueDate,
      assigneeIds: input.assigneeId ? [input.assigneeId] : [this.currentUserId],
      watcherIds: [this.currentUserId],
      createdAt: now,
      updatedAt: now,
      checklist: [
        { label: 'Clarify next step', done: false },
        { label: 'Move into plan', done: false }
      ]
    };

    this.tasksState = [task, ...this.tasksState];
    this.selectedTaskId = task.id;
    this.recordActivity('task', task.id, 'Task created', task.title);
    this.saveToStorage();

    return task;
  }

  quickCapture(kind: QuickCaptureType, content: string): TaskItem | MeetingNote | null {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return null;
    }

    if (kind === 'task') {
      return this.addTask({
        title: trimmedContent,
        description: 'Captured from the global command bar.',
        board: 'ActionOS Core',
        priority: 'Medium',
        dueDate: this.addDays(this.todayIso, 2),
        assigneeId: this.currentUserId
      });
    }

    return this.addMeetingNote({
      type: kind,
      content: trimmedContent,
      ownerId: kind === 'action' || kind === 'blocker' ? this.currentUserId : undefined,
      dueDate: kind === 'action' ? this.addDays(this.todayIso, 2) : undefined
    });
  }

  archiveTask(task: TaskItem): void {
    this.tasksState = this.tasksState.map(item => item.id === task.id ? { ...item, archivedAt: new Date().toISOString() } : item);
    this.recordActivity('task', task.id, 'Task archived', task.title);
    if (this.selectedTaskId === task.id) {
      this.selectedTaskId = this.tasks[0]?.id ?? '';
      this.drawerOpen = false;
    }
    this.saveToStorage();
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
    const actions = this.openMeetingActions.slice();
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

  convertAction(note: MeetingNote, overrides?: Partial<CreateTaskInput>): TaskItem | null {
    if (note.type !== 'action' || note.convertedTaskId) {
      return null;
    }

    const task = this.addTask({
      title: overrides?.title || note.content,
      description: `Created from meeting: ${this.meetingState.title}`,
      board: overrides?.board || this.meetingState.linkedBoard,
      priority: overrides?.priority || 'High',
      dueDate: overrides?.dueDate || note.dueDate || this.addDays(this.todayIso, 3),
      assigneeId: overrides?.assigneeId || note.ownerId || this.currentUserId
    });

    task.sourceMeetingId = this.meetingState.id;
    this.tasksState = this.tasksState.map(item => item.id === task.id ? task : item);
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

  updateChecklistItem(task: TaskItem, checklistItem: ChecklistItem, done: boolean): void {
    this.tasksState = this.tasksState.map(item => {
      if (item.id !== task.id) {
        return item;
      }

      return {
        ...item,
        checklist: item.checklist.map(entry => entry.label === checklistItem.label ? { ...entry, done } : entry),
        updatedAt: new Date().toISOString()
      };
    });
    this.recordActivity('task', task.id, done ? 'Checklist item completed' : 'Checklist item reopened', checklistItem.label);
    this.saveToStorage();
  }

  addChecklistItem(task: TaskItem, label: string): void {
    const trimmedLabel = label.trim();

    if (!trimmedLabel) {
      return;
    }

    this.tasksState = this.tasksState.map(item => {
      if (item.id !== task.id) {
        return item;
      }

      return {
        ...item,
        checklist: [...item.checklist, { label: trimmedLabel, done: false }],
        updatedAt: new Date().toISOString()
      };
    });
    this.recordActivity('task', task.id, 'Checklist item added', trimmedLabel);
    this.saveToStorage();
  }

  promoteTask(task: TaskItem, status: TaskStatus): void {
    this.updateTask(task.id, { status });
  }

  commentsForTask(taskId: string): Comment[] {
    return this.commentsState.filter(comment => comment.targetType === 'task' && comment.targetId === taskId);
  }

  addTaskComment(task: TaskItem, body: string): void {
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
    this.recordActivity('task', task.id, 'Comment added', task.title);
    this.saveToStorage();
  }

  /**
   * Clears all user-data arrays (customers, meetings, tasks, notes, comments,
   * activity, attachments) but KEEPS the reference data (employees, members)
   * so the user can still create new records from scratch. Useful when the
   * mock seeds get in the way of testing empty-state flows.
   */
  clearAllData(): void {
    this.selectedTaskId = '';
    this.drawerOpen = false;
    this.selectedTaskKind = 'board-task';
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
    this.meetingTaskStore.meetingTasks = [];
    this.attachmentStore.attachments = [];
    this.saveToStorage();
  }

  resetDemoData(): void {
    this.selectedTaskId = 'task-2';
    this.drawerOpen = false;
    this.selectedTaskKind = 'board-task';
    this.membersState = this.cloneMembers(ACTIONOS_MEMBERS);
    this.tasksState = this.cloneTasks(ACTIONOS_TASKS);
    this.meetingState = this.cloneMeeting(ACTIONOS_MEETING);
    this.commentsState = [];
    this.activityState = [
      {
        id: 'activity-1',
        targetType: 'meeting',
        targetId: 'meet-1',
        action: 'Prototype reset',
        detail: 'Demo data was restored.',
        createdAt: new Date().toISOString()
      }
    ];
    // v3 — restore customer module seed data too
    this.customerStore.customers = this.cloneCustomers(ACTIONOS_CUSTOMERS);
    this.employeeStore.employees = this.cloneEmployees(ACTIONOS_EMPLOYEES);
    this.customerMeetingStore.customerMeetings = this.cloneCustomerMeetings(ACTIONOS_CUSTOMER_MEETINGS);
    this.meetingTaskStore.meetingTasks = this.cloneMeetingTasks(ACTIONOS_MEETING_TASKS);
    this.attachmentStore.attachments = this.cloneAttachments(ACTIONOS_ATTACHMENTS);
    this.nextNoteNumber = ACTIONOS_MEETING.notes.length + 1;
    this.nextTaskNumber = ACTIONOS_TASKS.length + 1;
    this.nextMemberNumber = ACTIONOS_MEMBERS.length + 1;
    this.nextCommentNumber = 1;
    this.nextActivityNumber = 2;
    this.nextAgendaNumber = ACTIONOS_MEETING.agenda.length + 1;
    this.nextCustomerNumber = ACTIONOS_CUSTOMERS.length + 1;
    this.nextCustomerMeetingNumber = ACTIONOS_CUSTOMER_MEETINGS.length + 1;
    this.nextCustomerMeetingNoteNumber = 100;
    this.nextMeetingTaskNumber = ACTIONOS_MEETING_TASKS.length + 1;
    this.nextAttachmentNumber = 1;
    this.saveToStorage();
  }

  memberName(memberId: string): string {
    return this.membersState.find(member => member.id === memberId)?.name ?? 'Unknown';
  }

  initials(memberId: string): string {
    const name = this.memberName(memberId);
    return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  }

  statusClass(value: string): string {
    return value.toLowerCase().replace(/\s+/g, '-');
  }

  dateAfter(days: number): string {
    return this.addDays(this.todayIso, days);
  }

  checklistProgress(task: TaskItem): number {
    if (!task.checklist.length) {
      return 0;
    }

    const done = task.checklist.filter(item => item.done).length;
    return Math.round((done / task.checklist.length) * 100);
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

  /**
   * v2 -> v3 migration: if the legacy key is present, drop it and seed fresh v3
   * mock data. v3 is the new source of truth. Documented in RELEASE_NOTIFICATION.md.
   */
  private migrateAndLoad(): void {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_V2) !== null) {
      localStorage.removeItem(STORAGE_KEY_V2);
      // eslint-disable-next-line no-console
      console.info('[ActionOS] v2 state detected and cleared. Seeded fresh v3 mock data.');
      this.saveToStorage();
      return;
    }
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const parsed = this.persistence.load();

    if (!parsed) {
      return;
    }

    this.selectedTaskId = parsed.selectedTaskId || this.selectedTaskId;
    this.tasksState = this.cloneTasks(parsed.tasks?.length ? parsed.tasks : ACTIONOS_TASKS);
    this.membersState = this.cloneMembers(parsed.members?.length ? parsed.members : ACTIONOS_MEMBERS);
    this.meetingState = parsed.meeting ? this.cloneMeeting(parsed.meeting) : this.cloneMeeting(ACTIONOS_MEETING);
    this.commentsState = (parsed.comments ?? []).map(comment => ({ ...comment }));
    this.activityState = (parsed.activity ?? []).map(activity => ({ ...activity }));
    if (parsed.customers?.length) {
      this.customerStore.customers = this.cloneCustomers(parsed.customers);
    }
    if (parsed.employees?.length) {
      this.employeeStore.employees = this.cloneEmployees(parsed.employees);
    }
    if (parsed.customerMeetings?.length) {
      this.customerMeetingStore.customerMeetings = this.cloneCustomerMeetings(parsed.customerMeetings);
    }
    if (parsed.meetingTasks?.length) {
      this.meetingTaskStore.meetingTasks = this.cloneMeetingTasks(parsed.meetingTasks);
    }
    if (parsed.attachments?.length) {
      this.attachmentStore.attachments = this.cloneAttachments(parsed.attachments);
    }
    this.nextNoteNumber = parsed.nextNoteNumber || this.meetingState.notes.length + 1;
    this.nextTaskNumber = parsed.nextTaskNumber || this.tasksState.length + 1;
    this.nextMemberNumber = parsed.nextMemberNumber || this.membersState.length + 1;
    this.nextCommentNumber = parsed.nextCommentNumber || this.commentsState.length + 1;
    this.nextActivityNumber = parsed.nextActivityNumber || this.activityState.length + 1;
    this.nextAgendaNumber = parsed.nextAgendaNumber || this.meetingState.agenda.length + 1;
    this.nextCustomerNumber = parsed.nextCustomerNumber || this.customerStore.customers.length + 1;
    this.nextCustomerMeetingNumber =
      parsed.nextCustomerMeetingNumber || this.customerMeetingStore.customerMeetings.length + 1;
    this.nextMeetingTaskNumber =
      parsed.nextMeetingTaskNumber || this.meetingTaskStore.meetingTasks.length + 1;
    this.nextAttachmentNumber =
      parsed.nextAttachmentNumber || this.attachmentStore.attachments.length + 1;
  }

  private saveToStorage(): void {
    const state: ActionosPersistedState = {
      selectedTaskId: this.selectedTaskId,
      tasks: this.tasksState,
      members: this.membersState,
      meeting: this.meetingState,
      comments: this.commentsState,
      activity: this.activityState,
      customers: this.customerStore.customers,
      employees: this.employeeStore.employees,
      customerMeetings: this.customerMeetingStore.customerMeetings,
      meetingTasks: this.meetingTaskStore.meetingTasks,
      attachments: this.attachmentStore.attachments,
      nextNoteNumber: this.nextNoteNumber,
      nextTaskNumber: this.nextTaskNumber,
      nextMemberNumber: this.nextMemberNumber,
      nextCommentNumber: this.nextCommentNumber,
      nextActivityNumber: this.nextActivityNumber,
      nextAgendaNumber: this.nextAgendaNumber,
      nextCustomerNumber: this.nextCustomerNumber,
      nextCustomerMeetingNumber: this.nextCustomerMeetingNumber,
      nextMeetingTaskNumber: this.nextMeetingTaskNumber,
      nextAttachmentNumber: this.nextAttachmentNumber
    };

    this.persistence.save(state);
  }

  private cloneTasks(tasks: Partial<TaskItem>[]): TaskItem[] {
    return tasks.map((task, index) => {
      const now = new Date().toISOString();

      return {
        id: task.id ?? `task-${index + 1}`,
        title: task.title ?? 'Untitled task',
        description: task.description ?? '',
        board: task.board ?? 'ActionOS Core',
        status: task.status ?? 'Inbox',
        priority: task.priority ?? 'Medium',
        dueDate: task.dueDate ?? this.todayIso,
        assigneeIds: [...(task.assigneeIds?.length ? task.assigneeIds : [this.currentUserId])],
        watcherIds: [...(task.watcherIds ?? [])],
        sourceMeetingId: task.sourceMeetingId,
        blockedBy: task.blockedBy,
        archivedAt: task.archivedAt,
        createdAt: task.createdAt ?? now,
        updatedAt: task.updatedAt ?? now,
        checklist: (task.checklist ?? []).map(item => ({ ...item }))
      };
    });
  }

  private cloneMembers(members: Member[]): Member[] {
    return members.map(member => ({ ...member }));
  }

  private cloneMeeting(meeting: Partial<Meeting>): Meeting {
    const agendaSource = meeting.agenda ?? ACTIONOS_MEETING.agenda;

    return {
      id: meeting.id ?? ACTIONOS_MEETING.id,
      title: meeting.title ?? ACTIONOS_MEETING.title,
      time: meeting.time ?? ACTIONOS_MEETING.time,
      startsAt: meeting.startsAt ?? ACTIONOS_MEETING.startsAt,
      durationMinutes: meeting.durationMinutes ?? ACTIONOS_MEETING.durationMinutes ?? 30,
      attendeeIds: [...(meeting.attendeeIds ?? ACTIONOS_MEETING.attendeeIds)],
      linkedBoard: meeting.linkedBoard ?? ACTIONOS_MEETING.linkedBoard,
      agenda: agendaSource.map((item, index) => {
        if (typeof item === 'string') {
          return { id: `agenda-${index + 1}`, title: item, completed: false };
        }

        return { ...item };
      }),
      notes: (meeting.notes ?? ACTIONOS_MEETING.notes).map(note => ({ ...note }))
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

  private uniqueTasks(tasks: TaskItem[]): TaskItem[] {
    const seen = new Set<string>();

    return tasks.filter(task => {
      if (seen.has(task.id)) {
        return false;
      }

      seen.add(task.id);
      return true;
    });
  }

  private priorityScore(priority: TaskItem['priority']): number {
    const scores: Record<TaskItem['priority'], number> = {
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
    return this.customerRepo.list();
  }

  customer(id: string): Customer | undefined {
    return this.customerRepo.get(id);
  }

  customersByStatus(status: 'all' | Customer['status'] | Customer['type']): Customer[] {
    if (status === 'all') {
      return this.customers;
    }
    return this.customers.filter(
      (c) => c.status === status || c.type === status
    );
  }

  addCustomer(input: CreateCustomerInput): Customer {
    const customer = this.customerRepo.add(input);
    this.recordActivity('member', customer.id, 'Customer added', customer.name);
    return customer;
  }

  updateCustomer(id: string, changes: Partial<Customer>): Customer | null {
    const updated = this.customerRepo.update(id, changes);
    if (updated) {
      this.recordActivity('member', updated.id, 'Customer updated', updated.name);
    }
    return updated;
  }

  promoteProspect(id: string, externalGroupId: string): Customer | null {
    const updated = this.customerRepo.promoteProspect(id, externalGroupId);
    if (updated) {
      this.recordActivity('member', updated.id, 'Prospect promoted', updated.name);
    }
    return updated;
  }

  // Employees — read-only Fritz directory

  get employees(): Employee[] {
    // Returns only active fritz/critilog employees (the assignable set)
    return this.employeeDirectory.list();
  }

  get allEmployees(): Employee[] {
    // Full mock list (for debugging / display of inactive history)
    return this.employeeStore.employees.slice();
  }

  employee(id: string): Employee | undefined {
    return this.employeeDirectory.get(id);
  }

  employeeName(id: string | undefined): string {
    if (!id) {
      return '—';
    }
    return this.employeeDirectory.get(id)?.fullName ?? '—';
  }

  isAssignable(id: string): boolean {
    return this.employeeDirectory.isAssignable(id);
  }

  // Customer meetings

  get customerMeetings(): CustomerMeeting[] {
    return this.customerMeetingRepo.list();
  }

  customerMeeting(id: string): CustomerMeeting | undefined {
    return this.customerMeetingRepo.get(id);
  }

  customerMeetingsByCustomer(customerId: string): CustomerMeeting[] {
    return this.customerMeetingRepo.listByCustomer(customerId);
  }

  addCustomerMeeting(input: CreateCustomerMeetingInput): CustomerMeeting {
    const meeting = this.customerMeetingRepo.add(input);
    this.recordActivity('meeting', meeting.id, 'Customer meeting created', meeting.subject);
    return meeting;
  }

  updateCustomerMeetingSummary(
    meetingId: string,
    changes: UpdateCustomerMeetingInput
  ): CustomerMeeting | null {
    const updated = this.customerMeetingRepo.update(meetingId, changes);
    if (updated) {
      this.recordActivity('meeting', updated.id, 'Customer meeting updated', updated.subject);
    }
    return updated;
  }

  addCustomerMeetingNote(
    meetingId: string,
    input: CreateMeetingNoteInput
  ): MeetingNote | null {
    const noteId = `cnote-${this.nextCustomerMeetingNoteNumber++}`;
    const note = this.customerMeetingRepo.addNote(
      meetingId,
      input,
      noteId,
      this.currentEmployeeId,
    );
    if (note) {
      this.recordActivity('meeting', meetingId, 'Meeting note added', note.content);
    }
    return note;
  }

  /**
   * Builds a multi-section recap for a customer meeting and saves it as the
   * meeting's summary. Sets status to Closed. Returns the recap string so the
   * caller can also surface it (e.g. for a "Copy to clipboard" affordance).
   */
  publishMeetingRecap(meetingId: string): string | null {
    const meeting = this.customerMeetingRepo.get(meetingId);
    if (!meeting) {
      return null;
    }
    const customer = this.customer(meeting.customerId);
    const leaderName = this.employeeName(meeting.meetingLeaderEmployeeId);
    const internalNames = meeting.internalParticipantEmployeeIds
      .map((id) => this.employeeName(id))
      .filter((n) => n && n !== '—');
    const customerNames = meeting.customerParticipants.map((p) => p.name).filter(Boolean);

    const decisions = meeting.notes.filter((n) => n.type === 'decision');
    const blockers = meeting.notes.filter((n) => n.type === 'blocker');
    const otherNotes = meeting.notes.filter((n) => n.type === 'note');
    const tasksFromMeeting = this.meetingTaskRepo.listByMeeting(meeting.id);

    const lines: string[] = [];
    lines.push(`Meeting recap — ${meeting.subject}`);
    lines.push(
      `${meeting.meetingDate.slice(0, 10)} · ${customer?.name ?? 'Unknown customer'}`,
    );
    lines.push('');
    lines.push(`Led by: ${leaderName}`);
    if (internalNames.length) {
      lines.push(`Our side: ${internalNames.join(', ')}`);
    }
    if (customerNames.length) {
      lines.push(`Customer side: ${customerNames.join(', ')}`);
    }
    if (meeting.goal?.trim()) {
      lines.push('');
      lines.push(`Goal: ${meeting.goal.trim()}`);
    }
    if (meeting.summary?.trim()) {
      lines.push('');
      lines.push('What happened:');
      lines.push(meeting.summary.trim());
    }
    if (decisions.length) {
      lines.push('');
      lines.push('Decisions:');
      for (const d of decisions) {
        lines.push(`• ${d.content}`);
      }
    }
    if (tasksFromMeeting.length) {
      lines.push('');
      lines.push('Tasks created:');
      for (const t of tasksFromMeeting) {
        const owner = this.employeeName(t.assignedToEmployeeId);
        const due = t.dueDate ? ` · due ${t.dueDate}` : '';
        lines.push(`• ${t.title} — ${owner}${due}`);
      }
    }
    if (blockers.length) {
      lines.push('');
      lines.push('Blockers:');
      for (const b of blockers) {
        lines.push(`• ${b.content}`);
      }
    }
    if (otherNotes.length) {
      lines.push('');
      lines.push('Notes:');
      for (const n of otherNotes) {
        lines.push(`• ${n.content}`);
      }
    }
    if (meeting.nextMeetingDate) {
      lines.push('');
      lines.push(`Next meeting: ${meeting.nextMeetingDate.slice(0, 10)}`);
    }
    const recap = lines.join('\n');

    this.customerMeetingRepo.update(meetingId, { summary: recap });
    this.customerMeetingRepo.setStatus(meetingId, 'Closed');
    this.recordActivity('meeting', meetingId, 'Recap published', meeting.subject);
    return recap;
  }

  // Meeting tasks

  get meetingTasks(): MeetingTask[] {
    return this.meetingTaskRepo.list();
  }

  meetingTask(id: string): MeetingTask | undefined {
    return this.meetingTaskRepo.get(id);
  }

  meetingTasksByCustomer(customerId: string): MeetingTask[] {
    return this.meetingTaskRepo.listByCustomer(customerId);
  }

  meetingTasksByMeeting(meetingId: string): MeetingTask[] {
    return this.meetingTaskRepo.listByMeeting(meetingId);
  }

  meetingTasksAssignedToMe(): MeetingTask[] {
    return this.meetingTaskRepo.listByAssignee(this.currentEmployeeId);
  }

  /**
   * Convert a meeting note (or anonymous task input) into a meeting task.
   * Validates the assignee is in the fritz/critilog active directory.
   * Fires the "task assigned" notification automatically.
   */
  createTaskFromMeeting(
    meetingId: string,
    input: CreateMeetingTaskInput,
    sourceNoteId?: string
  ): MeetingTask | null {
    const meeting = this.customerMeetingRepo.get(meetingId);
    if (!meeting) {
      return null;
    }
    if (!this.employeeDirectory.isAssignable(input.assignedToEmployeeId)) {
      // eslint-disable-next-line no-console
      console.warn('[ActionOS] Refused to assign task to non-fritz/inactive employee:', input.assignedToEmployeeId);
      return null;
    }

    const task = this.meetingTaskRepo.add(
      input,
      this.currentEmployeeId,
      meeting.customerId
    );

    if (sourceNoteId) {
      this.customerMeetingRepo.linkNoteToTask(meetingId, sourceNoteId, task.id);
    }

    if (meeting.status === 'Planned' || meeting.status === 'Draft Summary') {
      this.customerMeetingRepo.setStatus(meeting.id, 'Tasks Created');
    }

    this.notifier.onTaskAssigned(task);
    this.recordActivity('task', task.id, 'Meeting task created', task.title);
    return task;
  }

  updateMeetingTask(id: string, changes: UpdateMeetingTaskInput): MeetingTask | null {
    const before = this.meetingTaskRepo.get(id);
    if (!before) {
      return null;
    }
    const previousStatus = before.status;
    const previousAssignee = before.assignedToEmployeeId;

    if (changes.assignedToEmployeeId && !this.employeeDirectory.isAssignable(changes.assignedToEmployeeId)) {
      // eslint-disable-next-line no-console
      console.warn('[ActionOS] Refused to reassign task to non-fritz/inactive employee:', changes.assignedToEmployeeId);
      delete changes.assignedToEmployeeId;
    }

    const updated = this.meetingTaskRepo.update(id, changes);
    if (!updated) {
      return null;
    }

    if (changes.status && changes.status !== previousStatus) {
      this.notifier.onTaskStatusChanged(updated, previousStatus);
    }
    if (changes.assignedToEmployeeId && changes.assignedToEmployeeId !== previousAssignee) {
      this.notifier.onTaskAssigned(updated);
    }

    this.recordActivity('task', updated.id, 'Meeting task updated', updated.title);
    return updated;
  }

  /**
   * Builds the pre-meeting briefing for a customer: prior meetings, open tasks,
   * overdue tasks, completed since the previous meeting, and waiting-for-customer.
   * This is the R8 view from the Hebrew brief.
   */
  getCustomerPreparationSummary(customerId: string): CustomerPreparationSummary {
    const today = this.todayIso;
    const meetings = this.customerMeetingRepo.listByCustomer(customerId);
    const allTasks = this.meetingTaskRepo.listByCustomer(customerId);

    const openTasks = allTasks.filter((t) => isOpenStatus(t.status));
    const overdueTasks = allTasks.filter((t) => isOverdue(t, today));
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
      customerId,
      priorMeetings: meetings, // already sorted newest-first by listByCustomer
      openTasks,
      overdueTasks,
      completedSinceLastMeeting,
      waitingForCustomer,
      latestMeetingDate: lastMeeting?.meetingDate,
      nextMeetingDate
    };
  }

  // Attachments (mock)

  attachmentsFor(entityType: AttachmentEntityType, entityId: string): Attachment[] {
    return this.attachments.list(entityType, entityId);
  }

  async uploadAttachment(
    file: File,
    entityType: AttachmentEntityType,
    entityId: string
  ): Promise<Attachment> {
    const attachment = await this.attachments.upload(file, entityType, entityId, this.currentEmployeeId);
    this.recordActivity('task', entityId, 'Attachment uploaded', attachment.fileName);
    return attachment;
  }

  // Drawer integration for meeting tasks

  selectMeetingTask(task: MeetingTask, openDrawer = true): void {
    this.selectedTaskId = task.id;
    this.selectedTaskKind = 'meeting-task';
    this.drawerOpen = openDrawer;
    this.saveToStorage();
  }

  selectBoardTask(task: TaskItem, openDrawer = true): void {
    this.selectedTaskId = task.id;
    this.selectedTaskKind = 'board-task';
    this.drawerOpen = openDrawer;
    this.saveToStorage();
  }

  get selectedMeetingTask(): MeetingTask | undefined {
    if (this.selectedTaskKind !== 'meeting-task') {
      return undefined;
    }
    return this.meetingTaskRepo.get(this.selectedTaskId);
  }

  /**
   * Re-export helpers used by feature components.
   */
  isOpenMeetingTaskStatus(status: MeetingTaskStatus): boolean {
    return isOpenStatus(status);
  }

  isMeetingTaskOverdue(task: MeetingTask): boolean {
    return isOverdue(task, this.todayIso);
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
  get myOpenMeetingTasks(): MeetingTask[] {
    return this.meetingTasks.filter(
      (t) =>
        t.assignedToEmployeeId === this.currentEmployeeId &&
        this.isOpenMeetingTaskStatus(t.status)
    );
  }

  /** Open meeting tasks due today or already overdue. */
  get myMeetingTasksDueToday(): MeetingTask[] {
    const today = this.todayIso;
    return this.myOpenMeetingTasks.filter((t) => !!t.dueDate && t.dueDate <= today);
  }

  /** All open meeting tasks (across customers and assignees). */
  get openMeetingTasks(): MeetingTask[] {
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
  myWorkMeetingTasks(tab: MyWorkTab): MeetingTask[] {
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
    return [];
  }

  // ─── Calendar ────────────────────────────────────────────────────────

  /**
   * Unified list of calendar events drawn from both the legacy internal
   * meeting and the v3 customer meetings. Sorted ascending by start time.
   * Used by the home calendar and the meetings page.
   */
  get calendarEvents(): CalendarEvent[] {
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
      customerName: this.customer(meeting.customerId)?.name,
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
        customerName: this.customer(meeting.customerId)?.name,
        attendeeCount: meeting.internalParticipantEmployeeIds.length + 1,
        sourceId: meeting.id
      }));

    return [internal, ...customers, ...followUps].sort((left, right) =>
      left.startsAt.localeCompare(right.startsAt)
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

  /** Next upcoming calendar event from "now". */
  get nextCalendarEvent(): CalendarEvent | undefined {
    const now = new Date().toISOString();
    return this.calendarEvents.find(event => event.startsAt >= now);
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

  private cloneMeetingTasks(source: MeetingTask[]): MeetingTask[] {
    return source.map((t) => ({
      ...t,
      attachmentIds: [...t.attachmentIds],
      notifications: t.notifications.map((n) => ({ ...n }))
    }));
  }

  private cloneAttachments(source: Attachment[]): Attachment[] {
    return source.map((a) => ({ ...a }));
  }
}
