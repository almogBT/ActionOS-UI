import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ActionosI18nService } from '../../../core/i18n/actionos-i18n.service';
import {
  CreateMeetingNoteInput, CustomerMeeting, MeetingNote, NoteType, Task, UpdateMeetingNoteInput
} from '../../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../../core/services/actionos-workspace.service';
import { SearchableSelectComponent, SelectOption } from '../../../shared/searchable-select/searchable-select.component';
import { NoteDetailModalComponent } from '../note-detail-modal.component';
import { MEETING_FORM_STYLES } from './meeting-form.styles';

/**
 * Notes capture + list for a customer meeting.
 *
 * Simplification for non-technical users: the composer now offers only two kinds of
 * entry — **Note** and **Action** (an Action carries an owner + due date and can be
 * promoted to a task). The legacy `decision`/`blocker` types are no longer offered
 * when creating notes, but existing notes of those types still render and can be
 * edited (their original type is preserved in the edit dropdown).
 *
 * The component owns only the transient composer/edit drafts; it reads the meeting
 * from its `meeting` input and performs persistence through the workspace service,
 * emitting `(changed)` so the parent can reload the authoritative meeting.
 */
@Component({
  selector: 'app-meeting-notes-section',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SearchableSelectComponent, NoteDetailModalComponent],
  template: `
    <form class="capture-shell" (ngSubmit)="captureNote()">
      <div class="capture-type-row">
        <button
          type="button"
          class="capture-chip"
          *ngFor="let option of captureTypeOptions"
          [class.active]="newNote.type === option"
          (click)="setNoteType(option)"
        >
          <span>{{ ('noteType.' + option) | t }}</span>
        </button>
      </div>

      <label class="field-control wide composer-control">
        <input
          #noteComposerInput
          type="text"
          name="noteContent"
          [(ngModel)]="newNote.content"
          [placeholder]="'customerMeeting.noteContentPlaceholder' | t"
          (keydown)="onComposerKeydown($event)"
        />
      </label>

      <div class="capture-grid" *ngIf="newNote.type === 'action'">
        <label class="field-control">
          {{ 'common.owner' | t }}
          <app-searchable-select
            name="noteOwner"
            [(ngModel)]="newNote.ownerId"
            [options]="noteOwnerOptions"
          ></app-searchable-select>
        </label>
        <label class="field-control">
          {{ 'common.dueDate' | t }}
          <input type="date" name="noteDue" [(ngModel)]="newNote.dueDate" />
        </label>
      </div>

      <div class="capture-actions-row">
        <button type="submit" class="primary-action" [disabled]="!canAddNote()">
          {{ 'customerMeeting.addNote' | t }}
        </button>
        <button
          *ngIf="canCreateTaskFromType(newNote.type)"
          type="button"
          class="ghost-action"
          [disabled]="!canAddNote()"
          (click)="captureNote(true)"
        >
          {{ 'customerMeeting.captureAndTask' | t }}
        </button>
        <button type="button" class="ghost-action small" (click)="triggerNoteAttachInput()">
          📎 {{ pendingAttachmentFile ? pendingAttachmentFile.name : ('customerMeeting.attachFile' | t) }}
        </button>
        <input #noteAttachInput type="file" style="display:none" (change)="onPendingAttachSelected($event)" />
      </div>

      <p class="muted action-hint" *ngIf="newNote.type === 'action' && (!newNote.ownerId || !newNote.dueDate)">
        {{ 'customerMeeting.actionNeedsOwnerDue' | t }}
      </p>
    </form>

    <div class="notes-list" id="notes-list" *ngIf="capturedNotes.length; else noNotesYet">
      <div *ngFor="let n of capturedNotes; trackBy: trackNote" class="note-row">
        <span class="status-chip" [ngClass]="n.type">
          {{ ('noteType.' + n.type) | t }}
        </span>
        <div class="note-content">
          <ng-container *ngIf="editingNoteId !== n.id; else editNoteForm">
            <p>{{ n.content }}</p>
            <div class="muted">
              <span *ngIf="n.createdByEmployeeId">{{ workspace.employeeName(n.createdByEmployeeId) }}</span>
              <span *ngIf="n.createdAt">- {{ n.createdAt | slice:0:10 }}</span>
              <span *ngIf="n.ownerId">- {{ 'common.owner' | t }}: {{ workspace.employeeName(n.ownerId) }}</span>
              <span *ngIf="n.dueDate">- {{ 'common.due' | t }} {{ n.dueDate }}</span>
            </div>
            <div class="note-linked" *ngIf="linkedTaskForNote(n) as linked">
              <span class="status-chip linked-chip">{{ 'customerMeeting.convertedToTask' | t }}</span>
              <span class="status-chip" [ngClass]="workspace.statusClass(linked.status)">
                {{ ('meetingTask.statusValues.' + linked.status) | t }}
              </span>
            </div>
            <small class="muted" *ngIf="n.type === 'action' && !isActionReady(n)">
              {{ 'customerMeeting.actionNeedsOwnerDue' | t }}
            </small>
          </ng-container>
          <ng-template #editNoteForm>
            <div class="note-edit-grid">
              <app-searchable-select
                [name]="'editType-' + n.id"
                [(ngModel)]="editingNoteDraft.type"
                [options]="editTypeOptions(n)"
              ></app-searchable-select>
              <input
                [name]="'editContent-' + n.id"
                type="text"
                [(ngModel)]="editingNoteDraft.content"
              />
              <app-searchable-select
                [name]="'editOwner-' + n.id"
                [(ngModel)]="editingNoteDraft.ownerId"
                [options]="noteOwnerOptions"
              ></app-searchable-select>
              <input
                [name]="'editDue-' + n.id"
                type="date"
                [(ngModel)]="editingNoteDraft.dueDate"
              />
            </div>
          </ng-template>
        </div>
        <div class="note-actions">
          <button
            *ngIf="editingNoteId !== n.id"
            type="button"
            class="ghost-action"
            (click)="startEditingNote(n)"
          >
            {{ 'common.edit' | t }}
          </button>
          <button
            *ngIf="editingNoteId === n.id"
            type="button"
            class="primary-action"
            [disabled]="!canSaveEditedNote()"
            (click)="saveEditedNote(n)"
          >
            {{ 'common.save' | t }}
          </button>
          <button
            *ngIf="editingNoteId === n.id"
            type="button"
            class="ghost-action"
            (click)="cancelEditingNote()"
          >
            {{ 'common.cancel' | t }}
          </button>
          <button
            type="button"
            class="ghost-action danger"
            (click)="deleteNote(n)"
          >
            {{ 'common.delete' | t }}
          </button>
          <button
            *ngIf="canCreateTaskFromNote(n) && !n.convertedTaskId"
            type="button"
            class="primary-action"
            [disabled]="n.type === 'action' && !isActionReady(n)"
            (click)="requestTaskCreation(n)"
          >
            {{ 'customerMeeting.createTaskFromNote' | t }}
          </button>
          <button
            *ngIf="linkedTaskForNote(n) as linked"
            type="button"
            class="ghost-action"
            (click)="openMeetingTask(linked)"
          >
            {{ 'customerMeeting.openTask' | t }}
          </button>
          <button
            *ngIf="editingNoteId !== n.id"
            type="button"
            class="ghost-action"
            (click)="openNoteDetail(n)"
          >
            {{ 'customerMeeting.noteDetails' | t }}
          </button>
          <button
            *ngIf="editingNoteId !== n.id"
            type="button"
            class="ghost-action small"
            (click)="triggerNoteRowAttach(n.id)"
          >
            📎
          </button>
          <input
            [id]="'note-attach-' + n.id"
            type="file"
            style="display:none"
            (change)="onNoteRowFileSelected($event, n.id)"
          />
        </div>
        <div class="note-attachments" *ngIf="workspace.noteAttachments(n.id).length">
          <div class="note-attach-chip" *ngFor="let att of workspace.noteAttachments(n.id)">
            <span>{{ att.fileName }}</span>
            <button
              type="button"
              [disabled]="!workspace.canDownloadAttachment(att)"
              (click)="workspace.downloadAttachment(att)"
              [title]="'customerMeeting.download' | t"
            >
              ↓
            </button>
            <button type="button" (click)="removeAttachment(att.id)" title="Remove">×</button>
          </div>
        </div>
      </div>
    </div>
    <ng-template #noNotesYet>
      <div class="empty-state compact-empty">
        <strong>{{ 'customerMeeting.noNotesYet' | t }}</strong>
      </div>
    </ng-template>

    <label class="field-control wide next-meeting-notes">
      {{ 'customerMeeting.nextMeetingNotes' | t }}
      <textarea
        name="nextMeetingNotes"
        rows="3"
        [ngModel]="nextMeetingNotes"
        (ngModelChange)="nextMeetingNotesChange.emit($event)"
        [placeholder]="'customerMeeting.nextMeetingNotesPlaceholder' | t"
      ></textarea>
      <small class="muted">{{ 'customerMeeting.nextMeetingNotesHint' | t }}</small>
    </label>

    <app-note-detail-modal
      *ngIf="openedNote"
      [note]="openedNote"
      [meeting]="meeting"
      (close)="openedNote = null"
    />
  `,
  styles: [MEETING_FORM_STYLES, `.next-meeting-notes { margin-top: 14px; }`]
})
export class MeetingNotesSectionComponent implements OnInit {
  @Input() meeting!: CustomerMeeting;

