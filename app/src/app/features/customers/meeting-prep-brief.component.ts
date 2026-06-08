import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CustomerMeeting, Task } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

export type MeetingPrepBriefVariant = 'full' | 'compact';

interface PrepDecisionRow {
  id: string;
  content: string;
  meetingId: string;
  meetingSubject: string;
  meetingDate: string;
}

interface PrepBlockerRow {
  id: string;
  content: string;
  meetingId: string;
  meetingSubject: string;
  meetingDate: string;
  taskStatus?: string;
}

interface PrepBrief {
  lastMeeting: CustomerMeeting | null;
  daysSince: number | null;
  nextPlannedDate?: string;
  agendaNotes: string | null;
  agendaFromSubject: string;
  agendaMeetingId: string | null;
  counts: { overdue: number; open: number; waitingOnThem: number; waitingOnUs: number };
  overdueTasks: Task[];
  openActiveTasks: Task[];
  waitingForCustomer: Task[];
  waitingForInternal: Task[];
  completedSinceLastMeeting: Task[];
  decisions: PrepDecisionRow[];
  blockers: PrepBlockerRow[];
  priorMeetings: CustomerMeeting[];
  lastRecap: string | null;
}

/**
 * Shared pre-meeting briefing. Renders the same data in two layouts:
 *  - 'full'    → the standalone "Prepare for meeting" screen (clickable tasks,
 *                full lists, prior-meeting history, collapsible last recap).
 *  - 'compact' → the sidebar shown while planning a meeting (top-N, read-only).
 *
 * Single source of truth so the two prep surfaces can no longer drift apart.
 * All data comes from getCustomerPreparationSummary() + the customer's meetings;
 * there are no new model fields.
 */
