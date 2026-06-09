import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CustomerMeeting, MeetingNote, Task } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { DrawerShellComponent } from '../shared/drawer-shell/drawer-shell.component';
import { MeetingPrepBriefComponent } from '../customers/meeting-prep-brief.component';

type CatchUpTab = 'catchup' | 'prep';
type TaskBucket = 'overdue' | 'open' | 'waiting' | 'done';

interface CatchUpMeetingGroup {
  meeting: CustomerMeeting;
  recap: string | null;
  decisions: MeetingNote[];
  blockers: MeetingNote[];
  tasks: Task[];
  doneCount: number;
  totalCount: number;
  donePct: number;
}

const BUCKET_ORDER: Record<TaskBucket, number> = { overdue: 0, open: 1, waiting: 2, done: 3 };

/**
 * Unified catch-up brief, opened as a bottom drawer (same interaction as the meeting
 * and task drawers via the shared <app-drawer-shell>).
 *
 * Two tabs:
 *  - "Catch up" → a meeting-by-meeting timeline: every meeting's recap plus the tasks
 *    that came out of that meeting, grouped under it. Tasks not tied to any meeting are
 *    collected in a final "not tied to a meeting" group.
 *  - "Prep"     → the existing forward-looking pre-meeting checklist (MeetingPrepBrief).
 *
 * All data is derived from existing model fields; nothing new was added to the models.
 */
