import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
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
      <!-- The Note/Action type chips are intentionally hidden: every captured entry
           is now a plain note. The action-only fields/buttons below remain in the
           template but are gated on type === 'action', so they never render. -->
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
        <button type="button" class="ghost-action small" *ngIf="!draftMode" (click)="triggerNoteAttachInput()">
          📎 {{ pendingAttachmentFile ? pendingAttachmentFile.name : ('customerMeeting.attachFile' | t) }}
        </button>
        <input #noteAttachInput type="file" style="display:none" (change)="onPendingAttachSelected($event)" />
      </div>

      <p class="muted action-hint" *ngIf="newNote.type === 'action' && (!newNote.ownerId || !newNote.dueDate)">
        {{ 'customerMeeting.actionNeedsOwnerDue' | t }}
      </p>
    </form>

    <div class="notes-list-wrap" id="notes-list" *ngIf="capturedNotes.length; else noNotesYet">
      <button type="button" class="notes-list-toggle" (click)="notesCollapsed = !notesCollapsed">
        <span class="notes-toggle-caret" [class.collapsed]="notesCollapsed">▾</span>
        <span>{{ 'customerMeeting.reviewNotesCaptured' | t }} ({{ capturedNotes.length }})</span>
      </button>
      <div class="notes-list" *ngIf="!notesCollapsed">
        <div *ngFor="let n of capturedNotes; trackBy: trackNote" class="note-row">
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
          <!-- While editing a note we keep Save/Cancel inline (they're the active
               controls for the open edit form). Otherwise every row action lives in
               a single overflow (⋮) dropdown so the row stays compact. -->
          <ng-container *ngIf="editingNoteId === n.id">
            <button
              type="button"
              class="note-icon-btn primary"
              [disabled]="!canSaveEditedNote()"
              (click)="saveEditedNote(n)"
              [title]="'common.save' | t"
              [attr.aria-label]="'common.save' | t"
            >
              <span aria-hidden="true">✓</span>
            </button>
            <button
              type="button"
              class="note-icon-btn"
              (click)="cancelEditingNote()"
              [title]="'common.cancel' | t"
              [attr.aria-label]="'common.cancel' | t"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </ng-container>

          <div class="note-menu" *ngIf="editingNoteId !== n.id">
            <button
              type="button"
              class="note-icon-btn note-menu-trigger"
              [class.active]="openMenuNoteId === n.id"
              (click)="toggleNoteMenu(n.id, $event)"
              [title]="'common.actions' | t"
              [attr.aria-label]="'common.actions' | t"
              [attr.aria-haspopup]="true"
              [attr.aria-expanded]="openMenuNoteId === n.id"
            >
              <span aria-hidden="true">⋮</span>
            </button>
            <div
              class="note-menu-list"
              *ngIf="openMenuNoteId === n.id"
              role="menu"
              [style.left.px]="noteMenuLeft"
              [style.top]="noteMenuUpward ? 'auto' : noteMenuTop + 'px'"
              [style.bottom]="noteMenuUpward ? noteMenuBottom + 'px' : 'auto'"
              (click)="$event.stopPropagation()"
            >
              <button type="button" class="note-menu-item" role="menuitem" (click)="startEditingNote(n); closeNoteMenu()">
                <span class="note-menu-icon" aria-hidden="true">✎</span>
                {{ 'common.edit' | t }}
              </button>
              <button type="button" class="note-menu-item" role="menuitem" (click)="openNoteDetail(n); closeNoteMenu()">
                <span class="note-menu-icon" aria-hidden="true">ⓘ</span>
                {{ 'customerMeeting.noteDetails' | t }}
              </button>
              <button
                *ngIf="!draftMode"
                type="button"
                class="note-menu-item"
                role="menuitem"
                (click)="triggerNoteRowAttach(n.id); closeNoteMenu()"
              >
                <span class="note-menu-icon" aria-hidden="true">📎</span>
                {{ 'customerMeeting.attachFile' | t }}
              </button>
              <button
                *ngIf="canCreateTaskFromNote(n) && !n.convertedTaskId"
                type="button"
                class="note-menu-item"
                role="menuitem"
                [disabled]="n.type === 'action' && !isActionReady(n)"
                (click)="requestTaskCreation(n); closeNoteMenu()"
              >
                <span class="note-menu-icon" aria-hidden="true">✚</span>
                {{ 'customerMeeting.createTaskFromNote' | t }}
              </button>
              <button
                *ngIf="linkedTaskForNote(n) as linked"
                type="button"
                class="note-menu-item"
                role="menuitem"
                (click)="openMeetingTask(linked); closeNoteMenu()"
              >
                <span class="note-menu-icon" aria-hidden="true">↗</span>
                {{ 'customerMeeting.openTask' | t }}
              </button>
              <button type="button" class="note-menu-item danger" role="menuitem" (click)="deleteNote(n); closeNoteMenu()">
                <span class="note-menu-icon" aria-hidden="true">🗑</span>
                {{ 'common.delete' | t }}
              </button>
            </div>
          </div>
          <input
            [id]="'note-attach-' + n.id"
            type="file"
            style="display:none"
            (change)="onNoteRowFileSelected($event, n.id)"
          />
        </div>
        <div class="note-attachments" *ngIf="!draftMode && workspace.noteAttachments(n.id).length">
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
    </div>
    <ng-template #noNotesYet>
      <div class="empty-state compact-empty">
        <strong>{{ 'customerMeeting.noNotesYet' | t }}</strong>
      </div>
    </ng-template>

    <!-- "Notes for the next meeting" — hidden for now (not removed). Flip
         showNextMeetingNotes back to true to restore it; all bindings are intact. -->
    <label class="field-control wide next-meeting-notes" *ngIf="showNextMeetingNotes">
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
  styles: [MEETING_FORM_STYLES, `
    /* Icon-only note-row actions: compact, modern round buttons that reveal their
       label as a native tooltip on hover (title) and to assistive tech (aria-label).
       Scoped to this component so the global .ghost-action/.primary-action buttons
       elsewhere in the form are unaffected. */
    .note-actions { gap: 4px; }
    .note-icon-btn {
      display: inline-grid;
      place-items: center;
      width: 30px;
      height: 30px;
      padding: 0;
      border-radius: 8px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--muted);
      font-size: 15px;
      line-height: 1;
      cursor: pointer;
      transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
    }
    .note-icon-btn:hover:not(:disabled) {
      background: var(--bg-hover, rgba(255, 255, 255, 0.06));
      color: var(--ink);
      border-color: var(--line);
    }
    .note-icon-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .note-icon-btn.primary { color: var(--accent-strong); }
    .note-icon-btn.primary:hover:not(:disabled) {
      background: var(--accent-soft);
      border-color: var(--accent);
    }
    .note-icon-btn.danger { color: var(--danger); }
    .note-icon-btn.danger:hover:not(:disabled) {
      background: rgba(192, 57, 43, 0.12);
      border-color: rgba(192, 57, 43, 0.32);
    }
    .note-icon-btn.active {
      background: var(--bg-hover, rgba(255, 255, 255, 0.06));
      color: var(--ink);
      border-color: var(--line);
    }

    /* Overflow (⋮) dropdown holding all row actions. The menu is position:fixed with
       coordinates computed from the trigger (see positionNoteMenu) so it floats above
       any ancestor with overflow:auto/hidden instead of being clipped by the scrollable
       notes list. Dismissed by the document click handler or by selecting an item. */
    .note-menu { position: relative; }
    .note-menu-list {
      position: fixed;
      z-index: 1200;
      min-width: 180px;
      display: grid;
      gap: 2px;
      padding: 6px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--bg-elevated);
      box-shadow: var(--shadow, 0 8px 24px rgba(0, 0, 0, 0.18));
    }
    .note-menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 7px 10px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: var(--ink);
      font-size: 13px;
      font-weight: 500;
      text-align: start;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
    }
    .note-menu-item:hover:not(:disabled) { background: var(--bg-hover, rgba(255, 255, 255, 0.06)); }
    .note-menu-item:disabled { opacity: 0.4; cursor: not-allowed; }
    .note-menu-item.danger { color: var(--danger); }
    .note-menu-item.danger:hover:not(:disabled) { background: rgba(192, 57, 43, 0.12); }
    .note-menu-icon {
      flex: 0 0 auto;
      display: inline-grid;
      place-items: center;
      width: 18px;
      font-size: 14px;
      line-height: 1;
    }
    .next-meeting-notes { margin-top: 14px; }
    /* Collapsible + scrollable captured-notes list: a long meeting no longer makes the
       whole form unreadable. The header button folds the list; when open it scrolls
       within a capped height. */
    .notes-list-wrap { margin-top: 12px; }
    .notes-list-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      background: transparent;
      border: 0;
      padding: 6px 0;
      color: var(--ink);
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }
    .notes-toggle-caret {
      font-size: 11px;
      color: var(--muted);
      transition: transform 150ms ease;
    }
    .notes-toggle-caret.collapsed { transform: rotate(-90deg); }
    /* Two-class selector overrides the base .notes-list margin from MEETING_FORM_STYLES. */
    .notes-list-wrap .notes-list {
      margin-top: 8px;
      max-height: 360px;
      overflow-y: auto;
      overflow-x: hidden;
      padding-inline-end: 4px;
    }
  `]
})
export class MeetingNotesSectionComponent implements OnInit, OnDestroy {
  @Input() meeting!: CustomerMeeting;
  @Input() draftMode = false;

