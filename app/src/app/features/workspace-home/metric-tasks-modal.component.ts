import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MeetingNote, Task } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { StatModalComponent } from '../../shared/stat-modal/stat-modal.component';
import { StatTasksViewComponent } from '../../shared/stat-modal/stat-tasks-view.component';

export type MetricModalMode = 'tasks' | 'notes';

/**
 * Popup launched from a Home metric tile (Open work / Overdue / Blocked /
 * Follow-up debt). Lists the items the tile counts.
 *
 * Built on the shared <app-stat-modal> shell. In 'tasks' mode it delegates to
 * the shared <app-stat-tasks-view> (people-filter chips + task table). In
 * 'notes' mode (Follow-up debt = unconverted meeting actions) it shows a plain
 * note list with no filters, since notes have no assignee/creator.
 */
@Component({
  selector: 'app-metric-tasks-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe, StatModalComponent, StatTasksViewComponent],
  template: `
    <app-stat-modal
      [eyebrow]="'home.metricPopupEyebrow' | t"
      [title]="title | t"
      [closeLabel]="'common.close' | t"
      (close)="close.emit()"
    >
      <!-- TASK LIST -->
      <app-stat-tasks-view
        *ngIf="mode === 'tasks'"
        [tasks]="mergedTasks"
        [showFilters]="!hideFilters"
        [emptyText]="'home.noMatches' | t"
        (rowOpened)="close.emit()"
      ></app-stat-tasks-view>

      <!-- NOTES LIST (follow-up debt) -->
      <ng-container *ngIf="mode === 'notes'">
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
      </ng-container>
    </app-stat-modal>
  `,
  styles: [`
    .note {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      background: var(--surface-strong);
    }
    .note span {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }
    .note p { margin: 4px 0 0; font-size: 13px; }
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

  readonly workspace = inject(ActionosWorkspaceService);

  /** Meeting + board tasks merged for the shared tasks view (it branches on source). */
  get mergedTasks(): Task[] {
    return [...this.meetingTasks, ...this.tasks];
  }
}
