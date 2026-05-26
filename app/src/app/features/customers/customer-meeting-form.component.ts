import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CreateCustomerMeetingInput,
  CreateMeetingNoteInput,
  Customer,
  CustomerMeeting,
  CustomerParticipant,
  MeetingNote,
  NoteType
} from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { MeetingTaskCreationComponent } from './meeting-task-creation.component';
import { NoteDetailModalComponent } from './note-detail-modal.component';

@Component({
  selector: 'app-customer-meeting-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, MeetingTaskCreationComponent, NoteDetailModalComponent],
  template: `
    <section class="panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">{{ customer ? customer.name : ('customerMeeting.customer' | t) }}</span>
          <h3>{{ (editing ? 'customerMeeting.saveSummary' : 'customerMeeting.createMeeting') | t }}</h3>
        </div>
        <div class="topbar-actions">
          <button type="button" class="ghost-action" (click)="cancelled.emit()">
            {{ 'common.cancel' | t }}
          </button>
          <button
            type="button"
            class="primary-action"
            [disabled]="!canSave()"
            (click)="save()"
          >
            {{ (editing ? 'customerMeeting.saveSummary' : 'customerMeeting.createMeeting') | t }}
          </button>
        </div>
      </div>

      <div class="form-grid">
        <label class="field-control" *ngIf="!customer">
          {{ 'customerMeeting.customer' | t }}
          <select name="formCustomer" [(ngModel)]="pickedCustomerId">
            <option [ngValue]="''">{{ 'customerMeeting.selectCustomer' | t }}</option>
            <option *ngFor="let c of workspace.customers" [value]="c.id">
              {{ c.name }}
            </option>
          </select>
        </label>

        <label class="field-control">
          {{ 'customerMeeting.subject' | t }}
          <input
            type="text"
            name="subject"
            [(ngModel)]="form.subject"
            [placeholder]="'customerMeeting.subjectPlaceholder' | t"
          />
        </label>

        <label class="field-control">
          {{ 'customerMeeting.meetingDate' | t }}
          <input type="datetime-local" name="meetingDate" [(ngModel)]="meetingDateLocal" />
        </label>

        <label class="field-control">
          {{ 'customerMeeting.meetingLeader' | t }}
          <select name="leader" [(ngModel)]="form.meetingLeaderEmployeeId">
            <option [ngValue]="''">{{ 'customerMeeting.selectLeader' | t }}</option>
            <option *ngFor="let e of workspace.employees" [value]="e.id">
              {{ e.fullName }}
            </option>
          </select>
        </label>

        <label class="field-control">
          {{ 'customerMeeting.goal' | t }}
          <input
            type="text"
            name="goal"
            [(ngModel)]="form.goal"
            [placeholder]="'customerMeeting.goalPlaceholder' | t"
          />
        </label>

        <label class="field-control wide">
          {{ 'customerMeeting.summary' | t }}
          <textarea
            name="summary"
            rows="3"
            [(ngModel)]="summaryText"
            [placeholder]="'customerMeeting.summaryPlaceholder' | t"
          ></textarea>
        </label>

        <label class="field-control">
          {{ 'customerMeeting.nextMeetingDate' | t }}
          <input type="datetime-local" name="nextMeetingDate" [(ngModel)]="nextMeetingDateLocal" />
        </label>

        <div class="field-control wide">
          {{ 'customerMeeting.internalParticipants' | t }}
          <div class="participant-chips">
            <label
              *ngFor="let e of workspace.employees"
              class="chip-toggle"
              (click)="$event.stopPropagation()"
            >
              <input
                type="checkbox"
                [checked]="form.internalParticipantEmployeeIds.includes(e.id)"
                (change)="toggleInternal(e.id)"
              />
              {{ e.fullName }}
            </label>
          </div>
        </div>

        <div class="field-control wide">
          {{ 'customerMeeting.customerParticipants' | t }}
          <div class="participant-list">
            <div
              *ngFor="let p of form.customerParticipants; let i = index"
              class="participant-row"
              (click)="$event.stopPropagation()"
            >
              <input type="text" [placeholder]="'customerMeeting.participantName' | t" [(ngModel)]="p.name" [name]="'pname'+i" />
              <input type="email" [placeholder]="'customerMeeting.participantEmail' | t" [(ngModel)]="p.email" [name]="'pemail'+i" />
              <input type="text" [placeholder]="'customerMeeting.participantRole' | t" [(ngModel)]="p.role" [name]="'prole'+i" />
              <button type="button" class="ghost-action" (click)="removeParticipant(i)">×</button>
            </div>
            <button type="button" class="ghost-action" (click)="addParticipant()">
              + {{ 'customerMeeting.addParticipant' | t }}
            </button>
          </div>
        </div>
      </div>

      <p class="muted attachments-notice">{{ 'customerMeeting.attachmentsPlaceholder' | t }}</p>
    </section>

    <!-- Typed notes — only after the meeting is created -->
    <section class="panel" *ngIf="editing && editingMeeting">
      <div class="panel-header">
        <div>
          <span class="eyebrow">{{ 'customerMeeting.notes' | t }}</span>
          <h3>{{ 'meetings.addMeetingOutput' | t }}</h3>
        </div>
      </div>

      <form class="task-capture" (ngSubmit)="addNote()" (click)="$event.stopPropagation()">
        <div class="capture-grid">
          <label class="field-control">
            {{ 'common.type' | t }}
            <select name="noteType" [(ngModel)]="newNote.type">
              <option *ngFor="let n of noteTypes" [value]="n">{{ ('noteType.' + n) | t }}</option>
            </select>
          </label>
          <label class="field-control wide">
            {{ 'common.content' | t }}
            <input
              type="text"
              name="noteContent"
              [(ngModel)]="newNote.content"
              [placeholder]="'customerMeeting.noteContentPlaceholder' | t"
            />
          </label>
          <label class="field-control">
            {{ 'common.owner' | t }}
            <select name="noteOwner" [(ngModel)]="newNote.ownerId">
              <option [ngValue]="undefined">—</option>
              <option *ngFor="let e of workspace.employees" [value]="e.id">{{ e.fullName }}</option>
            </select>
          </label>
          <label class="field-control">
            {{ 'common.dueDate' | t }}
            <input type="date" name="noteDue" [(ngModel)]="newNote.dueDate" />
          </label>
        </div>
        <div class="topbar-actions">
          <button type="submit" class="primary-action" [disabled]="!newNote.content.trim()">
            {{ 'customerMeeting.addNote' | t }}
          </button>
        </div>
      </form>

      <div class="notes-list">
        <div
          *ngFor="let n of editingMeeting.notes"
          class="note-row clickable"
          (click)="openNoteDetail(n)"
        >
          <span class="status-chip" [ngClass]="n.type">
            {{ ('noteType.' + n.type) | t }}
          </span>
          <div class="note-content">
            <p>{{ n.content }}</p>
            <div class="muted">
              <span *ngIf="n.createdByEmployeeId">{{ workspace.employeeName(n.createdByEmployeeId) }}</span>
              <span *ngIf="n.createdAt">· {{ n.createdAt | slice:0:10 }}</span>
              <span *ngIf="n.ownerId">· {{ 'common.owner' | t }}: {{ workspace.employeeName(n.ownerId) }}</span>
              <span *ngIf="n.dueDate">· {{ 'common.due' | t }} {{ n.dueDate }}</span>
              <span *ngIf="n.convertedTaskId" class="status-chip linked-chip">
                ✓ {{ 'customerMeeting.convertedToTask' | t }}
              </span>
            </div>
          </div>
          <div class="note-actions" (click)="$event.stopPropagation()">
            <button
              *ngIf="n.type === 'action' && !n.convertedTaskId"
              type="button"
              class="primary-action"
              (click)="startTaskCreation(n)"
            >
              {{ 'customerMeeting.createTaskFromNote' | t }}
            </button>
          </div>
        </div>
      </div>

      <app-meeting-task-creation
        *ngIf="creatingTaskForNote && editingMeeting && editingMeeting.customerId"
        [meetingId]="editingMeeting.id"
        [customerId]="editingMeeting.customerId"
        [sourceNote]="creatingTaskForNote"
        (created)="onTaskCreated()"
        (cancelled)="creatingTaskForNote = null"
      />
    </section>

    <!-- Wrap-up panel — only after the meeting has substance to recap -->
    <section class="panel" *ngIf="editing && editingMeeting">
      <div class="panel-header">
        <div>
          <span class="eyebrow">{{ 'customerMeeting.wrapUp' | t }}</span>
          <h3>{{ 'customerMeeting.publishRecap' | t }}</h3>
        </div>
        <div class="topbar-actions">
          <button type="button" class="primary-action" (click)="publishRecap()">
            {{ 'customerMeeting.publishRecap' | t }}
          </button>
        </div>
      </div>
      <p class="muted">{{ 'customerMeeting.publishRecapHint' | t }}</p>
      <pre class="recap-preview" *ngIf="lastRecap">{{ lastRecap }}</pre>
    </section>

    <app-note-detail-modal
      *ngIf="openedNote && editingMeeting"
      [note]="openedNote"
      [meeting]="editingMeeting"
      (close)="openedNote = null"
    />
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    .field-control.wide { grid-column: 1 / -1; }
    .participant-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .chip-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.6rem;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 999px;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .participant-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .participant-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      gap: 0.5rem;
    }
    .attachments-notice { margin-top: 1rem; font-size: 0.85rem; }
    .notes-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
    .note-row {
      display: grid;
      grid-template-columns: 110px 1fr auto;
      gap: 0.75rem;
      align-items: start;
      padding: 0.75rem;
      background: rgba(255,255,255,0.03);
      border-radius: 0.5rem;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .note-content p { margin: 0; }
    .note-content .muted { display: flex; gap: 0.5rem; flex-wrap: wrap; font-size: 0.8rem; margin-top: 0.25rem; color: var(--muted); }
    .note-row.clickable { cursor: pointer; transition: background 120ms ease; }
    .note-row.clickable:hover { background: var(--surface-strong); }
    .linked-chip { background: var(--olive-soft); color: var(--olive); }
    .recap-preview {
      margin: 0;
      padding: 14px;
      background: var(--surface-strong);
      border: 1px solid var(--line);
      border-radius: 10px;
      font-family: ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Consolas, monospace;
      font-size: 13px;
      white-space: pre-wrap;
      line-height: 1.5;
      max-height: 360px;
      overflow-y: auto;
    }
    @media (max-width: 720px) {
      .form-grid { grid-template-columns: 1fr; }
      .participant-row { grid-template-columns: 1fr; }
      .note-row { grid-template-columns: 1fr; }
    }
  `]
})
export class CustomerMeetingFormComponent {
  /**
   * Optional. When provided, the customer is fixed (no picker shown — used from
   * Customer 360 → New meeting). When omitted, a picker is shown inside the
   * form (used from the Meetings tab → New meeting).
   */
  @Input() customer: Customer | null = null;
  @Input() existingMeetingId: string | null = null;
  @Output() saved = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  readonly noteTypes: NoteType[] = ['action', 'decision', 'blocker', 'note'];