  /** Emitted whenever the meeting was mutated so the parent can reload it. */
  @Output() changed = new EventEmitter<void>();
  /** Emitted when the user wants to turn a note into a task. */
  @Output() createTaskFromNote = new EventEmitter<MeetingNote>();

  /** "Notes for the next meeting" now lives in this (Notes) tab; the parent persists it. */
  @Input() nextMeetingNotes = '';
  @Output() nextMeetingNotesChange = new EventEmitter<string>();

  /** Hides the "notes for the next meeting" field without removing it. The input/
   *  output and persistence stay wired — set this back to true to show it again. */
  showNextMeetingNotes = false;

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
  /** Folds the captured-notes list to its header so a long meeting stays readable. */
  notesCollapsed = false;
  openedNote: MeetingNote | null = null;
  /** Id of the note whose overflow (⋮) action menu is currently open, or null. */
  openMenuNoteId: string | null = null;
  /** Fixed-position coordinates for the open menu, computed from the trigger rect. */
  noteMenuTop = 0;
  noteMenuBottom = 0;
  noteMenuLeft = 0;
  noteMenuUpward = false;
  private noteMenuTriggerEl: HTMLElement | null = null;
  private draftNoteNumber = 1;
  /** Keeps the open menu glued to its trigger as the page/notes list scrolls. */
  private readonly noteMenuReposition = (): void => {
    if (this.openMenuNoteId && this.noteMenuTriggerEl) {
      this.positionNoteMenu(this.noteMenuTriggerEl);
    }
  };

