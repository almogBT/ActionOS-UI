import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CustomerMeeting, Task } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

export type BoardPreviewType = 'client' | 'member';
type BoardTab = 'meetings' | 'tasks';

/**
 * Quick-view popup opened from Home when the user clicks a workload member row
 * or a client row. Shows the same data as the Boards tab client/member board
 * but without navigating away from Home.
 *
 * Client mode: two tabs — Meetings (CustomerMeeting list) and Tasks (Task list).
 * Member mode: single Tasks view (Task list — board tasks assigned to or opened by them).
 */
@Component({
  selector: 'app-board-preview-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="modal-backdrop" role="presentation" (click)="close.emit()">
      <aside class="modal-card" role="dialog" [attr.aria-label]="entityName" (click)="$event.stopPropagation()">

        <header class="modal-header">
          <div class="header-text">
            <span class="eyebrow">{{ (entityType === 'client' ? 'boardPreview.clientEyebrow' : 'boardPreview.memberEyebrow') | t }}</span>
            <h2>{{ entityName }}</h2>
          </div>
          <div class="header-actions">
            <button type="button" class="primary-action" (click)="newMeeting.emit()">
              {{ 'boardPreview.newMeeting' | t }}
            </button>
            <button *ngIf="entityType === 'client'" type="button" class="ghost-action" (click)="prepareMeeting.emit()">
              {{ 'customers.prepareMeeting' | t }}
            </button>
            <button *ngIf="entityType === 'client'" type="button" class="ghost-action" (click)="openFullProfile.emit()">
              {{ 'boardPreview.fullProfile' | t }}
            </button>
            <button type="button" class="ghost-action" (click)="close.emit()">{{ 'common.close' | t }}</button>
          </div>
        </header>

        <!-- Tab strip: both tabs for client, single "Tasks" label for member -->
        <div class="tab-strip" *ngIf="entityType === 'client'">
          <button type="button" [class.active]="activeTab === 'meetings'" (click)="activeTab = 'meetings'">
            {{ 'boardPreview.meetings' | t }} ({{ clientMeetings.length }})
          </button>
          <button type="button" [class.active]="activeTab === 'tasks'" (click)="activeTab = 'tasks'">
            {{ 'boardPreview.tasks' | t }} ({{ clientTasks.length }})
          </button>
        </div>

        <!-- CLIENT — Meetings -->
        <div *ngIf="entityType === 'client' && activeTab === 'meetings'" class="modal-list">
          <div *ngFor="let m of clientMeetings" class="preview-row">
            <div class="preview-main">
              <strong>{{ m.subject }}</strong>
              <small>{{ m.meetingDate | slice:0:10 }} · {{ workspace.employeeName(m.meetingLeaderEmployeeId) }}</small>
            </div>
            <span class="status-chip" [ngClass]="workspace.statusClass(m.status)">{{ m.status }}</span>
          </div>
          <div *ngIf="!clientMeetings.length" class="empty-state">
            <strong>{{ 'boardPreview.noMeetings' | t }}</strong>
          </div>
        </div>

        <!-- CLIENT — Tasks -->
        <div *ngIf="entityType === 'client' && activeTab === 'tasks'" class="modal-list">
          <div *ngFor="let t of clientTasks" class="preview-row">
            <span class="status-dot" [ngClass]="workspace.statusClass(t.status)"></span>
            <div class="preview-main">
              <strong>{{ t.title }}</strong>
              <small>{{ workspace.employeeName(t.assignedToEmployeeId) }}<ng-container *ngIf="t.dueDate"> · {{ 'common.due' | t }} {{ t.dueDate }}</ng-container></small>
            </div>
            <span class="priority" [ngClass]="workspace.statusClass(t.priority)">{{ ('priority.' + workspace.statusClass(t.priority)) | t }}</span>
          </div>
          <div *ngIf="!clientTasks.length" class="empty-state">
            <strong>{{ 'boardPreview.noTasks' | t }}</strong>
          </div>
        </div>

        <!-- MEMBER — Tasks -->
        <div *ngIf="entityType === 'member'" class="modal-list">
          <button
            *ngFor="let t of memberMeetingTasks"
            type="button"
            class="preview-row preview-row-btn"
            (click)="workspace.selectMeetingTask(t); close.emit()"
          >
            <span class="status-dot" [ngClass]="workspace.statusClass(t.status)"></span>
            <div class="preview-main">
              <strong>{{ t.title }}</strong>
              <small>{{ workspace.customer(t.customerId)?.name }} · {{ 'common.due' | t }} {{ t.dueDate }}</small>
            </div>
            <span class="priority" [ngClass]="workspace.statusClass(t.priority)">{{ ('priority.' + workspace.statusClass(t.priority)) | t }}</span>
          </button>
          <button
            *ngFor="let t of memberTasks"
            type="button"
            class="preview-row preview-row-btn"
            (click)="workspace.openTaskDrawer(t); close.emit()"
          >
            <span class="status-dot" [ngClass]="workspace.statusClass(t.status)"></span>
            <div class="preview-main">
              <strong>{{ t.title }}</strong>
              <small>{{ t.board }} · {{ 'common.due' | t }} {{ t.dueDate }}</small>
            </div>
            <span class="priority" [ngClass]="workspace.statusClass(t.priority)">{{ ('priority.' + workspace.statusClass(t.priority)) | t }}</span>
          </button>
          <div *ngIf="!memberTasks.length && !memberMeetingTasks.length" class="empty-state">
            <strong>{{ 'boardPreview.noTasks' | t }}</strong>
          </div>
        </div>

      </aside>
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(20, 30, 50, 0.45);
      display: grid;
      place-items: center;
      z-index: 50;
      padding: 1rem;
    }

    .modal-card {
      background: var(--bg-elevated);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: var(--shadow);
      max-width: 640px;
      width: 100%;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 20px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
    }

    .header-text .eyebrow {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      font-weight: 800;
    }

    .modal-header h2 { margin: 4px 0 0; font-size: 20px; }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
    }

    .modal-list {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
    }

    .preview-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-canvas);
      transition: border-color var(--duration-fast) var(--ease-out);
    }

    .preview-row-btn {
      width: 100%;
      text-align: start;
      cursor: pointer;
      color: inherit;
    }

    .preview-row-btn:hover,
    .preview-row:hover { border-color: var(--accent); }

    .preview-main {
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .preview-main strong {
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .preview-main small { font-size: 11px; color: var(--muted); }

    .status-chip {
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: var(--radius-pill);
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .status-chip.planned     { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }
    .status-chip.draft-summary { background: var(--warning-soft); color: var(--warning); }
    .status-chip.tasks-created { background: var(--accent-soft); color: var(--accent); }
    .status-chip.closed      { background: var(--bg-sunken); color: var(--text-tertiary); }

    .empty-state { padding: 1.5rem; text-align: center; color: var(--muted); }
  `]
})
export class BoardPreviewModalComponent implements OnChanges {
  @Input() entityType: BoardPreviewType = 'member';
  @Input() entityId = '';
  @Input() entityName = '';
  @Output() close = new EventEmitter<void>();
  /** Client mode only: open Customer 360 detail page. */
  @Output() openFullProfile = new EventEmitter<void>();
  /** Open a new meeting pre-filled for this entity. */
  @Output() newMeeting = new EventEmitter<void>();
  /** Client mode only: open meeting prep for this customer. */
  @Output() prepareMeeting = new EventEmitter<void>();

  activeTab: BoardTab = 'tasks';

  constructor(public workspace: ActionosWorkspaceService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entityType'] || changes['entityId']) {
      this.activeTab = this.entityType === 'client' ? 'meetings' : 'tasks';
    }
  }

  get clientMeetings(): CustomerMeeting[] {
    if (this.entityType !== 'client' || !this.entityId) return [];
    return this.workspace.customerMeetingsByCustomer(this.entityId)
      .slice()
      .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
  }

  get clientTasks(): Task[] {
    if (this.entityType !== 'client' || !this.entityId) return [];
    return this.workspace.meetingTasksByCustomer(this.entityId);
  }

  get memberTasks(): Task[] {
    return [];
  }

  get memberMeetingTasks(): Task[] {
    if (this.entityType !== 'member' || !this.entityId) return [];
    const employeeId = this.workspace.employeeIdForMember(this.entityId);
    if (!employeeId) {
      return [];
    }
    return this.workspace.meetingTasks.filter(t =>
      t.assignedToEmployeeId === employeeId || t.openedByEmployeeId === employeeId
    );
  }
}

