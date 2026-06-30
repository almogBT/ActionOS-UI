import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ACTIONOS_FEATURES } from '../../core/config/actionos-ui.config';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CreateMeetingTaskInput, MeetingNote, Priority } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';

export interface DraftMeetingTaskCreatedEvent {
  input: CreateMeetingTaskInput;
  sourceNote: MeetingNote | null;
}

@Component({
  selector: 'app-meeting-task-creation',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SearchableSelectComponent],
  template: `
    <section class="panel inline-create" (click)="$event.stopPropagation()">
      <div class="panel-header">
        <h3>{{ 'meetingTask.createTask' | t }}</h3>
      </div>

      <div class="form-grid">
        <label class="field-control wide">
          {{ 'meetingTask.taskTitle' | t }}
          <input
            type="text"
            name="taskTitle"
            [(ngModel)]="form.title"
            [placeholder]="'meetingTask.taskTitlePlaceholder' | t"
          />
        </label>

        <label class="field-control wide">
          {{ 'meetingTask.description' | t }}
          <textarea
            name="taskDesc"
            rows="2"
            [(ngModel)]="form.description"
            [placeholder]="'meetingTask.descriptionPlaceholder' | t"
          ></textarea>
        </label>

        <div class="task-meta-row" [class.no-priority]="!features.taskPriority">
          <label class="field-control">
            {{ 'meetingTask.assignedTo' | t }}
            <app-searchable-select
              name="taskAssignee"
              [(ngModel)]="form.assignedToEmployeeId"
              [options]="assigneeOptions"
            ></app-searchable-select>
            <small class="muted">{{ 'meetingTask.assignedToHint' | t }}</small>
          </label>

          <label class="field-control">
            {{ 'meetingTask.dueDate' | t }}
            <!-- lang="en-GB" forces the native date control to display dd/mm/yyyy
                 (it otherwise inherits the document's lang="en" → mm/dd/yyyy). The
                 stored value is unchanged (always yyyy-mm-dd). -->
            <input type="date" name="taskDue" lang="en-GB" [(ngModel)]="form.dueDate" />
          </label>

          <label class="field-control" *ngIf="features.taskPriority">
            {{ 'meetingTask.priority' | t }}
            <app-searchable-select
              name="taskPriority"
              [(ngModel)]="form.priority"
              [options]="priorityOptions"
            ></app-searchable-select>
          </label>
        </div>
      </div>

      <div class="create-actions">
        <button type="button" class="ghost-action" (click)="cancel()">
          {{ 'common.cancel' | t }}
        </button>
        <button
          type="button"
          class="primary-action"
          [disabled]="!canCreate()"
          (click)="create()"
        >
          {{ 'meetingTask.createTask' | t }}
        </button>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .inline-create {
      display: block;
      margin-top: 0;
      border-color: rgba(96, 165, 250, 0.4);
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    .field-control.wide { grid-column: 1 / -1; }
    /* Assigned to · Due date · Priority share one row. */
    .task-meta-row {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      align-items: start;
    }
    /* Priority hidden — assigned-to · due date fill the row. */
    .task-meta-row.no-priority { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    small.muted { display: block; margin-top: 0.25rem; opacity: 0.7; }
    /* Cancel / Create pinned to the bottom corner of the panel. */
    .create-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 1rem;
    }
    @media (max-width: 720px) {
      .form-grid { grid-template-columns: 1fr; }
      .task-meta-row { grid-template-columns: 1fr; }
    }
  `]
})
export class MeetingTaskCreationComponent implements OnInit, OnChanges {
  readonly features = ACTIONOS_FEATURES;
  @Input({ required: true }) meetingId!: string;
  @Input({ required: true }) customerId!: string;
  @Input() sourceNote: MeetingNote | null = null;
  @Input() draftMode = false;
  @Output() created = new EventEmitter<string>();
  @Output() draftCreated = new EventEmitter<DraftMeetingTaskCreatedEvent>();
  @Output() cancelled = new EventEmitter<void>();

  readonly priorities: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

  form: CreateMeetingTaskInput = {
    title: '',
    description: '',
    sourceMeetingId: '',
    assignedToEmployeeId: '',
    priority: 'Medium'
  };

  constructor(public workspace: ActionosWorkspaceService, private i18n: ActionosI18nService) {}

  get assigneeOptions(): SelectOption[] {
    return [
      { value: '', label: this.i18n.translate('meetingTask.selectAssignee') },
      ...this.workspace.employees.map(e => ({ value: e.id, label: e.fullName }))
    ];
  }

  get priorityOptions(): SelectOption[] {
    return this.priorities.map(p => ({
      value: p, label: this.i18n.translate('priority.' + p.toLowerCase())
    }));
  }

  ngOnInit(): void {
    this.resetForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['meetingId'] || changes['sourceNote']) {
      this.resetForm();
    }
  }

  private resetForm(): void {
    this.form = {
      title: '',
      description: '',
      sourceMeetingId: this.meetingId,
      assignedToEmployeeId: '',
      priority: 'Medium'
    };
    if (this.sourceNote) {
      this.form.title = this.sourceNote.content;
      this.form.assignedToEmployeeId = this.sourceNote.ownerId ?? '';
      this.form.dueDate = this.sourceNote.dueDate;
    }
  }

  canCreate(): boolean {
    return (
      !!this.form.title.trim() &&
      !!this.form.assignedToEmployeeId &&
      this.workspace.isAssignable(this.form.assignedToEmployeeId)
    );
  }

  create(): void {
    if (!this.canCreate()) {
      return;
    }
    const input: CreateMeetingTaskInput = {
      ...this.form,
      title: this.form.title.trim(),
      description: this.form.description?.trim() ?? '',
      dueDate: this.form.dueDate || undefined,
      sourceMeetingId: this.meetingId,
      customerId: this.customerId
    };
    if (this.draftMode) {
      this.draftCreated.emit({
        input,
        sourceNote: this.sourceNote
      });
      this.resetForm();
      return;
    }
    const task = this.workspace.createTaskFromMeeting(
      this.meetingId,
      input,
      this.sourceNote?.id
    );
    if (task) {
      this.created.emit(task.id);
      this.resetForm();
    }
  }

  cancel(): void {
    this.resetForm();
    this.cancelled.emit();
  }
}
