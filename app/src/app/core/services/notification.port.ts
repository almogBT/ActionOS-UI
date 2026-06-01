import { Task, TaskStatus, NotificationLogEntry } from '../models/actionos.models';

/**
 * Outbound notification boundary.
 *
 * Future Fritz/Azure implementation: HomePage_Server posts to an Azure Logic App
 * which sends email to the opener and the assignee. The recipients rule comes
 * directly from Dana Lerner's Monday note: "send email alert to open user and
 * assigned user".
 *
 * This local implementation appends entries to task.notifications[] and writes
 * a console log line; no real email/Teams provider call is sent from the UI.
 */
export interface NotificationPort {
  onTaskAssigned(task: Task): Promise<void>;
  onTaskStatusChanged(task: Task, previousStatus: TaskStatus): Promise<void>;
  onTaskDueSoon(task: Task): Promise<void>;
}

export class LocalMockNotificationAdapter implements NotificationPort {
  constructor(
    private readonly save: () => void,
    private readonly now: () => string,
  ) {}

  async onTaskAssigned(task: Task): Promise<void> {
    this.log(task, 'assigned', [task.openedByEmployeeId, task.assignedToEmployeeId]);
  }

  async onTaskStatusChanged(
    task: Task,
    previousStatus: TaskStatus,
  ): Promise<void> {
    if (task.status === previousStatus) {
      return;
    }
    this.log(task, 'status-changed', [task.openedByEmployeeId]);
  }

  async onTaskDueSoon(task: Task): Promise<void> {
    this.log(task, 'due-soon', [task.assignedToEmployeeId]);
  }

  private log(
    task: Task,
    event: NotificationLogEntry['event'],
    recipients: string[],
  ): void {
    const sentAt = this.now();
    const unique = Array.from(new Set(recipients.filter(Boolean)));
    for (const recipient of unique) {
      task.notifications.push({
        event,
        channel: 'email',
        sentAt,
        recipientEmployeeId: recipient,
      });
    }
    this.save();
    // eslint-disable-next-line no-console
    console.info('[ActionOS notification local]', event, task.id, unique);
  }
}
