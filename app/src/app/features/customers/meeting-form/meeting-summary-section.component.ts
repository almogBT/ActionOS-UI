import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { CustomerMeeting, MeetingNote, Task } from '../../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../../core/services/actionos-workspace.service';
import { MEETING_FORM_STYLES } from './meeting-form.styles';

/** Editable wrap-up fields the parent owns and persists alongside the rest of the meeting. */
export interface MeetingSummaryDraft {
  summary: string;
  nextMeetingDateLocal: string;
  nextMeetingNotes: string;
}

/**
 * Wrap-up tab: meeting summary, next-meeting date/notes, the "before publishing"
 * follow-up checklist, and the recap publish action.
 *
 * Tailored for the account-manager flow — the next-meeting fields and open-follow-up
 * counts are front and centre. The parent owns the editable `draft` (so it can persist
 * everything in one call) and owns the publish/recap lifecycle (so closing the meeting
 * can reuse it); this component just renders and emits intent.
 */
@Component({
  selector: 'app-meeting-summary-section',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="form-grid">
      <label class="field-control wide">
        {{ 'customerMeeting.summary' | t }}
        <textarea
          name="summary"
          rows="5"
          [(ngModel)]="draft.summary"
          (ngModelChange)="changed.emit()"
          [placeholder]="'customerMeeting.summaryPlaceholder' | t"
        ></textarea>
      </label>

      <label class="field-control">
        {{ 'customerMeeting.nextMeetingDate' | t }}
        <input
          type="datetime-local"
          name="nextMeetingDate"
          [(ngModel)]="draft.nextMeetingDateLocal"
          (ngModelChange)="changed.emit()"
        />
      </label>

      <label class="field-control wide">
        {{ 'customerMeeting.nextMeetingNotes' | t }}
        <textarea
          name="nextMeetingNotes"
          rows="3"
          [(ngModel)]="draft.nextMeetingNotes"
          (ngModelChange)="changed.emit()"
          [placeholder]="'customerMeeting.nextMeetingNotesPlaceholder' | t"
        ></textarea>
        <small class="muted">{{ 'customerMeeting.nextMeetingNotesHint' | t }}</small>
      </label>
    </div>

    <section class="meeting-review-checklist">
      <strong>{{ 'customerMeeting.beforePublishing' | t }}</strong>
      <ul>
        <li [class.warn]="actionsWithoutTaskCount > 0" [class.checklist-link]="actionsWithoutTaskCount > 0" (click)="actionsWithoutTaskCount > 0 && goToNotes.emit()">
          {{ 'customerMeeting.reviewActionsWithoutTask' | t }}: {{ actionsWithoutTaskCount }}
          <span *ngIf="actionsWithoutTaskCount > 0" class="checklist-hint">→ review</span>
        </li>
        <li [class.warn]="openBlockerTaskCount > 0" [class.checklist-link]="openBlockerTaskCount > 0" (click)="openBlockerTaskCount > 0 && goToNotes.emit()">
          {{ 'customerMeeting.reviewBlockersOpen' | t }}: {{ openBlockerTaskCount }}
          <span *ngIf="openBlockerTaskCount > 0" class="checklist-hint">→ review</span>
        </li>
        <li [class.warn]="uncategorizedNotesCount > 0">
          {{ 'customerMeeting.reviewNotesCaptured' | t }}: {{ capturedNotes.length }} ({{ 'customerMeeting.reviewUncategorized' | t }}: {{ uncategorizedNotesCount }})
        </li>
        <li [class.blocking]="openMeetingTasksCount > 0" [class.checklist-link]="openMeetingTasksCount > 0" (click)="openMeetingTasksCount > 0 && goToTasks.emit()">
          {{ 'customerMeeting.reviewOpenTasks' | t }}: {{ openMeetingTasksCount }}
          <span *ngIf="openMeetingTasksCount > 0" class="blocking-note">— {{ 'customerMeeting.reviewOpenTasksNote' | t }}</span>
          <span *ngIf="openMeetingTasksCount > 0" class="checklist-hint">→ review</span>
        </li>
      </ul>
    </section>

    <div class="summary-publish-row">
      <button type="button" class="primary-action" (click)="publish.emit()">
        {{ 'customerMeeting.publishRecap' | t }}
      </button>
      <p class="muted">{{ 'customerMeeting.publishRecapHint' | t }}</p>
    </div>
    <pre class="recap-preview" *ngIf="recap">{{ recap }}</pre>
  `,
  styles: [MEETING_FORM_STYLES]
})
export class MeetingSummarySectionComponent {
  @Input() meeting!: CustomerMeeting;
  @Input() draft!: MeetingSummaryDraft;
  /** Latest recap text shown in the preview (owned by the parent). */
  @Input() recap = '';

  @Output() changed = new EventEmitter<void>();
  @Output() publish = new EventEmitter<void>();
  @Output() goToNotes = new EventEmitter<void>();
  @Output() goToTasks = new EventEmitter<void>();

  constructor(public workspace: ActionosWorkspaceService) {}

  get capturedNotes(): MeetingNote[] {
    return this.meeting?.notes ?? [];
  }

  get actionsWithoutTaskCount(): number {
    return this.capturedNotes.filter((n) => n.type === 'action' && !n.convertedTaskId).length;
  }

  get openBlockerTaskCount(): number {
    return this.capturedNotes
      .filter((n) => n.type === 'blocker')
      .filter((n) => {
        const linked = this.linkedTaskForNote(n);
        if (!linked) {
          return true;
        }
        return this.workspace.isOpenMeetingTaskStatus(linked.status);
      }).length;
  }

  get uncategorizedNotesCount(): number {
    return this.capturedNotes.filter((n) => n.type === 'note').length;
  }

  get openMeetingTasksCount(): number {
    if (!this.meeting) {
      return 0;
    }
    return this.workspace
      .meetingTasksByMeeting(this.meeting.id)
      .filter((t) => t.status !== 'Done' && t.status !== 'Cancelled').length;
  }

  private linkedTaskForNote(note: MeetingNote): Task | undefined {
    if (!note.convertedTaskId) {
      return undefined;
    }
    return this.workspace.Task(note.convertedTaskId);
  }
}
