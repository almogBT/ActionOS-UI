import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CustomerMeeting } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

/**
 * The single, shared "meetings" body used inside a stat popup. Renders one
 * consistent meeting row everywhere (Home board preview, Meetings KPIs) instead
 * of the three divergent row styles that existed before.
 */
@Component({
  selector: 'app-stat-meetings-view',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <button
      *ngFor="let m of meetings"
      type="button"
      class="stat-meeting-row"
      (click)="meetingOpened.emit(m)"
    >
      <span class="row-main">
        <strong>{{ m.subject }}</strong>
        <small>{{ workspace.customer(m.customerId)?.name }} · {{ m.meetingDate | slice:0:10 }}</small>
      </span>
      <span class="row-meta">
        <span class="status-chip" [ngClass]="workspace.statusClass(m.status)">
          {{ ('customerMeeting.statusValues.' + m.status) | t }}
        </span>
        <span class="task-count-badge">
          {{ taskCount(m) }} {{ 'common.task' | t }}
        </span>
      </span>
    </button>

    <div *ngIf="!meetings.length" class="empty-state">
      <strong>{{ emptyText }}</strong>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 8px; }

    .stat-meeting-row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      text-align: start;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface-strong);
      cursor: pointer;
      color: inherit;
      transition: border-color var(--duration-fast) var(--ease-out),
        background var(--duration-fast) var(--ease-out);
    }
    .stat-meeting-row:hover {
      background: var(--bg-elevated);
      border-color: var(--accent);
    }

    .row-main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }
    .row-main strong {
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row-main small { color: var(--muted); font-size: 12px; }

    .row-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .task-count-badge {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      white-space: nowrap;
    }

    .empty-state { padding: 1.5rem; text-align: center; color: var(--muted); }
  `]
})
export class StatMeetingsViewComponent {
  @Input() meetings: CustomerMeeting[] = [];
  /** Already-translated message shown when the list is empty. */
  @Input() emptyText = '';
  @Output() meetingOpened = new EventEmitter<CustomerMeeting>();

  readonly workspace = inject(ActionosWorkspaceService);

  taskCount(m: CustomerMeeting): number {
    return this.workspace.meetingTasksByMeeting(m.id).length;
  }
}