  @ViewChild('noteComposerInput') noteComposerInput?: ElementRef<HTMLInputElement>;
  @ViewChild('noteAttachInput') noteAttachInput?: ElementRef<HTMLInputElement>;

  constructor(
    public workspace: ActionosWorkspaceService,
    private i18n: ActionosI18nService
  ) {}

  ngOnInit(): void {
    this.newNote = { type: 'note', content: '', ownerId: this.workspace.currentEmployeeId };
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.noteMenuReposition, true);
    window.removeEventListener('resize', this.noteMenuReposition);
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
    if (this.draftMode) {
      const index = this.meeting.notes.findIndex((item) => item.id === note.id);
      if (index === -1) {
        return;
      }
      this.meeting.notes[index] = {
        ...this.meeting.notes[index],
        type: this.editingNoteDraft.type ?? this.meeting.notes[index].type,
        content: this.editingNoteDraft.content.trim(),
        ownerId: this.editingNoteDraft.ownerId,
        dueDate: this.editingNoteDraft.dueDate
      };
      this.cancelEditingNote();
      this.changed.emit();
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
    if (this.draftMode) {
      this.meeting.notes = this.meeting.notes.filter((item) => item.id !== note.id);
      if (this.editingNoteId === note.id) {
        this.cancelEditingNote();
      }
      this.changed.emit();
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

  /** Toggles the overflow action menu for a note row. stopPropagation keeps this
   *  click from immediately reaching the document handler that closes the menu.
   *  On open we capture the trigger and compute the fixed-position coordinates so
   *  the menu floats above the scrollable notes list instead of being clipped. */
  toggleNoteMenu(noteId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openMenuNoteId === noteId) {
      this.closeNoteMenu();
      return;
    }
    this.openMenuNoteId = noteId;
    this.noteMenuTriggerEl = event.currentTarget as HTMLElement;
    this.positionNoteMenu(this.noteMenuTriggerEl);
    window.addEventListener('scroll', this.noteMenuReposition, true);
    window.addEventListener('resize', this.noteMenuReposition);
  }

  closeNoteMenu(): void {
    this.openMenuNoteId = null;
    this.noteMenuTriggerEl = null;
    window.removeEventListener('scroll', this.noteMenuReposition, true);
    window.removeEventListener('resize', this.noteMenuReposition);
  }

  /** Place the fixed-position menu under (or above) the trigger, escaping any
   *  ancestor that clips with overflow. Re-runs on scroll/resize while open.
   *  Mirrors the searchable-select dropdown's positioning approach. */
  private positionNoteMenu(trigger: HTMLElement): void {
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const desired = 240;
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    // Open upward only when there isn't room below and there's more room above.
    this.noteMenuUpward = spaceBelow < Math.min(desired, 180) && spaceAbove > spaceBelow;
    // Align the menu's end (right) edge to the trigger, then clamp so it never
    // spills off either viewport edge (the trigger sits near the left in RTL).
    const menuW = 220;
    const left = Math.min(
      Math.max(margin, rect.right - menuW),
      window.innerWidth - menuW - margin
    );
    this.noteMenuLeft = left;
    if (this.noteMenuUpward) {
      this.noteMenuBottom = window.innerHeight - rect.top + gap;
    } else {
      this.noteMenuTop = rect.bottom + gap;
    }
  }

  /** Any click outside an open menu trigger closes it (trigger clicks call
   *  stopPropagation, and the menu panel stops propagation on its own clicks). */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeNoteMenu();
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
    if (this.draftMode) {
      input.value = '';
      return;
    }
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
    if (this.draftMode) {
      const created: MeetingNote = {
        id: `draft-note-${this.draftNoteNumber++}`,
        type: this.newNote.type,
        content: this.newNote.content.trim(),
        ownerId: this.newNote.ownerId || undefined,
        dueDate: this.newNote.dueDate || undefined,
        createdByEmployeeId: this.workspace.currentEmployeeId,
        createdAt: new Date().toISOString()
      };
      this.meeting.notes = [created, ...this.meeting.notes];
      this.notesCollapsed = false;
      this.pendingAttachmentFile = null;
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
    const created = this.workspace.addCustomerMeetingNote(this.meeting.id, this.newNote);
    if (!created) {
      return null;
    }
    // Re-open the list if it was folded so the user sees the note they just added.
    this.notesCollapsed = false;
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
