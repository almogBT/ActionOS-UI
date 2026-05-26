import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Customer, CustomerPreparationSummary, MeetingTask } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

@Component({
  selector: 'app-meeting-prep',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <section class="panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">{{ 'meetingPrep.summaryFor' | t }}</span>
          <h3>{{ customer.name }}</h3>
        </div>
        <div class="topbar-actions">
          <button type="button" class="ghost-action" (click)="back.emit()">
            {{ 'customer360.backToList' | t }}
          </button>
          <button type="button" class="ghost-action" (click)="print()">
            {{ 'meetingPrep.print' | t }}
          </button>
          <button type="button" class="primary-action" (click)="startMeeting.emit(customer)">
            + {{ 'meetingPrep.startMeetingNow' | t }}
          </button>
        </div>
      </div>

      <div class="prep-section">
        <h4>{{ 'meetingPrep.priorMeetings' | t }} ({{ prep.priorMeetings.length }})</h4>
        <p *ngIf="!prep.priorMeetings.length" class="muted">{{ 'meetingPrep.nothing' | t }}</p>
        <ul>
          <li *ngFor="let m of prep.priorMeetings">
            <strong>{{ m.subject }}</strong>
            <span class="muted">{{ m.meetingDate | slice:0:10 }}</span>
            <p *ngIf="m.summary" class="summary-text">{{ m.summary }}</p>
          </li>
        </ul>
      </div>

      <div class="prep-section prep-danger" *ngIf="prep.overdueTasks.length">
        <h4>{{ 'meetingPrep.overdueTasks' | t }} ({{ prep.overdueTasks.length }})</h4>
        <ul>
          <li *ngFor="let task of prep.overdueTasks" (click)="openTask(task)">
            <strong>{{ task.title }}</strong>
            <span class="muted">
              {{ workspace.employeeName(task.assignedToEmployeeId) }}
              · {{ 'common.due' | t }} {{ task.dueDate }}
            </span>
          </li>
        </ul>
      </div>

      <div class="prep-section">
        <h4>{{ 'meetingPrep.openTasks' | t }} ({{ prep.openTasks.length }})</h4>
        <p *ngIf="!prep.openTasks.length" class="muted">{{ 'meetingPrep.nothing' | t }}</p>
        <ul>
          <li *ngFor="let task of prep.openTasks" (click)="openTask(task)">
            <strong>{{ task.title }}</strong>
            <span class="status-chip" [ngClass]="workspace.statusClass(task.status)">
              {{ ('meetingTask.statusValues.' + task.status) | t }}
            </span>
            <span class="muted">{{ workspace.employeeName(task.assignedToEmployeeId) }}</span>
          </li>
        </ul>
      </div>

      <div class="prep-section">
        <h4>{{ 'meetingPrep.waitingForCustomer' | t }} ({{ prep.waitingForCustomer.length }})</h4>
        <p *ngIf="!prep.waitingForCustomer.length" class="muted">{{ 'meetingPrep.nothing' | t }}</p>
        <ul>
          <li *ngFor="let task of prep.waitingForCustomer" (click)="openTask(task)">
            <strong>{{ task.title }}</strong>
            <span class="muted">{{ workspace.employeeName(task.assignedToEmployeeId) }}</span>
          </li>
        </ul>
      </div>

      <div class="prep-section">
        <h4>{{ 'meetingPrep.completedSinceLastMeeting' | t }} ({{ prep.completedSinceLastMeeting.length }})</h4>
        <p *ngIf="!prep.completedSinceLastMeeting.length" class="muted">{{ 'meetingPrep.nothing' | t }}</p>
        <ul>
          <li *ngFor="let task of prep.completedSinceLastMeeting" (click)="openTask(task)">
            <strong>{{ task.title }}</strong>
            <span class="muted">{{ workspace.employeeName(task.assignedToEmployeeId) }}</span>
          </li>
        </ul>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .prep-section { margin-bottom: 1.5rem; }
    .prep-section h4 {
      margin: 0 0 0.5rem;
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.85;
    }
    .prep-section.prep-danger h4 { color: #f87171; }
    .prep-section ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .prep-section li {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      padding: 0.5rem 0.75rem;
      background: rgba(255,255,255,0.03);
      border-radius: 0.5rem;
      cursor: pointer;
      flex-wrap: wrap;
    }
    .prep-section li:hover { background: rgba(255,255,255,0.06); }
    .summary-text { width: 100%; margin: 0.25rem 0 0; font-size: 0.85rem; opacity: 0.75; }
    @media print {
      .topbar-actions { display: none; }
    }
  `]
})
export class MeetingPrepComponent {
  @Input({ required: true }) customer!: Customer;
  @Output() back = new EventEmitter<void>();
  @Output() startMeeting = new EventEmitter<Customer>();

  constructor(public workspace: ActionosWorkspaceService) {}

  get prep(): CustomerPreparationSummary {
    return this.workspace.getCustomerPreparationSummary(this.customer.id);
  }

  openTask(task: MeetingTask): void {
    this.workspace.selectMeetingTask(task, true);
  }

  print(): void {
    window.print();
  }
}
