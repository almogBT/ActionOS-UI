import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CreateMeetingTaskInput, MeetingNote, Priority } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';

@Component({
  selector: 'app-meeting-task-creation',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SearchableSelectComponent],
  template: `
    <section class="panel inline-create" (click)="$event.stopPropagation()">
      <div class="panel-header">
        <div>
          <span class="eyebrow">{{ 'meetingTask.title' | t }}</span>
          <h3>{{ 'meetingTask.createTask' | t }}</h3>
        </div>
        <div class="topbar-actions">
          <button type="button" class="ghost-action" (click)="cancelled.emit()">
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
          {{ 'meetingTask.openedBy' | t }}
          <input type="text" disabled [value]="workspace.employeeName(workspace.currentEmployeeId)" />
        </label>

        <label class="field-control">
          {{ 'meetingTask.dueDate' | t }}
          <input type="date" name="taskDue" [(ngModel)]="form.dueDate" />
        </label>

        <label class="field-control">
          {{ 'meetingTask.priority' | t }}
          <app-searchable-select
            name="taskPriority"
            [(ngModel)]="form.priority"
            [options]="priorityOptions"
          ></app-searchable-select>
        </label>
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
    small.muted { display: block; margin-top: 0.25rem; opacity: 0.7; }
    @media (max-width: 720px) {
      .form-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class MeetingTaskCreationComponent {
  @Input({ required: true }) meetingId!: string;
  @Input({ required: true }) customerId!: string;
  @Input() sourceNote: MeetingNote | null = null;
  @Output() created = new EventEmitter<string>();
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
      ...this.workspace.employees.map(e => ({ value: e.id, label: `${e.fullName} (${e.email})` }))
    ];
  }

  get priorityOptions(): SelectOption[] {
    return this.priorities.map(p => ({
      value: p, label: this.i18n.translate('priority.' + p.toLowerCase())
    }));
  }

  ngOnInit(): void {
    this.form.sourceMeetingId = this.meetingId;
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
    const task = this.workspace.createTaskFromMeeting(
      this.meetingId,
      this.form,
      this.sourceNote?.id
    );
    if (task) {
      this.created.emit(task.id);
    }
  }
}
