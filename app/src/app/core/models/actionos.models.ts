export type ViewId = 'home' | 'inbox' | 'my-work' | 'boards' | 'meetings' | 'customers';
export type TaskStatus =
  | 'Inbox'
  | 'Planned'
  | 'In Progress'
  | 'Waiting'
  | 'New'
  | 'Sent To Owner'
  | 'Waiting For Customer'
  | 'Waiting For Internal'
  | 'Done'
  | 'Cancelled';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type NoteType = 'note' | 'decision' | 'action' | 'blocker';
export type QuickCaptureType = 'task' | NoteType;
export type MyWorkTab = 'today' | 'upcoming' | 'watched' | 'blocked';
export type ActivityTargetType = 'task' | 'meeting' | 'member' | 'agenda' | 'template';
export type CommentTargetType = 'task' | 'meeting';

export type NavSection = 'main' | 'work';

export interface NavItem {
  id: ViewId;
  label: string;
  shortcut: string;
  section: NavSection;
}

export interface Member {
  id: string;
  name: string;
  role: string;
  team: string;
  availability: 'Focused' | 'Available' | 'In meeting';
}

export interface CreateMemberInput {
  name: string;
  role: string;
  team: string;
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export type TaskSource = 'board' | 'meeting';

export interface ProgressionNote {
  id: string;
  content: string;
  authorEmployeeId: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  source: TaskSource;
  board: string;
  customerId: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  assigneeIds: string[];
  watcherIds: string[];
  assignedToEmployeeId: string;
  openedByEmployeeId: string;
  watcherEmployeeIds: string[];
  attachmentIds: string[];
  notifications: NotificationLogEntry[];
  sourceMeetingId: string;
  waitingReason?: string;
  completedAt?: string;
  treatmentNotes?: string;
  blockedBy?: string;
  checklist: ChecklistItem[];
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  progressionNotes?: ProgressionNote[];
  /** Member id of whoever opened/created the task. Drives the "I opened" /
   *  "assigned to me by others" people-filters on the Home metric popups. */
  createdByUserId?: string;
}

export interface CreateTaskInput {
  title: string;
  board?: string;
  source?: TaskSource;
  customerId?: string;
  sourceMeetingId?: string;
  openedByEmployeeId?: string;
  assignedToEmployeeId?: string;
  priority: Priority;
  dueDate?: string;
  assigneeId?: string;
  description?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  board?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string;
  assigneeIds?: string[];
  watcherIds?: string[];
  sourceMeetingId?: string;
  blockedBy?: string;
}

export interface MeetingNote {
  id: string;
  type: NoteType;
  content: string;
  ownerId?: string;
  dueDate?: string;
  convertedTaskId?: string;
  attachmentIds?: string[];
  /** v3+: who wrote this note. May be a member id (legacy) or employee id (v3). */
  createdByEmployeeId?: string;
  /** v3+: when the note was written. ISO timestamp. */
  createdAt?: string;
}

export interface CreateMeetingNoteInput {
  type: NoteType;
  content: string;
  ownerId?: string;
  dueDate?: string;
}

export interface UpdateMeetingNoteInput {
  type?: NoteType;
  content?: string;
  ownerId?: string;
  dueDate?: string;
  attachmentIds?: string[];
}

export interface AgendaItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  time: string;
  startsAt: string;
  durationMinutes: number;
  attendeeIds: string[];
  linkedBoard: string;
  agenda: AgendaItem[];
  notes: MeetingNote[];
}

export type CalendarEventKind = 'internal' | 'customer' | 'task';

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  kind: CalendarEventKind;
  customerName?: string;
  linkedBoard?: string;
  attendeeCount: number;
  sourceId: string;
}

export interface Comment {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  body: string;
  createdByUserId: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  targetType: ActivityTargetType;
  targetId: string;
  action: string;
  detail: string;
  createdAt: string;
}

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  board: string;
  tasks: Omit<CreateTaskInput, 'assigneeId'>[];
}

