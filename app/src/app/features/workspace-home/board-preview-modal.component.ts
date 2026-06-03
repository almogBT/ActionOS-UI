import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CustomerMeeting, Task } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { StatMeetingsViewComponent } from '../../shared/stat-modal/stat-meetings-view.component';
import { StatModalComponent, StatModalView } from '../../shared/stat-modal/stat-modal.component';
import { StatTasksViewComponent } from '../../shared/stat-modal/stat-tasks-view.component';

export type BoardPreviewType = 'client' | 'member';
type BoardTab = 'meetings' | 'tasks';

/**
 * Quick-view popup opened from Home when the user clicks a workload member row
 * or a client row. Shows the same data as the Boards tab client/member board
 * but without navigating away from Home.
 *
 * Built on the shared <app-stat-modal> shell. Client mode exposes both a
 * Meetings and a Tasks view (the shell renders the segmented switch between
 * them); member mode shows the single Tasks view with no switch.
 */
@Component({
  selector: 'app-board-preview-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe, StatModalComponent, StatMeetingsViewComponent, StatTasksViewComponent],
  template: `
    <app-stat-modal
      [eyebrow]="(entityType === 'client' ? 'boardPreview.clientEyebrow' : 'boardPreview.memberEyebrow') | t"
      [title]="entityName"
      [closeLabel]="'common.close' | t"
      [views]="views"
      [(activeView)]="activeTab"
      (close)="close.emit()"
    >
      <ng-container statActions>
        <button type="button" class="primary-action" (click)="newMeeting.emit()">
          {{ 'boardPreview.newMeeting' | t }}
        </button>
        <button *ngIf="entityType === 'client'" type="button" class="ghost-action" (click)="prepareMeeting.emit()">
          {{ 'customers.prepareMeeting' | t }}
        </button>
        <button *ngIf="entityType === 'client'" type="button" class="ghost-action" (click)="openFullProfile.emit()">
          {{ 'boardPreview.fullProfile' | t }}
        </button>
      </ng-container>

      <!-- CLIENT — Meetings -->
      <app-stat-meetings-view
        *ngIf="entityType === 'client' && activeTab === 'meetings'"
        [meetings]="clientMeetings"
        [emptyText]="'boardPreview.noMeetings' | t"
        (meetingOpened)="close.emit()"
      ></app-stat-meetings-view>

      <!-- CLIENT — Tasks -->
      <app-stat-tasks-view
        *ngIf="entityType === 'client' && activeTab === 'tasks'"
        [tasks]="clientTasks"
        [newTaskDefaults]="{ customerId: entityId }"
        [emptyText]="'boardPreview.noTasks' | t"
        (rowOpened)="close.emit()"
      ></app-stat-tasks-view>

      <!-- MEMBER — Tasks (single view, no switch) -->
      <app-stat-tasks-view
        *ngIf="entityType === 'member'"
        [tasks]="memberAllTasks"
        [emptyText]="'boardPreview.noTasks' | t"
        (rowOpened)="close.emit()"
      ></app-stat-tasks-view>
    </app-stat-modal>
  `
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

  readonly workspace = inject(ActionosWorkspaceService);
  private readonly i18n = inject(ActionosI18nService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entityType'] || changes['entityId']) {
      this.activeTab = this.entityType === 'client' ? 'meetings' : 'tasks';
    }
  }

  /** Client gets a Meetings/Tasks switch; member has a single tasks view. */
  get views(): StatModalView[] {
    if (this.entityType !== 'client') return [];
    return [
      { id: 'meetings', label: this.i18n.translate('boardPreview.meetings'), count: this.clientMeetings.length },
      { id: 'tasks', label: this.i18n.translate('boardPreview.tasks'), count: this.clientTasks.length },
    ];
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

  /** All of a member's tasks (meeting + board) for the shared table. */
  get memberAllTasks(): Task[] {
    return [...this.memberMeetingTasks, ...this.memberTasks];
  }
}