  /** Emitted whenever the meeting was mutated so the parent can reload it. */
  @Output() changed = new EventEmitter<void>();
  /** Emitted when the user wants to turn a note into a task. */
  @Output() createTaskFromNote = new EventEmitter<MeetingNote>();

  /** "Notes for the next meeting" now lives in this (Notes) tab; the parent persists it. */
  @Input() nextMeetingNotes = '';
  @Output() nextMeetingNotesChange = new EventEmitter<string>();

  /** Only Note + Action are offered when creating; legacy types stay editable. */
  readonly captureTypeOptions: NoteType[] = ['note', 'action'];

  newNote: CreateMeetingNoteInput = { type: 'note', content: '' };
  editingNoteId: string | null = null;
  editingNoteDraft: UpdateMeetingNoteInput & { content: string } = {
    type: 'note',
    content: '',
    ownerId: undefined,
    dueDate: undefined
  };
  pendingAttachmentFile: File | null = null;
  openedNote: MeetingNote | null = null;

  @ViewChild('noteComposerInput') noteComposerInput?: ElementRef<HTMLInputElement>;
  @ViewChild('noteAttachInput') noteAttachInput?: ElementRef<HTMLInputElement>;

  constructor(
    public workspace: ActionosWorkspaceService,
    private i18n: ActionosI18nService
  ) {}

