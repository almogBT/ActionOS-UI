import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostBinding, Input, Output, inject } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CustomerMeeting, MeetingNote, NoteType, Task } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { IconComponent, IconName } from '../icons/icon.component';
import { AppDatePipe } from '../pipes/app-date.pipe';
import { StatModalComponent } from '../stat-modal/stat-modal.component';

export type MeetingCardVariant = 'grid' | 'rail' | 'row';

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
 *   variant="row"   single-line horizontal row for the meetings lanes list
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
  private readonly openTaskCountCache: { tasks: Task[] | null; value: number } = { tasks: null, value: 0 };
  private readonly noteCache: {
    actions: MeetingNote[];
    blockers: MeetingNote[];
    decisions: MeetingNote[];
    length: number;
    meeting: CustomerMeeting | null;
    updatedAt: string | undefined;
  } = {
    actions: [],
    blockers: [],
    decisions: [],
    length: -1,
    meeting: null,
    updatedAt: undefined
  };

  @HostBinding('class.mc-grid') get isGrid(): boolean { return this.variant === 'grid'; }
  @HostBinding('class.mc-rail') get isRail(): boolean { return this.variant === 'rail'; }
  @HostBinding('class.mc-row')  get isRow(): boolean { return this.variant === 'row'; }
  @HostBinding('class.card-led') get isLed(): boolean {
    return this.meeting.meetingLeaderEmployeeId === this.workspace.currentEmployeeId;
  }

  // ── Derived display data ────────────────────────────────────────────────────

  get customerName(): string {
    return this.workspace.clientName(this.meeting.customerId) ?? '';
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
    const tasks = this.tasksFromMeeting();
    if (this.openTaskCountCache.tasks !== tasks) {
      this.openTaskCountCache.tasks = tasks;
      this.openTaskCountCache.value = tasks.filter(t => t.status !== 'Done' && t.status !== 'Cancelled').length;
    }
    return this.openTaskCountCache.value;
  }

  /** Follow-up action notes not yet converted to tasks. */
  meetingActionItems(): MeetingNote[] {
    return this.getCachedNotes().actions;
  }

  get unresolvedActionCount(): number {
    return this.meetingActionItems().length;
  }

  notesOfType(type: NoteType): MeetingNote[] {
    const notes = this.getCachedNotes();
    if (type === 'decision') return notes.decisions;
    if (type === 'blocker') return notes.blockers;
    return this.meeting.notes.filter(n => n.type === type);
  }

  get blockerCount(): number {
    return this.getCachedNotes().blockers.length;
  }

  /** True when the card has any outcome signal worth showing a metric for. */
  get hasSignals(): boolean {
    return this.openTaskCount > 0 || this.unresolvedActionCount > 0 || this.blockerCount > 0;
  }

  /**
   * State class driving the colored left spine: closed (done) → blockers (red)
   * → past-but-not-closed (needs attention, amber) → upcoming (accent). Order is a
   * priority — a closed meeting reads as done even if it still has leftover notes.
   */
  get spineClass(): string {
    if (this.meeting.status === 'Closed') {
      return 'state-closed';
    }
    if (this.blockerCount > 0) {
      return 'state-blocked';
    }
    const today = new Date().toISOString().slice(0, 10);
    if (this.meeting.meetingDate.slice(0, 10) < today) {
      return 'state-attention';
    }
    return 'state-upcoming';
  }

  isTaskDone(t: Task): boolean {
    return t.status === 'Done' || t.status === 'Cancelled';
  }

  /**
   * Lifecycle mode that drives the tile's adaptive content:
   *  - 'upcoming' — meeting is in the future: lead with the goal + who's coming, prep CTA.
   *  - 'wrapup'   — it already happened but has no summary yet: nudge to wrap it up.
   *  - 'done'     — closed, or has a summary: lead with the outcome + a recap CTA.
   */
  get mode(): 'upcoming' | 'wrapup' | 'done' {
    if (this.meeting.status === 'Closed') {
      return 'done';
    }
    const today = new Date().toISOString().slice(0, 10);
    const isPast = this.meeting.meetingDate.slice(0, 10) < today;
    if (!isPast) {
      return 'upcoming';
    }
    return this.summaryText ? 'done' : 'wrapup';
  }

  get goalText(): string {
    return this.meeting.goal?.trim() ?? '';
  }

  /** Customer-side attendees, comma-joined and clamped — who you met / will meet. */
  get customerAttendees(): string {
    const names = this.meeting.customerParticipants
      .map(p => p.name?.trim())
      .filter((n): n is string => !!n);
    if (!names.length) {
      return '';
    }
    if (names.length <= 2) {
      return names.join(', ');
    }
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  /** Contextual footer action — Prep / Wrap up / Recap by lifecycle mode. */
  get actionLabelKey(): string {
    if (this.mode === 'upcoming') {
      return 'meetingsOverview.prep';
    }
    if (this.mode === 'wrapup') {
      return 'meetingsOverview.wrapUp';
    }
    return 'meetingsOverview.recap';
  }

  get actionIcon(): IconName {
    if (this.mode === 'upcoming') {
      return 'calendar';
    }
    if (this.mode === 'wrapup') {
      return 'check-circle';
    }
    return 'file-text';
  }

  /** Recap opens the read-only popup; prep/wrap-up open the meeting drawer to edit. */
  onAction(evt: Event): void {
    evt.stopPropagation();
    if (this.mode === 'done') {
      this.recapOpen = true;
    } else {
      this.onOpen();
    }
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

  trackNote(_index: number, note: MeetingNote): string {
    return note.id;
  }

  trackTask(_index: number, task: Task): string {
    return task.id;
  }

  private getCachedNotes(): { actions: MeetingNote[]; blockers: MeetingNote[]; decisions: MeetingNote[] } {
    if (
      this.noteCache.meeting === this.meeting &&
      this.noteCache.updatedAt === this.meeting.updatedAt &&
      this.noteCache.length === this.meeting.notes.length
    ) {
      return this.noteCache;
    }

    this.noteCache.meeting = this.meeting;
    this.noteCache.updatedAt = this.meeting.updatedAt;
    this.noteCache.length = this.meeting.notes.length;
    this.noteCache.actions = this.meeting.notes.filter(n => n.type === 'action' && !n.convertedTaskId);
    this.noteCache.blockers = this.meeting.notes.filter(n => n.type === 'blocker');
    this.noteCache.decisions = this.meeting.notes.filter(n => n.type === 'decision');
    return this.noteCache;
  }
}
