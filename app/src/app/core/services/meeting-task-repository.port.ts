import {
  CreateMeetingTaskInput,
  MeetingTask,
  MeetingTaskStatus,
  Priority,
  UpdateMeetingTaskInput,
} from '../models/actionos.models';

/**
 * Boundary for meeting-driven tasks. Each task is born from a CustomerMeeting note
 * (or directly from a meeting), carries customerId + sourceMeetingId, and is owned
 * by an Employee from the Fritz directory.
 */
export interface MeetingTaskRepositoryPort {
  list(): MeetingTask[];
  listByCustomer(customerId: string): MeetingTask[];
  listByMeeting(meetingId: string): MeetingTask[];
  listByAssignee(employeeId: string): MeetingTask[];
  get(id: string): MeetingTask | undefined;
  add(
    input: CreateMeetingTaskInput,
    openedByEmployeeId: string,
    customerId: string,
  ): MeetingTask;
  update(id: string, changes: UpdateMeetingTaskInput): MeetingTask | null;
}

interface MeetingTaskState {
  meetingTasks: MeetingTask[];
}

const OPEN_STATUSES: ReadonlySet<MeetingTaskStatus> = new Set<MeetingTaskStatus>([
  'New',
  'Sent To Owner',
  'In Progress',
  'Waiting For Customer',
  'Waiting For Internal',
]);

export function isOpenStatus(status: MeetingTaskStatus): boolean {
  return OPEN_STATUSES.has(status);
}

export function isOverdue(task: MeetingTask, todayIso: string): boolean {
  return Boolean(task.dueDate) && task.dueDate! < todayIso && isOpenStatus(task.status);
}

export class InMemoryMeetingTaskRepository implements MeetingTaskRepositoryPort {
  constructor(
    private readonly state: MeetingTaskState,
    private readonly save: () => void,
    private readonly idFactory: () => string,
    private readonly now: () => string,
  ) {}

  list(): MeetingTask[] {
    return this.state.meetingTasks.slice();
  }

  listByCustomer(customerId: string): MeetingTask[] {
    return this.state.meetingTasks.filter((t) => t.customerId === customerId);
  }

  listByMeeting(meetingId: string): MeetingTask[] {
    return this.state.meetingTasks.filter((t) => t.sourceMeetingId === meetingId);
  }

  listByAssignee(employeeId: string): MeetingTask[] {
    return this.state.meetingTasks.filter((t) => t.assignedToEmployeeId === employeeId);
  }

  get(id: string): MeetingTask | undefined {
    return this.state.meetingTasks.find((t) => t.id === id);
  }

  add(
    input: CreateMeetingTaskInput,
    openedByEmployeeId: string,
    customerId: string,
  ): MeetingTask {
    const timestamp = this.now();
    const priority: Priority = input.priority ?? 'Medium';
    const task: MeetingTask = {
      id: this.idFactory(),
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      customerId,
      sourceMeetingId: input.sourceMeetingId,
      openedByEmployeeId,
      assignedToEmployeeId: input.assignedToEmployeeId,
      dueDate: input.dueDate,
      priority,
      status: 'New',
      attachmentIds: [],
      treatmentNotes: '',
      notifications: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.state.meetingTasks.push(task);
    this.save();
    return task;
  }

  update(id: string, changes: UpdateMeetingTaskInput): MeetingTask | null {
    const target = this.state.meetingTasks.find((t) => t.id === id);
    if (!target) {
      return null;
    }
    Object.assign(target, changes, { updatedAt: this.now() });
    this.save();
    return target;
  }
}
