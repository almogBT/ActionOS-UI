import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CustomerMeeting, MeetingNote, Task } from '../../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../../core/services/actionos-workspace.service';
import { DraftMeetingTaskCreatedEvent, MeetingTaskCreationComponent } from '../meeting-task-creation.component';
import { MEETING_FORM_STYLES } from './meeting-form.styles';

/**
 * Tasks generated from a meeting: always-visible task creation plus all linked
 * task cards with inline progression updates.
 *
 * Kept prominent because the primary user (account managers) tracks follow-ups here.
 * Task data is read live from the workspace by `meetingId`; the parent drives task
 * creation by passing the source note via `creatingTaskForNote`.
 */
@Component({
  selector: 'app-meeting-tasks-section',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, MeetingTaskCreationComponent],
  template: `
    <app-meeting-task-creation
      *ngIf="meeting.customerId"
      [meetingId]="meeting.id"
      [customerId]="meeting.customerId"
      [sourceNote]="creatingTaskForNote"
      [draftMode]="draftMode"
      (created)="onCreated()"
      (draftCreated)="onDraftCreated($event)"
      (cancelled)="onCancelCreate()"
    />

    <div class="linked-task-list" *ngIf="meetingTasks.length; else noLinkedTasks">
      <div class="linked-task-card" *ngFor="let task of meetingTasks">
        <div class="linked-task-row">
          <button type="button" class="linked-task-title-btn" [disabled]="draftMode" (click)="openMeetingTask(task)">
            <strong>{{ task.title }}</strong>
            <small class="muted">
              {{ 'common.owner' | t }}: {{ workspace.employeeName(task.assignedToEmployeeId) }} · {{ 'common.due' | t }} {{ task.dueDate || '-' }}
            </small>
          </button>
          <div class="linked-task-meta">
            <span class="status-chip" [ngClass]="workspace.statusClass(task.status)">
              {{ ('meetingTask.statusValues.' + task.status) | t }}
            </span>
            <button
              type="button"
              class="ghost-action small progress-toggle"
              [class.active]="expandedTaskId === task.id"
              (click)="toggleTaskExpanded(task.id)"
            >
              {{ (task.progressionNotes?.length || 0) }} {{ 'customerMeeting.updates' | t }}
              {{ expandedTaskId === task.id ? '▲' : '▼' }}
            </button>
          </div>
        </div>

        <div class="progression-notes-panel" *ngIf="expandedTaskId === task.id">
          <div class="progression-note-row" *ngFor="let pn of task.progressionNotes">
            <span class="muted">{{ pn.createdAt | slice:0:10 }} · {{ workspace.employeeName(pn.authorEmployeeId) }}</span>
            <p>{{ pn.content }}</p>
          </div>
          <div class="progression-empty" *ngIf="!task.progressionNotes?.length">
            <small class="muted">{{ 'customerMeeting.noUpdatesYet' | t }}</small>
          </div>
          <div class="progression-add-row">
            <input
              type="text"
              [name]="'progress-' + task.id"
              [(ngModel)]="newProgressionNoteByTask[task.id]"
              [placeholder]="'customerMeeting.addUpdatePlaceholder' | t"
              (keydown.enter)="addProgressionNote(task)"
            />
            <button
              type="button"
              class="ghost-action small"
              [disabled]="!(newProgressionNoteByTask[task.id] ?? '').trim()"
              (click)="addProgressionNote(task)"
            >
              {{ 'customerMeeting.addUpdate' | t }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <ng-template #noLinkedTasks>
      <div class="empty-state compact-empty">
        <strong>{{ 'customerMeeting.noTasksInFilter' | t }}</strong>
        <small class="muted">{{ 'customerMeeting.emptyTasksHint' | t }}</small>
      </div>
    </ng-template>
  `,
  styles: [MEETING_FORM_STYLES]
})
export class MeetingTasksSectionComponent {
  @Input() meeting!: CustomerMeeting;
  @Input() creatingTaskForNote: MeetingNote | null = null;
  @Input() draftMode = false;
  @Input() draftTasks: Task[] = [];

  @Output() taskCreated = new EventEmitter<void>();
  @Output() draftTaskCreated = new EventEmitter<DraftMeetingTaskCreatedEvent>();
  @Output() cancelCreate = new EventEmitter<void>();

  expandedTaskId: string | null = null;
  newProgressionNoteByTask: Record<string, string | undefined> = {};

  constructor(public workspace: ActionosWorkspaceService) {}

  onCreated(): void {
    this.taskCreated.emit();
  }

  onDraftCreated(event: DraftMeetingTaskCreatedEvent): void {
    this.draftTaskCreated.emit(event);
  }

  onCancelCreate(): void {
    this.cancelCreate.emit();
  }

  get meetingTasks(): Task[] {
    if (!this.meeting) {
      return [];
    }
    if (this.draftMode) {
      return this.draftTasks;
    }
    return this.workspace.meetingTasksByMeeting(this.meeting.id);
  }

  toggleTaskExpanded(taskId: string): void {
    this.expandedTaskId = this.expandedTaskId === taskId ? null : taskId;
  }

  addProgressionNote(task: Task): void {
    const content = (this.newProgressionNoteByTask[task.id] ?? '').trim();
    if (!content) {
      return;
    }
    if (this.draftMode) {
      const note = {
        id: `draft-progress-${Date.now()}`,
        content,
        authorEmployeeId: this.workspace.currentEmployeeId,
        createdAt: new Date().toISOString()
      };
      task.progressionNotes = [...(task.progressionNotes ?? []), note];
      this.newProgressionNoteByTask[task.id] = undefined;
      return;
    }
    this.workspace.addTaskProgressionNote(task.id, content);
    this.newProgressionNoteByTask[task.id] = undefined;
  }

  openMeetingTask(task: Task): void {
    if (this.draftMode) {
      return;
    }
    this.workspace.selectMeetingTask(task, true);
  }
}
