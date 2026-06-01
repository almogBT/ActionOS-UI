import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Comment, Priority, Task, TaskStatus } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';

type TaskSectionId = 'details' | 'attachments' | 'alerts' | 'checklist' | 'watchers' | 'comments';

@Component({
  selector: 'app-task-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SearchableSelectComponent],
  templateUrl: './task-drawer.component.html',
  styles: [`
    .task-attach-list { display: grid; gap: 6px; margin-top: 8px; }
    .task-attach-row {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px;
      border: 1px solid var(--line); border-radius: 8px;
      background: var(--bg-canvas);
    }
    .task-attach-name { flex: 1; font-size: 13px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .watcher-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .watcher-chip {
      display: flex; align-items: center; gap: 4px;
      padding: 4px 8px 4px 10px;
      border: 1px solid var(--line); border-radius: 999px;
      background: var(--bg-canvas); font-size: 13px; color: var(--text-primary);
    }
    .watcher-chip button { padding: 0 2px; font-size: 11px; line-height: 1; }
    .section-toggle { margin-inline-start: auto; min-width: 34px; }
    .section-body { display: grid; gap: 12px; margin-top: 10px; }
    .status-reason-hint { font-size: 12px; }
    .status-validation {
      margin: 0;
      color: #b91c1c;
      font-size: 12px;
      font-weight: 600;
    }
    .notification-status-note {
      display: grid;
      gap: 2px;
      border-inline-start: 3px solid var(--accent);
      padding-inline-start: 8px;
    }
    .task-modal-handle {
      width: 42px;
      height: 4px;
      border-radius: 999px;
      background: var(--line);
      margin: 2px auto 12px;
      flex-shrink: 0;
    }
  `]
})
export class TaskDrawerComponent {
  readonly priorities: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

  meetingChecklistText = '';
  meetingCommentText = '';
  uploadingAttachment = false;
  statusChangeReason = '';
  statusValidationMessage = '';
  pendingStatusChange: TaskStatus | null = null;
  pendingStatusTaskId: string | null = null;
  requestedWaitingStatus: TaskStatus | null = null;
  readonly collapsedSections: Record<TaskSectionId, boolean> = {
    details: false,
    attachments: false,
    alerts: false,
    checklist: false,
    watchers: true,
    comments: false
  };

  @ViewChild('drawerFileInput') drawerFileInput?: ElementRef<HTMLInputElement>;

  constructor(public workspace: ActionosWorkspaceService, private i18n: ActionosI18nService) {}

  get taskPriorityOptions(): SelectOption[] {
    return this.priorities.map(p => ({
      value: p,
      label: this.i18n.translate('priority.' + this.workspace.statusClass(p))
    }));
  }

  get meetingTaskStatusOptions(): SelectOption[] {
    return this.workspace.meetingTaskStatuses.map(s => ({
      value: s,
      label: this.i18n.translate('meetingTask.statusValues.' + s)
    }));
  }

  get employeeSelectOptions(): SelectOption[] {
    return this.workspace.employees.map(e => ({ value: e.id, label: e.fullName }));
  }

  watcherSelectModel: string | null = null;

  watcherCandidateOptions(task: Task): SelectOption[] {
    return this.workspace.employees
      .filter(e => !task.watcherEmployeeIds.includes(e.id))
      .map(e => ({ value: e.id, label: e.fullName }));
  }

  onWatcherSelect(task: Task, employeeId: string): void {
    if (!employeeId) return;
    this.workspace.toggleMeetingTaskWatcher(task, employeeId, true);
    this.watcherSelectModel = null;
  }

  isSectionCollapsed(section: TaskSectionId): boolean {
    return this.collapsedSections[section];
  }

  toggleSection(section: TaskSectionId): void {
    this.collapsedSections[section] = !this.collapsedSections[section];
  }

  isWaitingStatus(status: TaskStatus): boolean {
    return status === 'Waiting For Customer' || status === 'Waiting For Internal';
  }

  isCompletedStatus(status: TaskStatus): boolean {
    return status === 'Done';
  }

  showWaitingReason(task: Task): boolean {
    return this.isWaitingStatus(task.status) || !!(this.requestedWaitingStatus && this.isWaitingStatus(this.requestedWaitingStatus));
  }

  onStatusReasonChanged(): void {
    if (this.statusValidationMessage) {
      this.statusValidationMessage = '';
    }
  }

  closeDrawer(): void {
    this.resetStatusChangeState();
    this.workspace.closeTaskDrawer();
  }

  shouldShowStatusReason(task: Task): boolean {
    return this.pendingStatusTaskId === task.id
      && (
        !!this.pendingStatusChange
        || !!this.statusValidationMessage
        || !!this.statusChangeReason.trim()
      );
  }

  get statusReasonWordCount(): number {
    return this.wordCount(this.statusChangeReason);
  }

  notificationCount(task: Task): number {
    return task.notifications.length + this.statusAlertComments(task).length;
  }

  statusAlertComments(task: Task): Comment[] {
    return this.workspace
      .commentsForMeetingTask(task.id)
      .filter((comment) => this.isStatusChangeComment(comment.body));
  }

  private isStatusChangeComment(body: string): boolean {
    return /^status changed from /i.test(body.trim());
  }

  updateMeetingTaskField<K extends keyof Task>(task: Task, field: K, value: Task[K]): void {
    this.workspace.updateMeetingTask(task.id, { [field]: value } as Partial<Task>);
    if (field === 'waitingReason' && this.statusValidationMessage) {
      this.statusValidationMessage = '';
    }
  }

  updateMeetingTaskStatus(task: Task, status: TaskStatus): void {
    if (status === task.status) {
      if (this.pendingStatusTaskId === task.id) {
        this.resetStatusChangeState();
      }
      return;
    }
    this.pendingStatusTaskId = task.id;
    this.pendingStatusChange = status;

    const reason = this.statusChangeReason.trim();
    if (this.wordCount(reason) < 3) {
      this.statusValidationMessage = 'Please add at least 3 words explaining this status change.';
      return;
    }
    if (this.isWaitingStatus(status) && !(task.waitingReason?.trim())) {
      this.requestedWaitingStatus = status;
      this.statusValidationMessage = 'Please add a waiting reason before moving this task to a waiting status.';
      return;
    }

    const updated = this.workspace.updateMeetingTask(task.id, { status }, reason);
    if (!updated) {
      this.statusValidationMessage = 'Unable to change task status right now.';
      return;
    }

    this.resetStatusChangeState();
  }

  addMeetingChecklistItem(task: Task): void {
    this.workspace.addMeetingTaskChecklistItem(task, this.meetingChecklistText);
    this.meetingChecklistText = '';
  }

  addMeetingComment(task: Task): void {
    this.workspace.addMeetingTaskComment(task.id, this.meetingCommentText);
    this.meetingCommentText = '';
  }

  triggerFileInput(): void {
    this.drawerFileInput?.nativeElement.click();
  }

  async onFileSelected(event: Event, task: Task): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }
    this.uploadingAttachment = true;
    for (const file of Array.from(input.files)) {
      await this.workspace.uploadAttachment(file, 'meeting-task', task.id);
    }
    this.uploadingAttachment = false;
    input.value = '';
  }

  private wordCount(value: string): number {
    return value
      .trim()
      .split(/\s+/)
      .filter((token) => !!token).length;
  }

  private resetStatusChangeState(): void {
    this.pendingStatusChange = null;
    this.pendingStatusTaskId = null;
    this.requestedWaitingStatus = null;
    this.statusChangeReason = '';
    this.statusValidationMessage = '';
  }
}
