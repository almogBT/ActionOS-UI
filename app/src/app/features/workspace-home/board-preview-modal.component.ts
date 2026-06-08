import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CustomerMeeting, Task } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { IconComponent } from '../../shared/icons/icon.component';
import { MeetingCardComponent } from '../../shared/meeting-card/meeting-card.component';
import { StatModalComponent } from '../../shared/stat-modal/stat-modal.component';
import { TaskTableComponent } from '../../shared/task-table/task-table.component';

export type BoardPreviewType = 'client' | 'member';

/**
 * Quick-view popup opened from the My Work rail when the user clicks a client or
 * a teammate. Mirrors the Boards page layout inside a modal: a Meetings panel
 * (standard horizontal carousel of <app-meeting-card variant="rail">, expandable
 * to a grid) and a Tasks panel (shared <app-task-table>). Works for both a
 * client (its meetings/tasks) and a member (meetings they lead/attend + their
 * tasks).
 *
 * Built on the shared <app-stat-modal> shell (backdrop + header + close).
 */
@Component({
  selector: 'app-board-preview-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe, IconComponent, StatModalComponent, MeetingCardComponent, TaskTableComponent],
  template: `
    <app-stat-modal
      [eyebrow]="(entityType === 'client' ? 'boardPreview.clientEyebrow' : 'boardPreview.memberEyebrow') | t"
      [title]="entityName"
      [closeLabel]="'common.close' | t"
      (close)="close.emit()"
    >
      <ng-container statActions>
        <button type="button" class="primary-action" (click)="newMeeting.emit()">
          {{ 'boardPreview.newMeeting' | t }}
        </button>
        <button *ngIf="entityType === 'client'" type="button" class="ghost-action" (click)="prepareMeeting.emit()">
          {{ 'customers.prepareMeeting' | t }}
        </button>
        <button *ngIf="entityType === 'client'" type="button" class="ghost-action" (click)="openFullProfile.emit()">
          {{ 'boardPreview.fullProfile' | t }}
        </button>
      </ng-container>

      <!-- ── Meetings panel (carousel → expandable grid, like Boards) ─────── -->
      <section class="bp-panel">
        <div class="bp-head">
          <div class="bp-head-text">
            <app-icon name="calendar" [size]="15"></app-icon>
            <h3>{{ 'boardPreview.meetings' | t }}</h3>
          </div>
          <div class="bp-rail-tools" *ngIf="meetings.length">
            <span class="bp-count">{{ meetings.length }}</span>
            <div class="bp-rail-nav" *ngIf="!meetingsExpanded && meetings.length > 1">
              <button type="button" class="bp-rail-arrow" (click)="scrollRail(railTrack, -1)"
                [attr.aria-label]="'meetingsOverview.scrollPrev' | t">‹</button>
              <button type="button" class="bp-rail-arrow" (click)="scrollRail(railTrack, 1)"
                [attr.aria-label]="'meetingsOverview.scrollNext' | t">›</button>
            </div>
            <button type="button" class="bp-expand" *ngIf="meetings.length > 1"
              (click)="meetingsExpanded = !meetingsExpanded">
              {{ (meetingsExpanded ? 'boards.collapseMeetings' : 'boards.expandMeetings') | t }}
            </button>
          </div>
        </div>

        <div #railTrack
          [hidden]="!meetings.length"
          [class.carousel-track]="!meetingsExpanded"
          [class.meeting-grid-expanded]="meetingsExpanded"
          (wheel)="onRailWheel($event, railTrack)">
          <app-meeting-card *ngFor="let m of meetings"
            [meeting]="m"
            [variant]="meetingsExpanded ? 'grid' : 'rail'"
            (opened)="close.emit()"></app-meeting-card>
        </div>
        <div class="bp-empty" *ngIf="!meetings.length">{{ 'boardPreview.noMeetings' | t }}</div>
      </section>

      <!-- ── Tasks panel (shared table) ───────────────────────────────────── -->
      <section class="bp-panel">
        <div class="bp-head">
          <div class="bp-head-text">
            <app-icon name="check-square" [size]="15"></app-icon>
            <h3>{{ 'boardPreview.tasks' | t }}</h3>
          </div>
          <span class="bp-count">{{ tasks.length }}</span>
        </div>

        <app-task-table
          [tasks]="tasks"
          groupBy="due"
          [allowAddTask]="entityType === 'client'"
          [newTaskDefaults]="entityType === 'client' ? { customerId: entityId } : undefined"
          [emptyText]="'boardPreview.noTasks' | t"
          (rowOpened)="close.emit()"
        ></app-task-table>
      </section>
    </app-stat-modal>
  `,
  styles: [`
    /* Roomier than the default stat popup so the carousel + task table breathe,
       like the Boards page. Scoped to this popup only. */
    :host ::ng-deep .stat-modal-card { max-width: 920px; }

    .bp-panel { display: flex; flex-direction: column; gap: 12px; }

    .bp-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .bp-head-text { display: inline-flex; align-items: center; gap: 8px; }
    .bp-head-text app-icon { color: var(--accent); }
    .bp-head-text h3 { margin: 0; font-size: 15px; color: var(--text-primary); }

    .bp-rail-tools { display: inline-flex; align-items: center; gap: 8px; }

    .bp-count {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      background: var(--surface-strong);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 2px 9px;
    }

    .bp-rail-nav { display: inline-flex; gap: 4px; }
    .bp-rail-arrow {
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border: 1px solid var(--border-subtle);
      border-radius: 50%;
      background: var(--bg-elevated);
      color: var(--accent);
      font-size: 17px;
      line-height: 1;
      cursor: pointer;
      transition: background var(--duration-fast), border-color var(--duration-fast);
    }
    .bp-rail-arrow:hover { background: var(--accent-soft); border-color: var(--accent); }

    .bp-expand {
      height: 28px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius-pill, 999px);
      background: var(--bg-elevated);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background var(--duration-fast), color var(--duration-fast), border-color var(--duration-fast);
    }
    .bp-expand:hover { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }

    /* Collapsed: single-row horizontal scroll-snap carousel (matches Boards). */
    .carousel-track {
      display: flex;
      align-items: stretch;
      gap: 10px;
      min-width: 0;
      overflow-x: auto;
      overscroll-behavior-inline: contain;
      scroll-snap-type: x proximity;
      padding-bottom: 8px;
      scrollbar-width: thin;
      scrollbar-color: var(--accent-soft) transparent;
    }
    .carousel-track::-webkit-scrollbar { height: 8px; }
    .carousel-track::-webkit-scrollbar-thumb { background: var(--accent-soft); border-radius: 4px; }

    /* Expanded: up to 3 rows of cards, then scrolls. */
    .meeting-grid-expanded {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      align-items: start;
      gap: 10px;
      max-height: 420px;
      overflow-y: auto;
      padding-right: 4px;
      scrollbar-width: thin;
      scrollbar-color: var(--accent-soft) transparent;
    }
    .meeting-grid-expanded::-webkit-scrollbar { width: 8px; }
    .meeting-grid-expanded::-webkit-scrollbar-thumb { background: var(--accent-soft); border-radius: 4px; }

    .bp-empty {
      margin: 0;
      padding: 16px;
      text-align: center;
      color: var(--text-tertiary);
      font-size: 13px;
      border: 1px dashed var(--line);
      border-radius: var(--radius-md, 8px);
    }
  `]
})
export class BoardPreviewModalComponent implements OnChanges {
  @Input() entityType: BoardPreviewType = 'member';
  @Input() entityId = '';
  @Input() entityName = '';
  @Output() close = new EventEmitter<void>();
  /** Client mode only: open Customer 360 detail page. */
  @Output() openFullProfile = new EventEmitter<void>();
  /** Open a new meeting pre-filled for this entity. */
  @Output() newMeeting = new EventEmitter<void>();
  /** Client mode only: open meeting prep for this customer. */
  @Output() prepareMeeting = new EventEmitter<void>();