// ─────────────────────────────────────────────────────────────────────────
// v3: Customer Meeting Management module
// Future Fritz/Azure sources (see plans/17-meeting-module-monday-implementation.md):
//   Employee  ← reportcental.emp.EasyDoc_Employees_Dim (active, fritz/critilog email)
//   Customer  ← reportcental.[dig].[Servitz_Customers_Groups]
// ─────────────────────────────────────────────────────────────────────────

export type EmployeeSourceSystem = 'Fritz' | 'Mock';

export interface Employee {
  id: string;
  externalEmployeeId?: string;
  fullName: string;
  email: string;
  team: string;
  role: string;
  isActive: boolean;
  sourceSystem: EmployeeSourceSystem;
}

export type CustomerType = 'Existing' | 'Prospect';
export type CustomerStatus = 'Active' | 'Prospect' | 'At Risk' | 'Inactive';

export interface Customer {
  id: string;
  externalGroupId: string | null;
  name: string;
  type: CustomerType;
  status: CustomerStatus;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  accountOwnerEmployeeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  type: CustomerType;
  externalGroupId?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  accountOwnerEmployeeId?: string;
}

export type CustomerMeetingStatus = 'Planned' | 'Draft Summary' | 'Tasks Created' | 'Closed';

export interface CustomerParticipant {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
}

export interface CustomerMeeting {
  id: string;
  customerId: string;
  subject: string;
  meetingDate: string;
  meetingLeaderEmployeeId: string;
  internalParticipantEmployeeIds: string[];
  customerParticipants: CustomerParticipant[];
  goal?: string;
  summary?: string;
  publishedRecap?: string;
  notes: MeetingNote[];
  nextMeetingDate?: string;
  nextMeetingNotes?: string;
  status: CustomerMeetingStatus;
  attachmentIds: string[];
  externalCrmMeetingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerMeetingInput {
  customerId: string;
  subject: string;
  meetingDate: string;
  meetingLeaderEmployeeId: string;
  internalParticipantEmployeeIds?: string[];
  customerParticipants?: CustomerParticipant[];
  goal?: string;
}

export interface UpdateCustomerMeetingInput {
  subject?: string;
  meetingDate?: string;
  meetingLeaderEmployeeId?: string;
  internalParticipantEmployeeIds?: string[];
  customerParticipants?: CustomerParticipant[];
  goal?: string;
  summary?: string;
  publishedRecap?: string;
  nextMeetingDate?: string;
  nextMeetingNotes?: string;
  status?: CustomerMeetingStatus;
}

export type NotificationEvent = 'assigned' | 'status-changed' | 'due-soon';
export type NotificationChannel = 'email' | 'in-app';

export interface NotificationLogEntry {
  event: NotificationEvent;
  channel: NotificationChannel;
  sentAt: string;
  recipientEmployeeId: string;
}

export interface CreateMeetingTaskInput {
  title: string;
  description?: string;
  sourceMeetingId: string;
  customerId?: string;
  openedByEmployeeId?: string;
  assignedToEmployeeId: string;
  dueDate?: string;
  priority?: Priority;
}

export interface UpdateMeetingTaskInput {
  title?: string;
  description?: string;
  assignedToEmployeeId?: string;
  dueDate?: string;
  priority?: Priority;
  status?: TaskStatus;
  watcherEmployeeIds?: string[];
  checklist?: ChecklistItem[];
  waitingReason?: string;
  completedAt?: string;
  treatmentNotes?: string;
  progressionNotes?: ProgressionNote[];
}

export type AttachmentEntityType = 'customer-meeting' | 'meeting-task' | 'meeting-note' | 'customer';

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  linkedEntityType: AttachmentEntityType;
  linkedEntityId: string;
  uploadedAt: string;
  uploadedByEmployeeId: string;
}

export interface CustomerPreparationSummary {
  customerId: string;
  priorMeetings: CustomerMeeting[];
  openTasks: Task[];
  overdueTasks: Task[];
  completedSinceLastMeeting: Task[];
  waitingForCustomer: Task[];
  latestMeetingDate?: string;
  nextMeetingDate?: string;
}

export interface MailNotificationPrefs {
  newTasks: boolean;
  overdueTasks: boolean;
  dueTodayTasks: boolean;
  meetingSummaries: boolean;
}
