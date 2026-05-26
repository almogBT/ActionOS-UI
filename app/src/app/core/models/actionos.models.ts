export type ViewId = 'home' | 'inbox' | 'my-work' | 'boards' | 'meetings' | 'customers' | 'members';
export type TaskStatus = 'Inbox' | 'Planned' | 'In Progress' | 'Waiting' | 'Done';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type NoteType = 'note' | 'decision' | 'action' | 'blocker';
export type QuickCaptureType = 'task' | NoteType;
export type MyWorkTab = 'today' | 'upcoming' | 'watched' | 'blocked';
export type ActivityTargetType = 'task' | 'meeting' | 'member' | 'agenda' | 'template';
export type CommentTargetType = 'task' | 'meeting';

export interface NavItem {
  id: ViewId;
  label: string;
  shortcut: string;
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

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  board: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  assigneeIds: string[];
  watcherIds: string[];
  sourceMeetingId?: string;
  blockedBy?: string;
  checklist: ChecklistItem[];
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  board: string;
  priority: Priority;
  dueDate: string;
  assigneeId: string;
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
  blockedBy?: string;
}

export interface MeetingNote {
  id: string;
  type: NoteType;
  content: string;
  ownerId?: string;
  dueDate?: string;
  convertedTaskId?: string;
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

export type CalendarEventKind = 'internal' | 'customer';

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
  notes: MeetingNote[];
  nextMeetingDate?: string;
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
  nextMeetingDate?: string;
  status?: CustomerMeetingStatus;
}

export type MeetingTaskStatus =
  | 'New'
  | 'Sent To Owner'
  | 'In Progress'
  | 'Waiting For Customer'
  | 'Waiting For Internal'
  | 'Done'
  | 'Cancelled';

export type NotificationEvent = 'assigned' | 'status-changed' | 'due-soon';
export type NotificationChannel = 'email' | 'in-app';

export interface NotificationLogEntry {
  event: NotificationEvent;
  channel: NotificationChannel;
  sentAt: string;
  recipientEmployeeId: string;
}

export interface MeetingTask {
  id: string;
  title: string;
  description: string;
  customerId: string;
  sourceMeetingId: string;
  openedByEmployeeId: string;
  assignedToEmployeeId: string;
  dueDate?: string;
  priority: Priority;
  status: MeetingTaskStatus;
  attachmentIds: string[];
  treatmentNotes?: string;
  notifications: NotificationLogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMeetingTaskInput {
  title: string;
  description?: string;
  sourceMeetingId: string;
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
  status?: MeetingTaskStatus;
  treatmentNotes?: string;
}

export type AttachmentEntityType = 'customer-meeting' | 'meeting-task' | 'customer';

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
  openTasks: MeetingTask[];
  overdueTasks: MeetingTask[];
  completedSinceLastMeeting: MeetingTask[];
  waitingForCustomer: MeetingTask[];
  latestMeetingDate?: string;
  nextMeetingDate?: string;
}