@Component({
  selector: 'app-catch-up-drawer',
  standalone: true,
  imports: [CommonModule, TranslatePipe, DrawerShellComponent, MeetingPrepBriefComponent],
  template: `
    <app-drawer-shell
      [open]="workspace.catchUpDrawerOpen"
      [ariaLabel]="'catchUp.title' | t"
      maxWidth="980px"
      (closed)="close()"
    >
      <ng-container *ngIf="customerId as cid">
        <!-- Header -->
        <header class="cu-header">
          <div class="cu-title">
            <span class="eyebrow">{{ 'catchUp.title' | t }}</span>
            <h2>{{ customerName }}</h2>
            <div class="cu-when">
              <span *ngIf="lastMetDays !== null; else firstMeet">
                {{ 'catchUp.lastMet' | t }}
                <strong>{{ lastMetLabel }}</strong>
              </span>
              <ng-template #firstMeet>
                <span class="muted">{{ 'catchUp.noMeetings' | t }}</span>
              </ng-template>
              <span class="muted" *ngIf="nextMeetingDate"> · {{ 'catchUp.nextMeeting' | t }} {{ nextMeetingDate | slice:0:10 }}</span>
            </div>
          </div>
          <button type="button" class="cu-close" (click)="close()" [attr.aria-label]="'common.close' | t">✕</button>
        </header>

        <!-- Count chips -->
        <div class="cu-chips">
          <span class="cu-chip danger" *ngIf="counts.overdue">{{ counts.overdue }} {{ 'catchUp.overdue' | t }}</span>
          <span class="cu-chip" *ngIf="counts.open">{{ counts.open }} {{ 'catchUp.open' | t }}</span>
          <span class="cu-chip warn" *ngIf="counts.waiting">{{ counts.waiting }} {{ 'catchUp.waiting' | t }}</span>
          <span class="cu-chip ok" *ngIf="counts.done">{{ counts.done }} {{ 'catchUp.done' | t }}</span>
        </div>

        <!-- Tabs -->
        <div class="cu-tabs">
          <button type="button" [class.active]="tab === 'catchup'" (click)="tab = 'catchup'">
            {{ 'catchUp.tabCatchUp' | t }}
          </button>
          <button type="button" [class.active]="tab === 'prep'" (click)="tab = 'prep'">
            {{ 'catchUp.tabPrep' | t }}
          </button>
        </div>

        <!-- CATCH-UP TIMELINE -->
        <div *ngIf="tab === 'catchup'" class="cu-body">
          <div class="cu-filter" *ngIf="groups.length">
            <button type="button" [class.active]="!openOnly" (click)="openOnly = false">{{ 'catchUp.filterAll' | t }}</button>
            <button type="button" [class.active]="openOnly" (click)="openOnly = true">{{ 'catchUp.filterOpen' | t }}</button>
          </div>

          <div *ngIf="!groups.length" class="cu-empty">
            <div class="cu-empty-emoji">📭</div>
            <p>{{ 'catchUp.noMeetings' | t }}</p>
          </div>

          <ol class="cu-timeline">
            <li *ngFor="let g of visibleGroups" class="cu-node">
              <span class="cu-dot" [ngClass]="workspace.statusClass(g.meeting.status)"></span>
              <div class="cu-meeting">
                <header class="cu-meeting-head">
                  <div>
                    <strong class="cu-subject">{{ g.meeting.subject }}</strong>
                    <span class="cu-date">{{ g.meeting.meetingDate | slice:0:10 }}</span>
                  </div>
                  <span class="status-chip" [ngClass]="workspace.statusClass(g.meeting.status)">
                    {{ ('customerMeeting.statusValues.' + g.meeting.status) | t }}
                  </span>
                </header>
                <small class="muted cu-leader">{{ 'catchUp.ledBy' | t }} {{ workspace.employeeName(g.meeting.meetingLeaderEmployeeId) }}</small>

                <!-- Recap -->
                <div class="cu-recap" *ngIf="g.recap">
                  <span class="cu-recap-label">{{ 'catchUp.recap' | t }}</span>
                  <p class="cu-recap-text" [class.clamped]="!isExpanded(g.meeting.id)">{{ g.recap }}</p>
                  <button type="button" class="cu-link" *ngIf="isLong(g.recap)" (click)="toggleRecap(g.meeting.id)">
                    {{ (isExpanded(g.meeting.id) ? 'catchUp.readLess' : 'catchUp.readMore') | t }}
                  </button>
                </div>

                <!-- Decisions / blockers -->
                <div class="cu-notes" *ngIf="g.decisions.length || g.blockers.length">
                  <div class="cu-note-row decision" *ngFor="let d of g.decisions">
                    <span class="cu-note-tag">◆ {{ 'catchUp.decision' | t }}</span><span>{{ d.content }}</span>
                  </div>
                  <div class="cu-note-row blocker" *ngFor="let b of g.blockers">
                    <span class="cu-note-tag">⚠ {{ 'catchUp.blocker' | t }}</span><span>{{ b.content }}</span>
                  </div>
                </div>

                <!-- Tasks for this meeting -->
                <div class="cu-tasks" *ngIf="g.tasks.length; else noTasks">
                  <div class="cu-progress-head">
                    <span class="cu-tasks-label">{{ 'catchUp.tasks' | t }}</span>
                    <span class="muted">{{ g.doneCount }} / {{ g.totalCount }} {{ 'catchUp.done' | t }}</span>
                  </div>
                  <div class="cu-progress"><span class="cu-progress-fill" [style.width.%]="g.donePct"></span></div>
                  <ul>
                    <li *ngFor="let task of g.tasks" class="cu-task" (click)="openTask(task)">
                      <span class="cu-task-pill" [ngClass]="bucketOf(task)">{{ bucketIcon(task) }}</span>
                      <span class="cu-task-main">
                        <strong>{{ task.title }}</strong>
                        <small class="muted">
                          {{ workspace.employeeName(task.assignedToEmployeeId) }}
                          <span *ngIf="task.dueDate"> · {{ 'common.due' | t }} {{ task.dueDate }}</span>
                        </small>
                      </span>
                      <span class="status-chip" [ngClass]="workspace.statusClass(task.status)">
                        {{ ('meetingTask.statusValues.' + task.status) | t }}
                      </span>
                    </li>
                  </ul>
                </div>
                <ng-template #noTasks>
                  <small class="muted cu-no-tasks">{{ 'catchUp.noTasks' | t }}</small>
                </ng-template>
              </div>
            </li>
          </ol>

          <!-- Tasks not tied to any meeting -->
          <div class="cu-orphans" *ngIf="visibleOrphanTasks.length">
            <div class="cu-orphans-head">◦ {{ 'catchUp.unlinkedTasks' | t }}</div>
            <ul>
              <li *ngFor="let task of visibleOrphanTasks" class="cu-task" (click)="openTask(task)">
                <span class="cu-task-pill" [ngClass]="bucketOf(task)">{{ bucketIcon(task) }}</span>
                <span class="cu-task-main">
                  <strong>{{ task.title }}</strong>
                  <small class="muted">{{ workspace.employeeName(task.assignedToEmployeeId) }}</small>
                </span>
                <span class="status-chip" [ngClass]="workspace.statusClass(task.status)">
                  {{ ('meetingTask.statusValues.' + task.status) | t }}
                </span>
              </li>
            </ul>
          </div>

          <div class="cu-allclear" *ngIf="groups.length && openOnly && !hasOpenItems">
            🎉 {{ 'catchUp.allCaughtUp' | t }}
          </div>
        </div>

        <!-- PREP TAB -->
        <div *ngIf="tab === 'prep'" class="cu-body">
          <app-meeting-prep-brief
            variant="full"
            [customerId]="cid"
          ></app-meeting-prep-brief>
        </div>
      </ng-container>
    </app-drawer-shell>
  `,
  styles: [`
    .cu-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .cu-title .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
    .cu-title h2 { margin: 2px 0 4px; line-height: 1.15; }
    .cu-when { font-size: 13px; color: var(--text-secondary); }
    .cu-close {
      flex-shrink: 0; width: 32px; height: 32px; border-radius: 999px;
      border: 1px solid var(--line); background: var(--bg-elevated); cursor: pointer;
      font-size: 14px; color: var(--muted); line-height: 1;
    }
    .cu-close:hover { background: var(--bg-hover); color: var(--text-primary); }

    .cu-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 4px; }
    .cu-chip {
      display: inline-flex; align-items: center; padding: 3px 11px; border-radius: 999px;
      border: 1px solid var(--line); background: var(--bg-elevated); font-size: 12px; font-weight: 600;
    }
    .cu-chip.danger { border-color: var(--danger); color: var(--danger); background: var(--danger-soft); }
    .cu-chip.warn   { border-color: var(--warning); color: var(--warning); background: var(--warning-soft); }
    .cu-chip.ok     { border-color: var(--success); color: var(--success); background: var(--success-soft); }

    .cu-tabs { display: flex; gap: 4px; margin: 14px 0 8px; border-bottom: 1px solid var(--line); }
    .cu-tabs button {
      appearance: none; border: 0; background: none; cursor: pointer; padding: 10px 14px;
      font-size: 14px; font-weight: 600; color: var(--muted); border-bottom: 2px solid transparent;
      margin-bottom: -1px;
    }
    .cu-tabs button.active { color: var(--accent); border-bottom-color: var(--accent); }

    .cu-body { padding-top: 6px; }

    .cu-filter { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--bg-sunken); margin-bottom: 16px; }
    .cu-filter button {
      appearance: none; border: 0; background: none; cursor: pointer; padding: 5px 14px; border-radius: 999px;
      font-size: 12px; font-weight: 600; color: var(--muted);
    }
    .cu-filter button.active { background: var(--bg-elevated); color: var(--accent); box-shadow: var(--shadow-sm); }

    .cu-empty, .cu-allclear { text-align: center; padding: 36px 12px; color: var(--muted); }
    .cu-empty-emoji { font-size: 32px; margin-bottom: 8px; }
    .cu-allclear { font-size: 14px; }

    /* Timeline */
    .cu-timeline { list-style: none; margin: 0; padding: 0; }
    .cu-node { position: relative; padding: 0 0 18px 26px; }
    .cu-node::before {
      content: ''; position: absolute; inset-inline-start: 6px; top: 16px; bottom: -2px;
      width: 2px; background: var(--line);
    }
    .cu-node:last-of-type::before { display: none; }
    .cu-dot {
      position: absolute; inset-inline-start: 0; top: 6px; width: 14px; height: 14px;
      border-radius: 999px; background: var(--accent); border: 3px solid var(--bg-elevated);
      box-shadow: 0 0 0 1px var(--line);
    }
    .cu-meeting {
      border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px;
      background: var(--bg-elevated); box-shadow: var(--shadow-sm);
    }
    .cu-meeting-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
    .cu-subject { font-size: 15px; }
    .cu-date { margin-inline-start: 8px; font-size: 12px; color: var(--muted); }
    .cu-leader { display: block; margin-top: 2px; }

    .cu-recap {
      margin-top: 12px; padding: 12px 14px; border-radius: 12px;
      background: var(--accent-soft); border: 1px solid var(--accent-soft);
      border-inline-start: 3px solid var(--accent);
    }
    .cu-recap-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-strong, var(--accent)); font-weight: 700; }
    .cu-recap-text { margin: 4px 0 0; font-size: 13px; line-height: 1.55; white-space: pre-wrap; color: var(--ink); }
    .cu-recap-text.clamped { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .cu-link { appearance: none; border: 0; background: none; cursor: pointer; padding: 4px 0 0; color: var(--accent); font-size: 12px; font-weight: 600; }

    .cu-notes { margin-top: 10px; display: grid; gap: 5px; }
    .cu-note-row { display: flex; gap: 8px; font-size: 13px; line-height: 1.4; align-items: baseline; }
    .cu-note-tag { flex-shrink: 0; font-size: 11px; font-weight: 700; }
    .cu-note-row.decision .cu-note-tag { color: var(--info); }
    .cu-note-row.blocker .cu-note-tag { color: var(--danger); }

    .cu-tasks { margin-top: 12px; }
    .cu-progress-head { display: flex; justify-content: space-between; align-items: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    .cu-tasks-label { color: var(--muted); font-weight: 700; }
    .cu-progress { height: 6px; border-radius: 999px; background: var(--bg-sunken); margin: 6px 0 10px; overflow: hidden; }
    .cu-progress-fill { display: block; height: 100%; border-radius: 999px; background: var(--success); transition: width .3s var(--ease-out, ease); }
    .cu-tasks ul, .cu-orphans ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .cu-task {
      display: flex; align-items: center; gap: 10px; padding: 8px 10px;
      border: 1px solid var(--line); border-radius: 10px; background: var(--bg-canvas); cursor: pointer;
    }
    .cu-task:hover { background: var(--bg-hover); }
    .cu-task-pill {
      flex-shrink: 0; width: 24px; height: 24px; border-radius: 999px; display: grid; place-items: center;
      font-size: 12px; background: var(--bg-sunken); color: var(--muted);
    }
    .cu-task-pill.overdue { background: var(--danger-soft); color: var(--danger); }
    .cu-task-pill.open    { background: var(--info-soft); color: var(--info); }
    .cu-task-pill.waiting { background: var(--warning-soft); color: var(--warning); }
    .cu-task-pill.done    { background: var(--success-soft); color: var(--success); }
    .cu-task-main { flex: 1; min-width: 0; display: grid; gap: 1px; }
    .cu-task-main strong { font-size: 13px; }
    .cu-task-main small { font-size: 11px; }
    .cu-no-tasks { display: block; margin-top: 10px; }

    .cu-orphans { margin-top: 8px; padding-top: 14px; border-top: 1px dashed var(--line); }
    .cu-orphans-head { font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 8px; }

    @media (max-width: 720px) {
      .cu-task { flex-wrap: wrap; }
    }
  `]
})
export class CatchUpDrawerComponent {
  tab: CatchUpTab = 'catchup';
  openOnly = false;
  private expanded = new Set<string>();
  private readonly i18n = inject(ActionosI18nService);

