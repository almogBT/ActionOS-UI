import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Comment, Priority, Task, TaskStatus, UpdateMeetingTaskInput } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { DrawerShellComponent } from '../shared/drawer-shell/drawer-shell.component';

type TaskSectionId = 'details' | 'attachments' | 'alerts' | 'checklist' | 'watchers' | 'comments';

@Component({
  selector: 'app-task-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, AppDatePipe, SearchableSelectComponent, DrawerShellComponent],
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
    .task-attach-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .watcher-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .watcher-chip {
      display: flex; align-items: center; gap: 4px;
      padding: 4px 8px 4px 10px;
      border: 1px solid var(--line); border-radius: 999px;
      background: var(--bg-canvas); font-size: 13px; color: var(--text-primary);
    }
    .watcher-chip button { padding: 0 2px; font-size: 11px; line-height: 1; }
    .req { color: #dc2626; font-weight: 700; }
    .field-missing .req { color: #dc2626; }
    .field-missing app-searchable-select { outline: 1px solid #f87171; border-radius: var(--radius-md); }
    .customer-hint { color: #dc2626; font-size: 12px; }
    .drawer-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 6px;
      margin: 6px 0 0;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .section-toggle { margin-inline-start: auto; min-width: 34px; }
    .section-body { display: grid; gap: 14px; margin-top: 10px; }
    /* Rows inside the details section keep their own grid; cancel the global
       field-control top margin so the section gap drives the rhythm. */
    .section-body .field-control { margin-top: 0; }
    /* ── Summary header ─────────────────────────────────────────── */
    .dh-meta-line {
      display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px;
      margin: 0; font-size: 12px; color: var(--text-secondary);
    }
    .dh-meta-line .eyebrow { color: var(--text-tertiary); }
    .dh-meta-line .dh-client { color: var(--accent-strong); font-weight: 800; }

    .drawer-header { display: flex; }
    .dh-title-wrap { flex: 1; min-width: 0; }
    .dh-title-row { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
    .dh-title-input {
      flex: 1; min-width: 0;
      border: 1px solid transparent; border-radius: var(--radius-md); background: transparent;
      color: var(--text-primary); font-size: 22px; font-weight: 800; line-height: 1.2;
      padding: 4px 8px; margin-inline-start: -8px;
      transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out);
    }
    .dh-title-input:hover { background: var(--bg-sunken); }
    .dh-title-input:focus { outline: none; border-color: var(--accent); background: var(--bg-elevated); box-shadow: 0 0 0 3px var(--accent-soft); }

    /* Labeled chip row — status · priority · assignee, each with a title above */
    .dh-fields {
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px; margin-top: 14px;
    }
    .dh-field { display: grid; gap: 6px; min-width: 0; }
    .dh-field-label {
      font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--text-tertiary);
    }
    @media (max-width: 560px) { .dh-fields { grid-template-columns: 1fr; } }

    .chip-select { min-width: 0; width: 100%; }
    ::ng-deep .chip-select .ss-trigger {
      min-height: 34px; padding: 5px 30px 5px 14px;
      border-radius: var(--radius-pill); border-color: transparent;
      background-color: var(--bg-sunken); font-size: 12px; font-weight: 800;
    }
    [dir="rtl"] ::ng-deep .chip-select .ss-trigger { padding: 5px 14px 5px 30px; }

    ::ng-deep .status-chip-select.new .ss-trigger,
    ::ng-deep .status-chip-select.done .ss-trigger { color: var(--success); background-color: var(--success-soft); }
    ::ng-deep .status-chip-select.planned .ss-trigger { color: var(--info); background-color: var(--info-soft); }
    ::ng-deep .status-chip-select.in-progress .ss-trigger,
    ::ng-deep .status-chip-select.sent-to-owner .ss-trigger { color: var(--accent-strong); background-color: var(--accent-soft); }
    ::ng-deep .status-chip-select.waiting .ss-trigger,
    ::ng-deep .status-chip-select.waiting-for-customer .ss-trigger,
    ::ng-deep .status-chip-select.waiting-for-internal .ss-trigger { color: var(--warning); background-color: var(--warning-soft); }

    ::ng-deep .priority-chip-select.low .ss-trigger { color: var(--success); background-color: var(--success-soft); }
    ::ng-deep .priority-chip-select.medium .ss-trigger { color: var(--info); background-color: var(--info-soft); }
    ::ng-deep .priority-chip-select.high .ss-trigger { color: var(--warning); background-color: var(--warning-soft); }
    ::ng-deep .priority-chip-select.critical .ss-trigger { color: var(--text-on-accent); background-color: var(--danger); }

    .chip-date {
      display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
      height: 38px; padding: 0 16px; border-radius: var(--radius-pill);
      background: var(--bg-sunken); font-size: 14px; font-weight: 800; color: var(--text-secondary);
    }
    .chip-date input { border: none; background: transparent; color: inherit; font: inherit; padding: 0; min-height: 0; font-size: 14px; }
    .chip-date.overdue { background: var(--danger-soft); color: var(--danger); }

    .dh-reason {
      display: grid; gap: 10px; margin-top: 12px; padding: 12px 14px;
      border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--bg-sunken);
    }
    .dh-reason .primary-action.small { justify-self: start; min-height: 32px; padding: 0 16px; font-size: 12px; font-weight: 700; }

    /* Watchers — compact block near the bottom */
    .dh-watchers {
      display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
      margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle);
    }
    .dh-watchers-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); }
    .dh-watchers .chip-select { width: auto; min-width: 140px; }

    /* Footer buttons: normal size, distributed across the row */
    .drawer-footer { display: flex; gap: 10px; justify-content: space-between; align-items: center; }

    /* Bottom actions of the Details section — add-step ↔ attach-file */
    .details-actions {
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px; flex-wrap: wrap; margin-top: 4px;
    }

    /* ── Details sub-blocks (checklist / files) ─────────────────── */
    .details-block { display: grid; gap: 8px; }
    .details-block-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .details-block-head .eyebrow { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); }
    .details-block-head .muted { font-size: 12px; font-weight: 700; }

    /* Add-watcher "+" chip */
    .watcher-add { width: auto; }
    ::ng-deep .watcher-add .ss-trigger {
      min-height: 30px; padding: 4px 14px;
      border: none; border-radius: var(--radius-pill);
      background-color: var(--accent-soft); background-image: none;
      color: var(--accent-strong); font-size: 14px; font-weight: 800; cursor: pointer;
    }
    ::ng-deep .watcher-add .ss-trigger:hover { background-color: var(--accent); color: var(--text-on-accent); }
    ::ng-deep .watcher-add .ss-placeholder { color: inherit; font-weight: 800; }

    /* ── Activity timeline — flat rows, no card-in-card ─────────── */
    .section-body .comment-list { gap: 0; margin-top: 12px; }
    .section-body .comment {
      border: none; background: transparent; border-radius: 0; margin: 0;
      padding: 12px 0; border-bottom: 1px solid var(--border-subtle);
      display: grid; gap: 4px;
    }
    .section-body .comment:last-child { border-bottom: none; }
    .comment-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .comment-head strong { font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .comment-head small { flex-shrink: 0; font-size: 11px; color: var(--text-tertiary); }
    .section-body .comment p { margin: 0; color: var(--text-secondary); line-height: 1.45; }
    .section-body .comment.is-system { border-inline-start: 3px solid var(--border-strong); padding-inline-start: 12px; }
    .section-body .comment.is-system .comment-head strong { color: var(--text-tertiary); }
    .status-reason-hint { font-size: 12px; }
    .add-status-row { display: flex; gap: 6px; margin-top: 6px; }
    .add-status-row input {
      flex: 1; min-width: 0; height: 30px;
      border: 1px solid var(--accent); border-radius: 8px;
      background: var(--bg-elevated); color: var(--ink);
      font-size: 13px; padding: 0 10px;
    }
    .add-status-row button {
      height: 30px; padding: 0 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .add-status-row .add-confirm { border: none; background: var(--accent); color: #fff; }
    .add-status-row .add-cancel { border: 1px solid var(--line); background: var(--bg-elevated); color: var(--text-secondary); }
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
  /** Reveals the checklist input when a task has no steps yet. */
  addingStep = false;
  addingStatus = false;
  newStatusDraft = '';
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
      label: this.workspace.isCustomStatus(s) ? s : this.i18n.translate('meetingTask.statusValues.' + s)
    }));
  }

  get employeeSelectOptions(): SelectOption[] {
    return this.workspace.employees.map(e => ({ value: e.id, label: e.fullName }));
  }

  get customerSelectOptions(): SelectOption[] {
    return this.workspace.clientOptions.map(client => ({ value: client.id, label: client.name }));
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
    this.workspace.updateMeetingTask(task.id, { [field]: value } as UpdateMeetingTaskInput);
    if (field === 'waitingReason' && this.statusValidationMessage) {
      this.statusValidationMessage = '';
    }
  }

  /** Non-meeting tasks must always be tied to a client. Meeting tasks inherit
   *  their client from the meeting, so this only applies to board/standalone. */
  isMissingCustomer(task: Task): boolean {
    return task.source !== 'meeting' && !task.customerId?.trim();
  }

  /** Assign/clear the task's client. Routed through its own handler so the
   *  required-client rule is enforced and the change is always persisted. */
  changeTaskCustomer(task: Task, customerId: string): void {
    this.workspace.updateMeetingTask(task.id, { customerId });
  }

  startAddStatus(): void {
    this.addingStatus = true;
    this.newStatusDraft = '';
  }

  cancelAddStatus(): void {
    this.addingStatus = false;
    this.newStatusDraft = '';
  }

  /** Create a custom status (if new) and apply it through the normal status flow. */
  confirmAddStatus(task: Task): void {
    const label = this.workspace.addCustomStatus(this.newStatusDraft);
    this.addingStatus = false;
    this.newStatusDraft = '';
    if (label) {
      this.updateMeetingTaskStatus(task, label as TaskStatus);
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

  /** Apply the staged status once a reason has been entered (chip → reason → confirm). */
  confirmStatusChange(task: Task): void {
    if (this.pendingStatusChange) {
      this.updateMeetingTaskStatus(task, this.pendingStatusChange);
    }
  }

  /** Status-change entries are stored as comments; show them as system rows in the timeline. */
  isStatusComment(body: string): boolean {
    return this.isStatusChangeComment(body);
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