@Component({
  selector: 'app-meeting-prep-brief',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <ng-container *ngIf="brief as b">
      <!-- State of the account -->
      <div class="state-header">
        <div class="state-meta">
          <ng-container *ngIf="b.lastMeeting; else firstMeeting">
            <span>{{ 'meetingPrep.lastMet' | t }}: <strong>{{ b.lastMeeting.meetingDate | slice:0:10 }}</strong></span>
            <span class="muted" *ngIf="b.daysSince !== null"> · {{ b.daysSince }} {{ 'meetingPrep.daysAgo' | t }}</span>
          </ng-container>
          <ng-template #firstMeeting>
            <span class="muted">{{ 'meetingPrep.noMeetingsYet' | t }}</span>
          </ng-template>
          <span class="muted" *ngIf="b.nextPlannedDate"> · {{ 'meetingPrep.nextPlanned' | t }}: {{ b.nextPlannedDate | slice:0:10 }}</span>
        </div>
        <div class="state-chips">
          <span class="count-chip danger" *ngIf="b.counts.overdue">{{ b.counts.overdue }} {{ 'meetingPrep.overdueTasks' | t }}</span>
          <span class="count-chip" *ngIf="b.counts.open">{{ b.counts.open }} {{ 'meetingPrep.openTasks' | t }}</span>
          <span class="count-chip warn" *ngIf="b.counts.waitingOnUs">{{ b.counts.waitingOnUs }} {{ 'meetingPrep.waitingForInternal' | t }}</span>
          <span class="count-chip" *ngIf="b.counts.waitingOnThem">{{ b.counts.waitingOnThem }} {{ 'meetingPrep.waitingForCustomer' | t }}</span>
        </div>
      </div>

      <!-- Agenda carried over from the previous meeting's wrap-up notes -->
      <div class="brief-block agenda" *ngIf="b.agendaNotes"
        [class.clickable]="b.agendaMeetingId"
        (click)="b.agendaMeetingId && openMeeting(b.agendaMeetingId)">
        <strong>{{ 'meetingPrep.agendaForThisMeeting' | t }}</strong>
        <small class="muted" *ngIf="b.agendaFromSubject">{{ b.agendaFromSubject }}</small>
        <p class="agenda-body">{{ b.agendaNotes }}</p>
      </div>

      <!-- Overdue -->
      <div class="brief-block danger-block" *ngIf="b.overdueTasks.length">
        <strong class="danger-label">{{ 'meetingPrep.overdueTasks' | t }} ({{ b.overdueTasks.length }})</strong>
        <ul>
          <li *ngFor="let task of limit(b.overdueTasks)" class="clickable" (click)="onTaskClick(task)">
            <span class="row-main">
              <strong>{{ task.title }}</strong>
              <span class="status-chip" [ngClass]="workspace.statusClass(task.status)">{{ ('meetingTask.statusValues.' + task.status) | t }}</span>
            </span>
            <span class="muted">{{ workspace.employeeName(task.assignedToEmployeeId) }}<span *ngIf="task.dueDate"> · {{ 'common.due' | t }} {{ task.dueDate }}</span></span>
            <span class="muted latest-update" *ngIf="latestUpdate(task) as u">↻ {{ u }}</span>
          </li>
        </ul>
      </div>

      <!-- On our plate (waiting for internal) -->
      <div class="brief-block" *ngIf="b.waitingForInternal.length">
        <strong class="warn-label">{{ 'meetingPrep.waitingForInternal' | t }} ({{ b.waitingForInternal.length }})</strong>
        <ul>
          <li *ngFor="let task of limit(b.waitingForInternal)" class="clickable" (click)="onTaskClick(task)">
            <span class="row-main"><strong>{{ task.title }}</strong></span>
            <span class="muted">{{ workspace.employeeName(task.assignedToEmployeeId) }}<span *ngIf="task.waitingReason"> · {{ task.waitingReason }}</span></span>
          </li>
        </ul>
      </div>

      <!-- On the customer's plate (waiting for customer) -->
      <div class="brief-block" *ngIf="b.waitingForCustomer.length">
        <strong>{{ 'meetingPrep.waitingForCustomer' | t }} ({{ b.waitingForCustomer.length }})</strong>
        <ul>
          <li *ngFor="let task of limit(b.waitingForCustomer)" class="clickable" (click)="onTaskClick(task)">
            <span class="row-main"><strong>{{ task.title }}</strong></span>
            <span class="muted">{{ workspace.employeeName(task.assignedToEmployeeId) }}</span>
          </li>
        </ul>
      </div>

      <!-- Open blockers raised in earlier meetings -->
      <div class="brief-block" *ngIf="b.blockers.length">
        <strong class="danger-label">{{ 'meetingPrep.openBlockers' | t }} ({{ b.blockers.length }})</strong>
        <ul>
          <li *ngFor="let blocker of limit(b.blockers)" class="clickable" (click)="openMeeting(blocker.meetingId)">
            <span class="row-main"><strong>{{ blocker.content }}</strong></span>
            <small class="muted">{{ blocker.meetingSubject }} · {{ blocker.meetingDate | slice:0:10 }}</small>
          </li>
        </ul>
      </div>

      <!-- Still open / in progress -->
      <div class="brief-block" *ngIf="b.openActiveTasks.length">
        <strong>{{ 'meetingPrep.openTasks' | t }} ({{ b.openActiveTasks.length }})</strong>
        <ul>
          <li *ngFor="let task of limit(b.openActiveTasks)" class="clickable" (click)="onTaskClick(task)">
            <span class="row-main">
              <strong>{{ task.title }}</strong>
              <span class="status-chip" [ngClass]="workspace.statusClass(task.status)">{{ ('meetingTask.statusValues.' + task.status) | t }}</span>
            </span>
            <span class="muted">{{ workspace.employeeName(task.assignedToEmployeeId) }}<span *ngIf="task.dueDate"> · {{ 'common.due' | t }} {{ task.dueDate }}</span></span>
            <span class="muted latest-update" *ngIf="latestUpdate(task) as u">↻ {{ u }}</span>
          </li>
        </ul>
      </div>

      <!-- Recent decisions -->
      <div class="brief-block">
        <strong>{{ 'customerMeeting.recentDecisions' | t }}</strong>
        <ul *ngIf="b.decisions.length; else noDecisions">
          <li *ngFor="let decision of limit(b.decisions)" class="clickable" (click)="openMeeting(decision.meetingId)">
            <span class="row-main">{{ decision.content }}</span>
            <small class="muted">{{ decision.meetingSubject }} · {{ decision.meetingDate | slice:0:10 }}</small>
          </li>
        </ul>
        <ng-template #noDecisions>
          <small class="muted">{{ 'meetingPrep.nothing' | t }}</small>
        </ng-template>
      </div>

      <!-- Wins since last meeting -->
      <div class="brief-block" *ngIf="b.completedSinceLastMeeting.length">
        <strong class="ok-label">{{ 'meetingPrep.completedSinceLastMeeting' | t }} ({{ b.completedSinceLastMeeting.length }})</strong>
        <ul>
          <li *ngFor="let task of limit(b.completedSinceLastMeeting)" class="clickable" (click)="onTaskClick(task)">
            <span class="row-main"><strong>{{ task.title }}</strong></span>
            <span class="muted">{{ workspace.employeeName(task.assignedToEmployeeId) }}</span>
          </li>
        </ul>
      </div>

      <!-- Prior meetings (full view only) -->
      <div class="brief-block" *ngIf="variant === 'full' && b.priorMeetings.length">
        <strong>{{ 'meetingPrep.priorMeetings' | t }} ({{ b.priorMeetings.length }})</strong>
        <ul>
          <li *ngFor="let m of b.priorMeetings" class="clickable" (click)="openMeeting(m.id)">
            <span class="row-main"><strong>{{ m.subject }}</strong> <span class="muted">{{ m.meetingDate | slice:0:10 }}</span></span>
            <p class="muted summary-text" *ngIf="m.summary">{{ m.summary }}</p>
          </li>
        </ul>
      </div>

      <!-- Last published recap (full view only, collapsible) -->
      <div class="brief-block" *ngIf="variant === 'full' && b.lastRecap">
        <button type="button" class="ghost-action small" (click)="showRecap = !showRecap">
          {{ (showRecap ? 'meetingPrep.hideRecap' : 'meetingPrep.showRecap') | t }}
        </button>
        <pre class="recap-preview" *ngIf="showRecap">{{ b.lastRecap }}</pre>
      </div>
    </ng-container>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .state-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      margin-bottom: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface-strong);
    }
    .state-meta { font-size: 13px; }
    .state-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .count-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--bg-elevated);
      font-size: 12px;
      font-weight: 600;
    }
    .count-chip.danger { border-color: rgba(248,113,113,0.4); color: #f87171; }
    .count-chip.warn { border-color: var(--warning); color: var(--warning); }
    .brief-block { margin-bottom: 1.1rem; display: grid; gap: 6px; }
    .brief-block > strong {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }
    .brief-block .danger-label { color: #f87171; }
    .brief-block .warn-label { color: var(--warning); }
    .brief-block .ok-label { color: var(--olive, #6b8e23); }
    .brief-block ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
    .brief-block li {
      display: grid;
      gap: 3px;
      padding: 8px 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg-canvas);
      font-size: 13px;
      line-height: 1.35;
    }
    .brief-block li.clickable { cursor: pointer; }
    .brief-block li.clickable:hover { background: var(--bg-hover, rgba(255,255,255,0.06)); }
    .brief-block.agenda.clickable { cursor: pointer; }
    .brief-block.agenda.clickable:hover { border-color: var(--accent); }
    .row-main { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .latest-update { font-size: 11px; opacity: 0.75; }
    .agenda {
      padding: 10px 12px;
      border: 1px solid var(--accent-soft);
      border-left: 3px solid var(--accent);
      border-radius: 8px;
      background: var(--accent-soft);
    }
    .agenda .agenda-body { margin: 0; font-size: 13px; line-height: 1.5; white-space: pre-wrap; color: var(--ink); }
    .summary-text { width: 100%; margin: 2px 0 0; font-size: 12px; }
    .recap-preview {
      margin: 6px 0 0;
      padding: 12px;
      background: var(--surface-strong);
      border: 1px solid var(--line);
      border-radius: 10px;
      font-family: ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Consolas, monospace;
      font-size: 12px;
      white-space: pre-wrap;
      line-height: 1.5;
      max-height: 320px;
      overflow-y: auto;
    }
    @media print {
      .brief-block li.clickable { cursor: default; }
    }
  `]
})
export class MeetingPrepBriefComponent {
  @Input({ required: true }) customerId!: string;
  /** When set, this meeting is excluded from "previous meeting" lookups. */
  @Input() currentMeetingId: string | null = null;
  @Input() variant: MeetingPrepBriefVariant = 'full';

  showRecap = false;

  constructor(public workspace: ActionosWorkspaceService) {}

  /** Top-N in compact mode, everything in full mode. */
  limit<T>(items: T[]): T[] {
    return this.variant === 'compact' ? items.slice(0, 3) : items;
  }

  /** Self-contained, like the meeting card: clicking a task opens its drawer. */
  onTaskClick(task: Task): void {
    this.workspace.selectMeetingTask(task, true);
  }

  /** Clicking a meeting — or a note/decision/blocker — opens that meeting. */
  openMeeting(meetingId: string): void {
    this.workspace.openMeetingDrawer(meetingId);
  }

  /** Most recent progression note date for a task, e.g. "2026-05-20". */
  latestUpdate(task: Task): string | null {
    const notes = task.progressionNotes ?? [];
    if (!notes.length) {
      return null;
    }
    const latest = notes
      .map((n) => n.createdAt)
      .filter(Boolean)
      .sort()
      .pop();
    return latest ? latest.slice(0, 10) : null;
  }

  get brief(): PrepBrief {
    const summary = this.workspace.getCustomerPreparationSummary(this.customerId);
    const allTasks = this.workspace.meetingTasksByCustomer(this.customerId);

    // Prior meetings, newest first, excluding the meeting being edited.
    const priorMeetings = this.workspace
      .customerMeetingsByCustomer(this.customerId)
      .filter((m) => m.id !== this.currentMeetingId);

    const lastMeeting = priorMeetings[0] ?? null;

    // Agenda carried over: the most recent prior meeting that left next-meeting notes.
    const carryOver = priorMeetings.find((m) => !!m.nextMeetingNotes?.trim()) ?? null;

    // Overdue first, most overdue at the top.
    const overdueTasks = summary.overdueTasks
      .slice()
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    const overdueIds = new Set(overdueTasks.map((t) => t.id));

    const waitingForCustomer = summary.waitingForCustomer;
    const waitingForInternal = allTasks.filter((t) => t.status === 'Waiting For Internal');

    // "Open" actively-in-progress tasks, excluding the buckets already shown
    // above (overdue / waiting) so nothing is listed twice.
    const openActiveTasks = summary.openTasks.filter(
      (t) =>
        !overdueIds.has(t.id) &&
        t.status !== 'Waiting For Customer' &&
        t.status !== 'Waiting For Internal'
    );

    return {
      lastMeeting,
      daysSince: lastMeeting ? this.daysSince(lastMeeting.meetingDate) : null,
      nextPlannedDate: summary.nextMeetingDate,
      agendaNotes: carryOver?.nextMeetingNotes?.trim() || null,
      agendaFromSubject: carryOver ? `${carryOver.subject} · ${carryOver.meetingDate.slice(0, 10)}` : '',
      agendaMeetingId: carryOver?.id ?? null,
      counts: {
        overdue: overdueTasks.length,
        open: openActiveTasks.length,
        waitingOnThem: waitingForCustomer.length,
        waitingOnUs: waitingForInternal.length
      },
      overdueTasks,
      openActiveTasks,
      waitingForCustomer,
      waitingForInternal,
      completedSinceLastMeeting: summary.completedSinceLastMeeting,
      decisions: this.collectDecisions(priorMeetings),
      blockers: this.collectOpenBlockers(priorMeetings, allTasks),
      priorMeetings,
      lastRecap: lastMeeting?.publishedRecap?.trim() || null
    };
  }

  private collectDecisions(meetings: CustomerMeeting[]): PrepDecisionRow[] {
    const rows: PrepDecisionRow[] = [];
    for (const meeting of meetings) {
      for (const note of meeting.notes) {
        if (note.type !== 'decision') {
          continue;
        }
        rows.push({
          id: note.id,
          content: note.content,
          meetingId: meeting.id,
          meetingSubject: meeting.subject,
          meetingDate: meeting.meetingDate
        });
      }
    }
    return rows;
  }

  /**
   * Blocker notes from earlier meetings that are still relevant: either never
   * converted to a task, or converted to a task that is still open.
   */
  private collectOpenBlockers(meetings: CustomerMeeting[], allTasks: Task[]): PrepBlockerRow[] {
    const taskById = new Map(allTasks.map((t) => [t.id, t]));
    const rows: PrepBlockerRow[] = [];
    for (const meeting of meetings) {
      for (const note of meeting.notes) {
        if (note.type !== 'blocker') {
          continue;
        }
        const linked = note.convertedTaskId ? taskById.get(note.convertedTaskId) : undefined;
        if (linked && !this.workspace.isOpenMeetingTaskStatus(linked.status)) {
          continue; // resolved
        }
        rows.push({
          id: note.id,
          content: note.content,
          meetingId: meeting.id,
          meetingSubject: meeting.subject,
          meetingDate: meeting.meetingDate,
          taskStatus: linked?.status
        });
      }
    }
    return rows;
  }

  private daysSince(dateIso: string): number {
    const then = new Date(dateIso.slice(0, 10));
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = startOfToday.getTime() - then.getTime();
    return Math.max(0, Math.round(diffMs / 86400000));
  }
}
