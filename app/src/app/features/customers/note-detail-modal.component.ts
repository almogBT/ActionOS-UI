import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CustomerMeeting,
  MeetingNote,
  MeetingTask
} from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

/**
 * Popup shown when the user clicks a meeting note tile. Surfaces the full note
 * detail: type, content, author, when it was captured, owner, due date, and a
 * link to the converted task if one was created.
 */
@Component({
  selector: 'app-note-detail-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div
      class="modal-backdrop"
      role="presentation"
      (click)="close.emit()"
    >
      <aside
        class="modal-card"
        role="dialog"
        aria-label="Note details"
        (click)="$event.stopPropagation()"
      >
        <header class="modal-header">
          <div>
            <span class="status-chip" [ngClass]="note.type">
              {{ ('noteType.' + note.type) | t }}
            </span>
            <h2>{{ 'noteDetail.title' | t }}</h2>
          </div>
          <button type="button" class="ghost-action" (click)="close.emit()">
            {{ 'common.close' | t }}
          </button>
        </header>

        <p class="note-body">{{ note.content }}</p>

        <dl class="meta-grid">
          <div>
            <dt>{{ 'noteDetail.author' | t }}</dt>
            <dd>{{ authorName }}</dd>
          </div>
          <div *ngIf="note.createdAt">
            <dt>{{ 'noteDetail.capturedAt' | t }}</dt>
            <dd>{{ note.createdAt | slice:0:16 }}</dd>
          </div>
          <div *ngIf="note.ownerId">
            <dt>{{ 'common.owner' | t }}</dt>
            <dd>{{ ownerName }}</dd>
          </div>
          <div *ngIf="note.dueDate">
            <dt>{{ 'common.dueDate' | t }}</dt>
            <dd>{{ note.dueDate }}</dd>
          </div>
          <div *ngIf="meeting">
            <dt>{{ 'noteDetail.fromMeeting' | t }}</dt>
            <dd>{{ meeting.subject }}</dd>
          </div>
        </dl>

        <section *ngIf="linkedTask" class="linked-task">
          <span class="eyebrow">{{ 'noteDetail.linkedTask' | t }}</span>
          <button type="button" class="task-link" (click)="openTask()">
            <strong>{{ linkedTask.title }}</strong>
            <span class="status-chip" [ngClass]="workspace.statusClass(linkedTask.status)">
              {{ ('meetingTask.statusValues.' + linkedTask.status) | t }}
            </span>
          </button>
        </section>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(24, 34, 31, 0.45);
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
      max-width: 520px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
    }
    .modal-header h2 { margin: 8px 0 0; font-size: 20px; }
    .note-body {
      margin: 0;
      padding: 12px 14px;
      background: var(--surface-strong);
      border-radius: 8px;
      white-space: pre-wrap;
      line-height: 1.5;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
      margin: 0;
    }
    .meta-grid div { display: flex; flex-direction: column; gap: 2px; }
    .meta-grid dt {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      font-weight: 800;
    }
    .meta-grid dd { margin: 0; font-size: 14px; }
    .linked-task {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface-strong);
    }
    .task-link {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      background: transparent;
      border: 0;
      padding: 0;
      text-align: start;
      color: inherit;
      cursor: pointer;
    }
    .task-link strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
  `]
})
export class NoteDetailModalComponent {
  @Input({ required: true }) note!: MeetingNote;
  @Input() meeting: CustomerMeeting | null = null;
  @Output() close = new EventEmitter<void>();

  constructor(public workspace: ActionosWorkspaceService) {}

  get authorName(): string {
    if (!this.note.createdByEmployeeId) {
      return '—';
    }
    return this.workspace.employeeName(this.note.createdByEmployeeId);
  }

  get ownerName(): string {
    if (!this.note.ownerId) {
      return '—';
    }
    // ownerId may be either an employee id or a legacy member id
    const employee = this.workspace.employeeName(this.note.ownerId);
    return employee !== '—' ? employee : this.workspace.memberName(this.note.ownerId);
  }

  get linkedTask(): MeetingTask | undefined {
    if (!this.note.convertedTaskId) {
      return undefined;
    }
    return this.workspace.meetingTask(this.note.convertedTaskId);
  }

  openTask(): void {
    const task = this.linkedTask;
    if (task) {
      this.workspace.selectMeetingTask(task);
      this.close.emit();
    }
  }
}
