import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ACTIONOS_FEATURES } from '../../core/config/actionos-ui.config';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Comment, Priority, Task, TaskStatus, UpdateMeetingTaskInput } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { MEETING_FORM_STYLES } from '../customers/meeting-form/meeting-form.styles';

type TaskSectionId = 'setup' | 'activity';

/**
 * The task editing form. Extracted verbatim from the old `TaskDrawerComponent`
 * so the exact same UI can be used in two hosts:
 *   - inside `app-task-drawer` (a `drawer-shell` modal) for editing an existing
 *     task, and
 *   - embedded directly on the Tasks page (right pane) for creating a new task.
 *
 * The form edits the `task` it is given live (each field change is persisted via
 * `workspace.updateMeetingTask`). It does not own selection/drawer state. When a
 * brand-new draft task gets a client assigned it is persisted into a real task
 * with a new id; `updateMeetingTask` returns that saved task and the form emits
 * `persisted` so an embedded host can rebind and keep editing it inline.
 */
@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, AppDatePipe, SearchableSelectComponent],
  templateUrl: './task-form.component.html',
  styles: [MEETING_FORM_STYLES, `
    /* Small clearance below the sticky action bar (large values become dead space
       when the form is short). */
    :host { padding-bottom: 16px; }
    /* Per-panel collapse toggle in each panel header (chevron rotates when collapsed). */
    .panel-header-lead { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .section-toggle {
      flex-shrink: 0; border: 0; background: transparent; color: var(--muted);
      cursor: pointer; font-size: 13px; line-height: 1; padding: 4px; border-radius: 6px;
      transition: transform 150ms ease, background 150ms ease;
    }
    .section-toggle:hover { background: var(--bg-hover, var(--surface-strong)); }
    .section-toggle.collapsed { transform: rotate(-90deg); }

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

    /* Labeled chip row — status · priority · assignee, each with a title above */
    .dh-fields {
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px; margin-top: 14px;
    }
    /* Priority hidden — status · assignee fill the row evenly. */
    .dh-fields.no-priority { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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

    /* Due-date field turns red once it's overdue (and not yet done). */
    input[type="date"].overdue { border-color: var(--danger); color: var(--danger); }

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
export class TaskFormComponent {
  readonly features = ACTIONOS_FEATURES;
  readonly priorities: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

  /** The task to edit — an existing task or a fresh new-task draft. */
  @Input() task!: Task;
  /** Raised when the user dismisses the form (the "Close" button). */
  @Output() closed = new EventEmitter<void>();
  /**
   * Raised when a draft task is persisted into a real task (its id changes).
   * Embedded hosts listen to this to rebind the form to the saved task so the
   * user keeps editing it inline; the drawer host can ignore it.
   */
  @Output() persisted = new EventEmitter<Task>();

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
    setup: false,
    activity: false
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

  /** Meetings of the task's client, for the (new-task-only) meeting link picker.
   *  Leads with a "no meeting" option so a chosen meeting can be cleared. */
  meetingSelectOptions(task: Task): SelectOption[] {
    if (!task.customerId) {
      return [];
    }
    const meetings = this.workspace.customerMeetingsByCustomer(task.customerId).map(meeting => ({
      value: meeting.id,
      label: meeting.subject?.trim() || this.i18n.translate('customerMeeting.untitledMeeting')
    }));
    return [{ value: '', label: this.i18n.translate('meetingTask.noMeeting') }, ...meetings];
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

  /** Smooth-scroll to a panel when its stepper step is clicked (mirrors the meeting form). */
  scrollToId(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Current lifecycle stage for the progress stepper:
   *   1 = Set up    (no client yet, or no title)
   *   2 = Details   (client + title set, task not yet done)
   *   3 = Done      (status is Done)
   */
  taskStage(task: Task): 1 | 2 | 3 {
    if (this.isMissingCustomer(task) || !task.title?.trim()) {
      return 1;
    }
    return this.isCompletedStatus(task.status) ? 3 : 2;
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

  /** Dismiss the form. Resets transient status-change state then notifies the host. */
  close(): void {
    this.resetStatusChangeState();
    this.closed.emit();
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
    const result = this.workspace.updateMeetingTask(task.id, { [field]: value } as UpdateMeetingTaskInput);
    // A field edit can be what finally persists a draft into a real task — with the
    // client-first gate that's the title, entered after the client. When the id
    // changes, tell the host to rebind so editing continues on the saved task.
    if (result && result.id !== task.id) {
      this.persisted.emit(result);
    }
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
   *  required-client rule is enforced and the change is always persisted.
   *  Assigning a client to a new draft persists it into a real task; we surface
   *  that via `persisted` so an embedded host can keep editing it inline. */
  changeTaskCustomer(task: Task, customerId: string): void {
    const changes: UpdateMeetingTaskInput = { customerId };
    // Meetings are client-specific, so switching the client clears any meeting
    // that was linked to the previous one (it would no longer be selectable).
    if (customerId !== task.customerId && task.sourceMeetingId) {
      changes.sourceMeetingId = '';
    }
    const result = this.workspace.updateMeetingTask(task.id, changes);
    if (result && result.id !== task.id) {
      this.persisted.emit(result);
    }
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
