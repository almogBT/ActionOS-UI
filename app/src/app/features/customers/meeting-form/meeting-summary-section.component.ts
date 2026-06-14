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
}

/**
 * Wrap-up tab: the meeting summary, the "before publishing" follow-up checklist, and
 * the recap publish action. (The "notes for the next meeting" field now lives in the
 * Notes tab, and next-meeting scheduling was removed.)
 *
 * The parent owns the editable `draft` and the publish/recap lifecycle (so closing the
 * meeting can reuse it); this component just renders and emits intent.
 */
@Component({
  selector: 'app-meeting-summary-section',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <section class="summary-card">
      <div class="field-control wide">
        <textarea
          name="summary"
          rows="5"
          [(ngModel)]="draft.summary"
          (ngModelChange)="changed.emit()"
          [attr.aria-label]="'customerMeeting.summary' | t"
          [placeholder]="'customerMeeting.summaryPlaceholder' | t"
        ></textarea>
      </div>

    </section>
    <pre class="recap-preview" *ngIf="recap">{{ recap }}</pre>
  `,
  styles: [MEETING_FORM_STYLES, `
    /* The parent capture panel already provides the card chrome, so this section
       is just a spacing container — no nested border/background (avoids the
       "box inside a box" look). The global .summary-card rule (styles.scss) adds a
       border/padding/background card; this scoped rule has higher specificity and
       strips it so only the textarea keeps its border. */
    .summary-card {
      display: grid;
      gap: 12px;
      border: 0;
      padding: 0;
      background: transparent;
    }
    /* Checklist sits directly under the summary field, separated by a divider
       rather than its own card. */
    .summary-card .meeting-review-checklist {
      margin-top: 0;
      border: none;
      border-top: 1px solid var(--line);
      border-radius: 0;
      background: transparent;
      padding: 10px 0 0;
    }
    .summary-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .summary-actions small { color: var(--muted); flex: 1; min-width: 160px; }
    /* What each captured note said, listed under the count. */
    .meeting-review-checklist .checklist-notes {
      display: block;
      margin: 4px 0 2px;
      padding-inline-start: 16px;
      font-size: 12px;
      font-weight: 400;
      color: var(--text-secondary);
    }
    .meeting-review-checklist .checklist-notes li {
      list-style: disc;
      margin: 2px 0;
    }
    .checklist-note-type {
      font-weight: 700;
      color: var(--muted);
      margin-inline-end: 4px;
    }
  `]
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

  get openMeetingTasksCount(): number {
    if (!this.meeting) {
      return 0;
    }
    return this.workspace
      .meetingTasksByMeeting(this.meeting.id)
      .filter((t) => t.status !== 'Done' && t.status !== 'Cancelled').length;
  }

  /** Whether the pre-publish checklist has anything worth showing (else hide it). */
  get hasChecklistItems(): boolean {
    return this.actionsWithoutTaskCount > 0
      || this.openBlockerTaskCount > 0
      || this.capturedNotes.length > 0
      || this.openMeetingTasksCount > 0;
  }

  private linkedTaskForNote(note: MeetingNote): Task | undefined {
    if (!note.convertedTaskId) {
      return undefined;
    }
    return this.workspace.Task(note.convertedTaskId);
  }
}