  /** Meetings carousel (false) vs. expanded grid (true) — same as Boards. */
  meetingsExpanded = false;

  readonly workspace = inject(ActionosWorkspaceService);

  ngOnChanges(changes: SimpleChanges): void {
    // Reopening for a different entity starts the meetings collapsed.
    if (changes['entityType'] || changes['entityId']) {
      this.meetingsExpanded = false;
    }
  }

  // ── Meetings ────────────────────────────────────────────────────────────
  /** A client's meetings, or a member's led/attended meetings. */
  get meetings(): CustomerMeeting[] {
    return this.entityType === 'client' ? this.clientMeetings : this.memberMeetings;
  }

  private get clientMeetings(): CustomerMeeting[] {
    if (this.entityType !== 'client' || !this.entityId) return [];
    return this.workspace.visibleCustomerMeetingsByCustomer(this.entityId)
      .slice()
      .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
  }

  private get memberMeetings(): CustomerMeeting[] {
    if (this.entityType !== 'member' || !this.entityId) return [];
    const employeeId = this.workspace.employeeIdForMember(this.entityId);
    if (!employeeId) return [];
    return this.workspace.visibleCustomerMeetings
      .filter(m =>
        m.meetingLeaderEmployeeId === employeeId ||
        m.internalParticipantEmployeeIds.includes(employeeId)
      )
      .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
  }

  // ── Tasks ───────────────────────────────────────────────────────────────
  /** A client's tasks, or all of a member's tasks. */
  get tasks(): Task[] {
    return this.entityType === 'client' ? this.clientTasks : this.memberTasks;
  }

  private get clientTasks(): Task[] {
    if (this.entityType !== 'client' || !this.entityId) return [];
    return this.workspace.meetingTasksByCustomer(this.entityId);
  }

  private get memberTasks(): Task[] {
    if (this.entityType !== 'member' || !this.entityId) return [];
    const employeeId = this.workspace.employeeIdForMember(this.entityId);
    if (!employeeId) return [];
    return this.workspace.meetingTasks.filter(t =>
      t.assignedToEmployeeId === employeeId || t.openedByEmployeeId === employeeId
    );
  }

  // ── Carousel scrolling (mirrors the Meetings/Boards rails) ───────────────
  scrollRail(track: HTMLElement, dir: number): void {
    track.scrollBy({ left: dir * track.clientWidth * 0.9, behavior: 'smooth' });
  }

  /** Translate vertical wheel motion into horizontal scroll on the carousel.
   *  No-op when there's nothing to scroll horizontally (e.g. the expanded grid),
   *  so vertical scroll passes through. */
  onRailWheel(event: WheelEvent, track: HTMLElement): void {
    if (track.scrollWidth <= track.clientWidth) return;
    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!delta) return;
    event.preventDefault();
    track.scrollBy({ left: delta, behavior: 'auto' });
  }
}