  ngOnInit(): void {
    this.newNote = { type: 'note', content: '', ownerId: this.workspace.currentEmployeeId };
  }

  get capturedNotes(): MeetingNote[] {
    if (!this.meeting) {
      return [];
    }
    return [...this.meeting.notes].sort((a, b) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    );
  }

  /** Stable identity for the notes list so background store refreshes don't
   *  destroy/recreate rows (which looked like notes "disappearing and reappearing"). */
  trackNote(_index: number, note: MeetingNote): string {
    return note.id;
  }

  get noteOwnerOptions(): SelectOption[] {
    return [
      { value: undefined, label: '—' },
      ...this.workspace.employees.map((e) => ({ value: e.id, label: e.fullName }))
    ];
  }

  /** Edit dropdown offers Note + Action, plus the note's own legacy type if applicable. */
  editTypeOptions(note: MeetingNote): SelectOption[] {
    const types: NoteType[] = [...this.captureTypeOptions];
    if (!types.includes(note.type)) {
      types.push(note.type);
    }
    return types.map((n) => ({ value: n, label: this.i18n.translate('noteType.' + n) }));
  }

  setNoteType(type: NoteType): void {
    this.newNote.type = type;
    if (type === 'action' && !this.newNote.dueDate) {
      this.newNote.dueDate = new Date().toISOString().slice(0, 10);
    }
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.captureNote(event.ctrlKey || event.metaKey);
    }
  }

  canAddNote(): boolean {
    if (!this.newNote.content.trim()) {
      return false;
    }
    if (this.newNote.type === 'action') {
      return !!this.newNote.ownerId && !!this.newNote.dueDate;
    }
    return true;
  }

  canCreateTaskFromType(type: NoteType): boolean {
    return type === 'action' || type === 'blocker';
  }

  canCreateTaskFromNote(note: MeetingNote): boolean {
    return this.canCreateTaskFromType(note.type);
  }

  captureNote(openTaskAfter = false): void {
    const created = this.addNoteInternal();
    if (!created) {
      return;
    }
    if (openTaskAfter && this.canCreateTaskFromNote(created)) {
      this.requestTaskCreation(created);
    }
  }

  isActionReady(note: MeetingNote): boolean {
    if (note.type !== 'action') {
      return true;
    }
    return !!note.ownerId && !!note.dueDate;
  }

  requestTaskCreation(note: MeetingNote): void {
    if (!this.canCreateTaskFromNote(note)) {
      return;
    }
    if (note.type === 'action' && !this.isActionReady(note)) {
      return;
    }
    this.createTaskFromNote.emit(note);
  }

  startEditingNote(note: MeetingNote): void {
    this.editingNoteId = note.id;
    this.editingNoteDraft = {
      type: note.type,
      content: note.content,
      ownerId: note.ownerId,
      dueDate: note.dueDate
    };
  }

  cancelEditingNote(): void {
    this.editingNoteId = null;
    this.editingNoteDraft = { type: 'note', content: '', ownerId: undefined, dueDate: undefined };
  }

  canSaveEditedNote(): boolean {
    if (!this.editingNoteDraft.content?.trim()) {
      return false;
    }
    if (this.editingNoteDraft.type === 'action') {
      return !!this.editingNoteDraft.ownerId && !!this.editingNoteDraft.dueDate;
    }
    return true;
  }

  saveEditedNote(note: MeetingNote): void {
    if (!this.meeting || !this.canSaveEditedNote()) {
      return;
    }
    const updated = this.workspace.updateCustomerMeetingNote(this.meeting.id, note.id, {
      type: this.editingNoteDraft.type,
      content: this.editingNoteDraft.content.trim(),
      ownerId: this.editingNoteDraft.ownerId,
      dueDate: this.editingNoteDraft.dueDate
    });
    if (!updated) {
      return;
    }
    this.cancelEditingNote();
    this.changed.emit();
  }

  deleteNote(note: MeetingNote): void {
    if (!this.meeting) {
      return;
    }
    const removed = this.workspace.removeCustomerMeetingNote(this.meeting.id, note.id);
    if (!removed) {
      return;
    }
    if (this.editingNoteId === note.id) {
      this.cancelEditingNote();
    }
    this.changed.emit();
  }

  openNoteDetail(note: MeetingNote): void {
    this.openedNote = note;
  }

  linkedTaskForNote(note: MeetingNote): Task | undefined {
    if (!note.convertedTaskId) {
      return undefined;
    }
    return this.workspace.Task(note.convertedTaskId);
  }

  openMeetingTask(task: Task): void {
    this.workspace.selectMeetingTask(task, true);
  }

  // ── Attachments ──────────────────────────────────────────────────────────

  triggerNoteAttachInput(): void {
    this.noteAttachInput?.nativeElement.click();
  }

  onPendingAttachSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.pendingAttachmentFile = input.files?.[0] ?? null;
  }

  triggerNoteRowAttach(noteId: string): void {
    const el = document.getElementById('note-attach-' + noteId) as HTMLInputElement | null;
    el?.click();
  }

  async onNoteRowFileSelected(event: Event, noteId: string): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.meeting) {
      return;
    }
    for (const file of Array.from(input.files)) {
      await this.workspace.uploadNoteAttachment(this.meeting.id, noteId, file);
    }
    input.value = '';
    this.changed.emit();
  }

  removeAttachment(id: string): void {
    this.workspace.removeAttachment(id);
    this.changed.emit();
  }

  private addNoteInternal(): MeetingNote | null {
    if (!this.meeting || !this.canAddNote()) {
      return null;
    }
    const created = this.workspace.addCustomerMeetingNote(this.meeting.id, this.newNote);
    if (!created) {
      return null;
    }
    if (this.pendingAttachmentFile) {
      const meetingId = this.meeting.id;
      const noteId = created.id;
      const file = this.pendingAttachmentFile;
      this.pendingAttachmentFile = null;
      void this.workspace.uploadNoteAttachment(meetingId, noteId, file).then(() => {
        this.changed.emit();
      });
    }
    this.newNote = {
      type: this.newNote.type,
      content: '',
      ownerId: this.newNote.ownerId,
      dueDate: this.newNote.dueDate
    };
    this.focusComposer();
    this.changed.emit();
    return created;
  }

  focusComposer(): void {
    setTimeout(() => this.noteComposerInput?.nativeElement.focus(), 0);
  }
}