  form!: CreateCustomerMeetingInput & {
    customerParticipants: CustomerParticipant[];
    internalParticipantEmployeeIds: string[];
  };
  pickedCustomerId = '';
  summaryText = '';
  meetingDateLocal = '';
  nextMeetingDateLocal = '';
  newNote: CreateMeetingNoteInput = { type: 'note', content: '' };

  editing = false;
  editingMeeting: CustomerMeeting | null = null;
  creatingTaskForNote: MeetingNote | null = null;
  openedNote: MeetingNote | null = null;
  lastRecap = '';

  constructor(public workspace: ActionosWorkspaceService) {}

  ngOnInit(): void {
    // Initialize here, not as field initializer — by ngOnInit we are guaranteed
    // both inputs and the workspace DI are set.
    this.form = this.emptyForm();
    const now = new Date();
    now.setMinutes(0, 0, 0);
    this.meetingDateLocal = this.toLocalInput(now);

    if (this.existingMeetingId) {
      this.loadExistingMeeting(this.existingMeetingId);
    }
  }

  canSave(): boolean {
    if (!this.form.subject.trim()) {
      return false;
    }
    // For new meetings without a fixed customer, a customer must be picked
    if (!this.editing && !this.customer && !this.pickedCustomerId) {
      return false;
    }
    return true;
  }

