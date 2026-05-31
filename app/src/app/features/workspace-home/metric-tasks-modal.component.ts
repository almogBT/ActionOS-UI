import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MeetingNote, Task } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

export type MetricModalMode = 'tasks' | 'notes';
type PeopleFilter = 'all' | 'mine' | 'assignedByMe' | 'opened' | 'assignedToMeByOthers';
type TaskKind = 'board' | 'meeting';

interface MetricTaskRow {
  kind: TaskKind;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  boardLabel: string;
  assigneeLabel: string;
  assignedToMe: boolean;
  openedByMe: boolean;
  task: Task | Task;
}

/**
 * Popup launched from a Home metric tile (Open work / Overdue / Blocked /
 * Follow-up debt). Lists the items the tile counts.
 *
 * In 'tasks' mode it shows the people-filter tabs (all / mine / I assigned to
 * others / I opened / assigned to me by others). In 'notes' mode (Follow-up
 * debt = unconverted meeting actions) the filters are hidden, since notes have
 * no assignee/creator.
 */
@Component({
  selector: 'app-metric-tasks-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="modal-backdrop" role="presentation" (click)="close.emit()">
      <aside
        class="modal-card"
        role="dialog"
        [attr.aria-label]="title | t"
        (click)="$event.stopPropagation()"
      >
        <header class="modal-header">
          <div>
            <span class="eyebrow">{{ 'home.metricPopupEyebrow' | t }}</span>
            <h2>{{ title | t }}</h2>
          </div>
          <button type="button" class="ghost-action" (click)="close.emit()">
            {{ 'common.close' | t }}
          </button>
        </header>

        <div class="tab-strip" *ngIf="mode === 'tasks' && !hideFilters">
          <button
            type="button"
            *ngFor="let f of peopleFilters"
            [class.active]="filter === f"
            (click)="filter = f"
          >
            {{ ('home.metricFilters.' + f) | t }}
          </button>
        </div>

        <!-- TASK LIST -->
        <div *ngIf="mode === 'tasks'" class="modal-list">
          <button
            *ngFor="let row of filteredTaskRows"
            type="button"
            class="task-row"
            (click)="openTask(row)"
          >
            <span class="row-main">
              <strong>{{ row.title }}</strong>
              <small>{{ row.boardLabel }} · {{ 'common.due' | t }} {{ row.dueDate }} · {{ row.assigneeLabel }}</small>
            </span>
            <div class="row-badges">
              <span class="status-badge" [ngClass]="workspace.statusClass(row.status)">
                {{ ('status.' + workspace.statusClass(row.status)) | t }}
              </span>
              <span class="priority" [ngClass]="workspace.statusClass(row.priority)">
                {{ ('priority.' + workspace.statusClass(row.priority)) | t }}
              </span>
            </div>
          </button>

          <div *ngIf="!filteredTaskRows.length" class="empty-state">
            <strong>{{ 'home.noMatches' | t }}</strong>
          </div>
        </div>

        <!-- NOTES LIST (follow-up debt) -->
        <div *ngIf="mode === 'notes'" class="modal-list">
          <article
            *ngFor="let note of notes"
            class="note"
            [ngClass]="workspace.statusClass(note.type)"
          >
            <span>{{ ('noteType.' + note.type) | t }}</span>
            <p>{{ note.content }}</p>
          </article>

          <div *ngIf="!notes.length" class="empty-state">
            <strong>{{ 'home.noMatches' | t }}</strong>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(20, 30, 50, 0.45);
      display: grid;
      place-items: center;
      z-index: 50;
      padding: 1rem;
    }
    .modal-card {
      background: var(--bg-elevated);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: var(--shadow);
      max-width: 640px;
      width: 100%;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 20px;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
    }
    .modal-header h2 { margin: 4px 0 0; font-size: 20px; }
    .modal-header .eyebrow {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      font-weight: 800;
    }
    /* The list area itself scrolls so the header + filters stay pinned. */
    .modal-list {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
    }
    .task-row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      text-align: start;
      background: var(--surface-strong);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      cursor: pointer;
      color: inherit;
    }
    .task-row:hover { background: var(--bg-elevated); }
    .task-row .row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .task-row .row-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .task-row .row-main small { color: var(--muted); }
    .row-badges {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      flex-shrink: 0;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      background: var(--bg-sunken);
      color: var(--text-secondary);
      border: 1px solid var(--line);
    }
    .status-badge.in-progress { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 30%, transparent); }
    .status-badge.waiting,
    .status-badge.waiting-for-customer,
    .status-badge.waiting-for-internal { background: color-mix(in srgb, #f59e0b 12%, transparent); color: #b45309; border-color: color-mix(in srgb, #f59e0b 30%, transparent); }
    .status-badge.done { background: color-mix(in srgb, #10b981 12%, transparent); color: #065f46; border-color: color-mix(in srgb, #10b981 30%, transparent); }
    .status-badge.cancelled { opacity: 0.5; }
    .empty-state { padding: 1.5rem; text-align: center; color: var(--muted); }
  `]
})
export class MetricTasksModalComponent {
  @Input() title = '';
  @Input() mode: MetricModalMode = 'tasks';
  @Input() tasks: Task[] = [];
  @Input() meetingTasks: Task[] = [];
  @Input() notes: MeetingNote[] = [];
  @Input() hideFilters = false;
  @Output() close = new EventEmitter<void>();

  readonly peopleFilters: PeopleFilter[] = ['all', 'mine', 'assignedByMe', 'opened', 'assignedToMeByOthers'];
  filter: PeopleFilter = 'all';

  constructor(public workspace: ActionosWorkspaceService) {}

  get allTaskRows(): MetricTaskRow[] {
    const boardRows: MetricTaskRow[] = this.tasks.map(task => ({
      kind: 'board',
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      boardLabel: task.board,
      assigneeLabel: task.assigneeIds.length
        ? task.assigneeIds.map(id => this.workspace.memberName(id)).join(', ')
        : '�',
      assignedToMe: task.assigneeIds.includes(this.workspace.currentUserId),
      openedByMe: task.createdByUserId === this.workspace.currentUserId,
      task
    }));

    const meetingRows: MetricTaskRow[] = this.meetingTasks.map(task => ({
      kind: 'meeting',
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      boardLabel: this.workspace.customer(task.customerId)?.name ?? 'Customer',
      assigneeLabel: this.workspace.employeeName(task.assignedToEmployeeId),
      assignedToMe: task.assignedToEmployeeId === this.workspace.currentEmployeeId,
      openedByMe: task.openedByEmployeeId === this.workspace.currentEmployeeId,
      task
    }));

    return [...meetingRows, ...boardRows];
  }

  get filteredTaskRows(): MetricTaskRow[] {
    switch (this.filter) {
      case 'mine':
        return this.allTaskRows.filter(row => row.assignedToMe);
      case 'assignedByMe':
        return this.allTaskRows.filter(row => row.openedByMe && !row.assignedToMe);
      case 'opened':
        return this.allTaskRows.filter(row => row.openedByMe);
      case 'assignedToMeByOthers':
        return this.allTaskRows.filter(row => row.assignedToMe && !row.openedByMe);
      case 'all':
      default:
        return this.allTaskRows;
    }
  }

  openTask(row: MetricTaskRow): void {
    if (row.kind === 'meeting') {
      this.workspace.selectMeetingTask(row.task as Task);
    } else {
      this.workspace.selectBoardTask(row.task as Task);
    }
    this.close.emit();
  }
}
