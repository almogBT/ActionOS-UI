import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostBinding, Input, Output, inject } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CustomerMeeting, MeetingNote, NoteType, Task } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { IconComponent } from '../icons/icon.component';
import { AppDatePipe } from '../pipes/app-date.pipe';
import { StatModalComponent } from '../stat-modal/stat-modal.component';

export type MeetingCardVariant = 'grid' | 'rail';

/**
 * The ONE way ActionOS renders a meeting — the meeting equivalent of the shared
 * `app-task-table`. Drop `<app-meeting-card [meeting]="m">` anywhere a meeting
 * should appear and it renders the standard tile: customer + subject, status,
 * a two-line summary, the outcome metrics (open tasks · unresolved follow-ups ·
 * blockers) and a Recap button that opens a read-only recap popup.
 *
 * Self-contained like the task table: clicking the card opens the meeting
 * drawer, the recap popup and inline follow-up conversion are handled here.
 * The `(opened)` output fires after the drawer opens so hosts that live inside
 * a popup can close themselves.
 *
 *   variant="grid"  full tile, fixed height (lanes, lists, popups)
 *   variant="rail"  compact tile for the horizontal attention carousel
 */
@Component({
  selector: 'app-meeting-card',
  standalone: true,
  imports: [CommonModule, TranslatePipe, AppDatePipe, IconComponent, StatModalComponent],
  templateUrl: './meeting-card.component.html',
  styleUrl: './meeting-card.component.scss'
})
export class MeetingCardComponent {
  @Input({ required: true }) meeting!: CustomerMeeting;
  @Input() variant: MeetingCardVariant = 'grid';
  /** Emitted after the meeting drawer is opened (lets popup hosts close). */
  @Output() opened = new EventEmitter<CustomerMeeting>();

  readonly workspace = inject(ActionosWorkspaceService);

  /** Recap popup open state (self-contained — one card open at a time). */
  recapOpen = false;

  @HostBinding('class.mc-grid') get isGrid(): boolean { return this.variant === 'grid'; }
  @HostBinding('class.mc-rail') get isRail(): boolean { return this.variant === 'rail'; }
  @HostBinding('class.card-led') get isLed(): boolean {
    return this.meeting.meetingLeaderEmployeeId === this.workspace.currentEmployeeId;
  }

  // ── Derived display data ────────────────────────────────────────────────────

  get customerName(): string {
    return this.workspace.customer(this.meeting.customerId)?.name ?? '';
  }

  get leaderName(): string {
    return this.workspace.employeeName(this.meeting.meetingLeaderEmployeeId);
  }

  get leaderInitials(): string {
    return (this.leaderName || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('') || '?';
  }

  /** Extra attendees beyond the leader (internal teammates + customer side). */
  get participantCount(): number {
    return this.meeting.internalParticipantEmployeeIds.length + this.meeting.customerParticipants.length;
  }

  get summaryText(): string {
    return (this.meeting.summary?.trim() || this.meeting.goal?.trim() || '');
  }

  tasksFromMeeting(): Task[] {
    return this.workspace.meetingTasksByMeeting(this.meeting.id);
  }

  /** Tasks born from this meeting that are still open (not Done/Cancelled). */
  get openTaskCount(): number {
    return this.tasksFromMeeting().filter(t => t.status !== 'Done' && t.status !== 'Cancelled').length;
  }

  /** Follow-up action notes not yet converted to tasks. */
  meetingActionItems(): MeetingNote[] {
    return this.meeting.notes.filter(n => n.type === 'action' && !n.convertedTaskId);
  }

  get unresolvedActionCount(): number {
    return this.meetingActionItems().length;
  }

  notesOfType(type: NoteType): MeetingNote[] {
    return this.meeting.notes.filter(n => n.type === type);
  }

  get blockerCount(): number {
    return this.notesOfType('blocker').length;
  }

  isTaskDone(t: Task): boolean {
    return t.status === 'Done' || t.status === 'Cancelled';
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  onOpen(): void {
    this.workspace.openMeetingDrawer(this.meeting.id);
    this.opened.emit(this.meeting);
  }

  openRecap(evt: Event): void {
    evt.stopPropagation();
    this.recapOpen = true;
  }

  closeRecap(): void {
    this.recapOpen = false;
  }

  convertAction(noteId: string, evt: Event): void {
    evt.stopPropagation();
    this.workspace.convertMeetingAction(this.meeting.id, noteId);
  }
}