  private loadExistingMeeting(meetingId: string): void {
    const meeting = this.workspace.customerMeeting(meetingId);
    if (!meeting) {
      return;
    }
    this.editing = true;
    this.editingMeeting = meeting;
    this.customer = this.workspace.customer(meeting.customerId) ?? this.customer;
    this.form = {
      customerId: meeting.customerId,
      subject: meeting.subject,
      meetingDate: meeting.meetingDate,
      meetingLeaderEmployeeId: meeting.meetingLeaderEmployeeId,
      internalParticipantEmployeeIds: [...meeting.internalParticipantEmployeeIds],
      customerParticipants: meeting.customerParticipants.map((p) => ({ ...p })),
      goal: meeting.goal ?? ''
    };
    this.summaryText = meeting.summary ?? '';
    this.meetingDateLocal = this.toLocalInput(new Date(meeting.meetingDate));
    this.nextMeetingDateLocal = meeting.nextMeetingDate
      ? this.toLocalInput(new Date(meeting.nextMeetingDate))
      : '';
  }

  save(): void {
    if (!this.canSave()) {
      return;
    }

    if (this.editing && this.editingMeeting) {
      const updated = this.workspace.updateCustomerMeetingSummary(this.editingMeeting.id, {
        subject: this.form.subject,
        meetingDate: this.fromLocalInput(this.meetingDateLocal),
        meetingLeaderEmployeeId: this.form.meetingLeaderEmployeeId,
        internalParticipantEmployeeIds: this.form.internalParticipantEmployeeIds,
        customerParticipants: this.form.customerParticipants.filter((p) => p.name.trim()),
        goal: this.form.goal,
        summary: this.summaryText,
        nextMeetingDate: this.fromLocalInput(this.nextMeetingDateLocal) || undefined
      });
      if (updated) {
        this.editingMeeting = updated;
        this.saved.emit(updated.id);
      }
      return;
    }

    // New meeting — use the fixed customer if provided, otherwise the picked one
    const customerId = this.customer?.id ?? this.pickedCustomerId;
    if (!customerId) {
      return;
    }
    const created = this.workspace.addCustomerMeeting({
      customerId,
      subject: this.form.subject,
      meetingDate: this.fromLocalInput(this.meetingDateLocal),
      meetingLeaderEmployeeId: this.form.meetingLeaderEmployeeId || this.workspace.currentEmployeeId,
      internalParticipantEmployeeIds: this.form.internalParticipantEmployeeIds,
      customerParticipants: this.form.customerParticipants.filter((p) => p.name.trim()),
      goal: this.form.goal
    });
    if (this.summaryText.trim() || this.nextMeetingDateLocal) {
      this.workspace.updateCustomerMeetingSummary(created.id, {
        summary: this.summaryText,
        nextMeetingDate: this.fromLocalInput(this.nextMeetingDateLocal) || undefined
      });
    }
    this.editing = true;
    this.editingMeeting = this.workspace.customerMeeting(created.id) ?? created;
    if (!this.customer) {
      this.customer = this.workspace.customer(customerId) ?? null;
    }
  }