  constructor(public workspace: ActionosWorkspaceService) {}

  get customerId(): string | null {
    return this.workspace.catchUpCustomerId;
  }

  get customerName(): string {
    const id = this.customerId;
    return (id && this.workspace.clientName(id)) || '';
  }

  close(): void {
    this.workspace.closeCatchUpDrawer();
  }

  openTask(task: Task): void {
    this.workspace.selectMeetingTask(task, true);
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  private get meetings(): CustomerMeeting[] {
    const id = this.customerId;
    return id ? this.workspace.customerMeetingsByCustomer(id) : [];
  }

  private get allTasks(): Task[] {
    const id = this.customerId;
    return id ? this.workspace.meetingTasksByCustomer(id) : [];
  }

  get groups(): CatchUpMeetingGroup[] {
    return this.meetings.map((meeting) => {
      const tasks = this.workspace
        .meetingTasksByMeeting(meeting.id)
        .slice()
        .sort((a, b) => BUCKET_ORDER[this.bucketOf(a)] - BUCKET_ORDER[this.bucketOf(b)]);
      const doneCount = tasks.filter((t) => t.status === 'Done').length;
      const totalCount = tasks.length;
      return {
        meeting,
        recap: meeting.publishedRecap?.trim() || meeting.summary?.trim() || null,
        decisions: meeting.notes.filter((n) => n.type === 'decision'),
        blockers: meeting.notes.filter((n) => n.type === 'blocker'),
        tasks,
        doneCount,
        totalCount,
        donePct: totalCount ? Math.round((doneCount / totalCount) * 100) : 0
      };
    });
  }

  /** Groups filtered by the "open only" toggle (a group is kept if it has open work). */
  get visibleGroups(): CatchUpMeetingGroup[] {
    if (!this.openOnly) {
      return this.groups;
    }
    return this.groups.filter((g) => g.tasks.some((t) => this.bucketOf(t) !== 'done'));
  }

  /** Tasks whose sourceMeetingId doesn't resolve to any of this customer's meetings. */
  get orphanTasks(): Task[] {
    const meetingIds = new Set(this.meetings.map((m) => m.id));
    const groupedIds = new Set(
      this.meetings.flatMap((m) => this.workspace.meetingTasksByMeeting(m.id).map((t) => t.id))
    );
    return this.allTasks
      .filter((t) => !groupedIds.has(t.id))
      .filter((t) => !t.sourceMeetingId || !meetingIds.has(t.sourceMeetingId))
      .sort((a, b) => BUCKET_ORDER[this.bucketOf(a)] - BUCKET_ORDER[this.bucketOf(b)]);
  }

  get visibleOrphanTasks(): Task[] {
    const tasks = this.orphanTasks;
    return this.openOnly ? tasks.filter((t) => this.bucketOf(t) !== 'done') : tasks;
  }

  get counts(): { overdue: number; open: number; waiting: number; done: number } {
    const c = { overdue: 0, open: 0, waiting: 0, done: 0 };
    for (const t of this.allTasks) {
      c[this.bucketOf(t)]++;
    }
    return c;
  }

  get hasOpenItems(): boolean {
    return this.allTasks.some((t) => this.bucketOf(t) !== 'done');
  }

  get nextMeetingDate(): string | undefined {
    return this.customerId
      ? this.workspace.getCustomerPreparationSummary(this.customerId).nextMeetingDate
      : undefined;
  }

  get lastMetDays(): number | null {
    const last = this.meetings[0];
    return last ? this.daysSince(last.meetingDate) : null;
  }

  get lastMetLabel(): string {
    const d = this.lastMetDays;
    if (d === null) {
      return '';
    }
    if (d === 0) {
      return this.i18n.translate('catchUp.today');
    }
    return `${d} ${this.i18n.translate('catchUp.daysAgo')}`;
  }

  // ── Task bucket helpers ──────────────────────────────────────────────────────

  bucketOf(task: Task): TaskBucket {
    if (task.status === 'Done') {
      return 'done';
    }
    if (this.workspace.isMeetingTaskOverdue(task)) {
      return 'overdue';
    }
    if (task.status === 'Waiting For Customer' || task.status === 'Waiting For Internal') {
      return 'waiting';
    }
    return 'open';
  }

  bucketIcon(task: Task): string {
    const map: Record<TaskBucket, string> = { overdue: '⚠', open: '⏳', waiting: '⏸', done: '✓' };
    return map[this.bucketOf(task)];
  }

  // ── Recap expand/collapse ────────────────────────────────────────────────────

  isLong(text: string): boolean {
    return text.length > 140;
  }

  isExpanded(meetingId: string): boolean {
    return this.expanded.has(meetingId);
  }

  toggleRecap(meetingId: string): void {
    if (this.expanded.has(meetingId)) {
      this.expanded.delete(meetingId);
    } else {
      this.expanded.add(meetingId);
    }
  }

  private daysSince(dateIso: string): number {
    const then = new Date(dateIso.slice(0, 10));
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((startOfToday.getTime() - then.getTime()) / 86400000));
  }
}
