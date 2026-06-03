import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CreateTaskInput, Task } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { TaskTableComponent } from '../task-table/task-table.component';

/** People-scope filters shown above the table. */
export type StatTaskFilter = 'all' | 'mine' | 'assignedByMe';

/**
 * The single, shared "tasks" body used inside a stat popup: a row of people
 * filter chips followed by the shared task table — nothing else. Every tasks
 * tile in the app (Home metrics, Meetings open-tasks, client/member boards)
 * renders this, so they all behave identically.
 *
 * Owns the people-filter logic that used to live in metric-tasks-modal, so the
 * same "mine / I assigned to others / all" scoping is available everywhere.
 */
@Component({
  selector: 'app-stat-tasks-view',
  standalone: true,
  imports: [CommonModule, TranslatePipe, TaskTableComponent],
  template: `
    <div class="stat-tasks-filters" *ngIf="showFilters" role="tablist">
      <button
        *ngFor="let f of filters"
        type="button"
        role="tab"
        class="filter-chip"
        [class.active]="filter === f"
        [attr.aria-selected]="filter === f"
        (click)="filter = f"
      >
        {{ ('home.metricFilters.' + f) | t }}
      </button>
    </div>

    <app-task-table
      [tasks]="filteredTasks"
      groupBy="none"
      density="compact"
      [allowAddTask]="false"
      [newTaskDefaults]="newTaskDefaults"
      [emptyText]="emptyText"
      (rowOpened)="rowOpened.emit()"
    ></app-task-table>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 12px; }

    .stat-tasks-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .filter-chip {
      min-height: 32px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--bg-elevated);
      color: var(--muted);
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      transition: color var(--duration-fast) var(--ease-out),
        border-color var(--duration-fast) var(--ease-out),
        background var(--duration-fast) var(--ease-out);
    }
    .filter-chip:hover { color: var(--ink); border-color: var(--accent); }
    .filter-chip.active {
      color: var(--accent);
      border-color: var(--accent);
      background: var(--accent-soft);
    }
  `]
})
export class StatTasksViewComponent {
  @Input() tasks: Task[] = [];
  /** Show the people-filter chip row. */
  @Input() showFilters = true;
  /** Already-translated message shown when the (filtered) list is empty. */
  @Input() emptyText = '';
  /** Defaults applied if the embedded table ever adds a task. */
  @Input() newTaskDefaults?: Partial<CreateTaskInput>;
  @Output() rowOpened = new EventEmitter<void>();

  readonly filters: StatTaskFilter[] = ['all', 'mine', 'assignedByMe'];
  filter: StatTaskFilter = 'all';

  private readonly workspace = inject(ActionosWorkspaceService);

  get filteredTasks(): Task[] {
    if (!this.showFilters) return this.tasks;
    switch (this.filter) {
      case 'mine':
        return this.tasks.filter(t => this.assignedToMe(t));
      case 'assignedByMe':
        return this.tasks.filter(t => this.openedByMe(t) && !this.assignedToMe(t));
      case 'all':
      default:
        return this.tasks;
    }
  }

  /** "Mine" differs by source: meeting tasks key off employeeId, board tasks off memberId. */
  private assignedToMe(t: Task): boolean {
    return t.source === 'meeting'
      ? t.assignedToEmployeeId === this.workspace.currentEmployeeId
      : t.assigneeIds.includes(this.workspace.currentUserId);
  }

  private openedByMe(t: Task): boolean {
    return t.source === 'meeting'
      ? t.openedByEmployeeId === this.workspace.currentEmployeeId
      : t.createdByUserId === this.workspace.currentUserId;
  }
}