  addNote(): void {
    if (!this.editingMeeting || !this.newNote.content.trim()) {
      return;
    }
    this.workspace.addCustomerMeetingNote(this.editingMeeting.id, this.newNote);
    this.editingMeeting = this.workspace.customerMeeting(this.editingMeeting.id) ?? this.editingMeeting;
    this.newNote = { type: 'note', content: '' };
  }

  toggleInternal(id: string): void {
    const list = this.form.internalParticipantEmployeeIds;
    const index = list.indexOf(id);
    if (index === -1) {
      list.push(id);
    } else {
      list.splice(index, 1);
    }
  }

  addParticipant(): void {
    this.form.customerParticipants.push({ name: '', email: '', role: '' });
  }

  removeParticipant(index: number): void {
    this.form.customerParticipants.splice(index, 1);
  }

  startTaskCreation(note: MeetingNote): void {
    this.creatingTaskForNote = note;
  }

  openNoteDetail(note: MeetingNote): void {
    this.openedNote = note;
  }

  publishRecap(): void {
    if (!this.editingMeeting) {
      return;
    }
    const recap = this.workspace.publishMeetingRecap(this.editingMeeting.id);
    if (recap !== null) {
      this.lastRecap = recap;
      // Reload the meeting so summary + status reflect the recap
      this.editingMeeting =
        this.workspace.customerMeeting(this.editingMeeting.id) ?? this.editingMeeting;
      this.summaryText = this.editingMeeting.summary ?? this.summaryText;
    }
  }

  onTaskCreated(): void {
    this.creatingTaskForNote = null;
    if (this.editingMeeting) {
      this.editingMeeting = this.workspace.customerMeeting(this.editingMeeting.id) ?? this.editingMeeting;
    }
  }

  private emptyForm() {
    return {
      customerId: this.customer?.id ?? '',
      subject: '',
      meetingDate: new Date().toISOString(),
      meetingLeaderEmployeeId: this.workspace?.currentEmployeeId ?? '',
      internalParticipantEmployeeIds: [] as string[],
      customerParticipants: [] as CustomerParticipant[],
      goal: ''
    };
  }

  private toLocalInput(date: Date): string {
    // Format as YYYY-MM-DDTHH:mm for the datetime-local input
    const pad = (n: number): string => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private fromLocalInput(value: string): string {
    if (!value) {
      return '';
    }
    return new Date(value).toISOString();
  }
}
