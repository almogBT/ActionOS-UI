import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  Customer, CustomerMeeting, Task } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';

type Customer360Tab = 'meetings' | 'openTasks' | 'closedTasks' | 'attachments';

@Component({
  selector: 'app-customer-360',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SearchableSelectComponent],
  template: `
    <section class="panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">{{ 'customer360.details' | t }}</span>
          <h3>{{ customer.name }}</h3>
        </div>
        <div class="topbar-actions">
          <button
            type="button"
            class="ghost-action"
            (click)="prepareMeeting.emit(customer)"
          >
            {{ 'customers.prepareMeeting' | t }}
          </button>
          <button
            type="button"
            class="primary-action"
            (click)="newMeeting.emit(customer)"
          >
            {{ 'customer360.newMeeting' | t }}
          </button>
        </div>
      </div>

      <div class="kpi-row">
        <div class="kpi-card">
          <span class="eyebrow">{{ 'customers.lastMeeting' | t }}</span>
          <strong>{{ formatDate(prep.latestMeetingDate) }}</strong>
        </div>
        <div class="kpi-card">
          <span class="eyebrow">{{ 'customers.nextMeeting' | t }}</span>
          <strong>{{ formatDate(prep.nextMeetingDate) }}</strong>
        </div>
        <div class="kpi-card">
          <span class="eyebrow">{{ 'customers.openTasks' | t }}</span>
          <strong>{{ prep.openTasks.length }}</strong>
        </div>
        <div class="kpi-card kpi-danger">
          <span class="eyebrow">{{ 'customers.overdueTasks' | t }}</span>
          <strong>{{ prep.overdueTasks.length }}</strong>
        </div>
      </div>

      <dl class="detail-grid">
        <div>
          <dt>{{ 'common.status' | t }}</dt>
          <dd>
            <span class="status-chip" [ngClass]="workspace.statusClass(customer.status)">
              {{ ('customerStatus.' + customer.status) | t }}
            </span>
          </dd>
        </div>
        <div>
          <dt>{{ 'customers.type' | t }}</dt>
          <dd>{{ ('customerType.' + customer.type) | t }}</dd>
        </div>
        <div *ngIf="customer.externalGroupId">
          <dt>{{ 'customers.externalGroup' | t }}</dt>
          <dd>{{ customer.externalGroupId }}</dd>
        </div>
        <div *ngIf="customer.primaryContactName">
          <dt>{{ 'customers.primaryContactName' | t }}</dt>
          <dd>{{ customer.primaryContactName }}</dd>
        </div>
        <div *ngIf="customer.primaryContactEmail">
          <dt>{{ 'customers.primaryContactEmail' | t }}</dt>
          <dd>{{ customer.primaryContactEmail }}</dd>
        </div>
        <div *ngIf="customer.primaryContactPhone">
          <dt>{{ 'customers.primaryContactPhone' | t }}</dt>
          <dd>{{ customer.primaryContactPhone }}</dd>
        </div>
        <div>
          <dt>{{ 'customers.accountOwner' | t }}</dt>
          <dd>{{ workspace.employeeName(customer.accountOwnerEmployeeId) }}</dd>
        </div>
        <div *ngIf="customer.type === 'Prospect'">
          <dt>{{ 'customers.promoteProspect' | t }}</dt>
          <dd class="promote-row" (click)="$event.stopPropagation()">
            <app-searchable-select
              [(ngModel)]="promoteGroupId"
              [options]="externalGroupOptions"
              [placeholder]="'customers.selectExternalGroup' | t"
            ></app-searchable-select>
            <button
              type="button"
              class="primary-action"
              [disabled]="!promoteGroupId"
              (click)="promote()"
            >
              {{ 'customers.promoteProspect' | t }}
            </button>
          </dd>
        </div>
      </dl>
    </section>

    <section class="panel">
      <div class="tab-strip">
        <button
          *ngFor="let t of tabs"
          type="button"
          [class.active]="activeTab === t"
          (click)="activeTab = t"
        >
          {{ ('customer360.tabs.' + t) | t }}
        </button>
      </div>

      <ng-container [ngSwitch]="activeTab">
        <!-- Meetings -->
        <div *ngSwitchCase="'meetings'" class="meetings-tab">
          <div *ngIf="!meetings.length" class="empty-state">{{ 'customer360.noMeetings' | t }}</div>
          <article
            *ngFor="let m of meetings"
            class="meeting-card"
            style="cursor:pointer"
            (click)="workspace.openMeetingDrawer(m.id)"
          >
            <header>
              <div>
                <strong>{{ m.subject }}</strong>
                <span class="muted">{{ formatDate(m.meetingDate) }}</span>
              </div>
              <span class="status-chip" [ngClass]="workspace.statusClass(m.status)">
                {{ ('customerMeeting.statusValues.' + m.status) | t }}
              </span>
            </header>
            <p *ngIf="m.summary" class="muted">{{ m.summary }}</p>
            <footer class="muted">
              {{ 'customerMeeting.meetingLeader' | t }}: {{ workspace.employeeName(m.meetingLeaderEmployeeId) }}
              · {{ m.notes.length }} {{ 'customerMeeting.notes' | t }}
              · {{ tasksFromMeeting(m).length }} {{ 'common.task' | t }}
            </footer>
          </article>
        </div>

        <!-- Open tasks -->
        <div *ngSwitchCase="'openTasks'">
          <div *ngIf="!prep.openTasks.length" class="empty-state">{{ 'customer360.noOpenTasks' | t }}</div>
          <div *ngFor="let task of prep.openTasks" class="task-card" (click)="openTask(task)">
            <div class="task-main">
              <strong>{{ task.title }}</strong>
              <span class="status-chip" [ngClass]="workspace.statusClass(task.status)">
                {{ ('Task.statusValues.' + task.status) | t }}
              </span>
            </div>
            <div class="task-meta muted">
              <span>{{ 'Task.assignedTo' | t }}: {{ workspace.employeeName(task.assignedToEmployeeId) }}</span>
              <span *ngIf="task.dueDate" [class.overdue]="workspace.isMeetingTaskOverdue(task)">
                {{ 'common.due' | t }} {{ task.dueDate }}
              </span>
              <span>{{ ('priority.' + task.priority.toLowerCase()) | t }}</span>
            </div>
          </div>
        </div>

        <!-- Closed tasks -->
        <div *ngSwitchCase="'closedTasks'">
          <div *ngIf="!closedTasks.length" class="empty-state">{{ 'customer360.noClosedTasks' | t }}</div>
          <div *ngFor="let task of closedTasks" class="task-card" (click)="openTask(task)">
            <div class="task-main">
              <strong>{{ task.title }}</strong>
              <span class="status-chip" [ngClass]="workspace.statusClass(task.status)">
                {{ ('Task.statusValues.' + task.status) | t }}
              </span>
            </div>
            <div class="task-meta muted">
              <span>{{ workspace.employeeName(task.assignedToEmployeeId) }}</span>
              <span>{{ task.updatedAt | slice:0:10 }}</span>
            </div>
          </div>
        </div>

        <!-- Attachments -->
        <div *ngSwitchCase="'attachments'" class="empty-state">
          <p>{{ 'attachments.mockNotice' | t }}</p>
          <p *ngIf="!attachments.length" class="muted">{{ 'customer360.noAttachments' | t }}</p>
          <div *ngFor="let a of attachments" class="attachment-row">
            <strong>{{ a.fileName }}</strong>
            <span class="muted">{{ a.sizeBytes }} bytes</span>
          </div>
        </div>
      </ng-container>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin: 1rem 0 1.5rem;
    }
    .kpi-card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 0.75rem;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .kpi-card strong { font-size: 1.5rem; }
    .kpi-danger strong { color: #f87171; }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 1rem;
      margin: 0;
    }
    .detail-grid div { display: flex; flex-direction: column; gap: 0.25rem; }
    .detail-grid dt { opacity: 0.6; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .detail-grid dd { margin: 0; }
    .promote-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .meeting-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 0.75rem;
      padding: 1rem;
      margin-bottom: 0.75rem;
    }
    .meeting-card header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
    .meeting-card footer { font-size: 0.85rem; margin-top: 0.5rem; }
    .meeting-card .muted { opacity: 0.7; }
    .meeting-card span.muted { display: inline-block; margin-inline-start: 0.5rem; }
    .empty-state { padding: 2rem; text-align: center; opacity: 0.7; }
    .overdue { color: #f87171; font-weight: 600; }
    .task-card { cursor: pointer; }
    .attachment-row {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    @media (max-width: 720px) {
      .kpi-row { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class Customer360Component {
  @Input({ required: true }) customer!: Customer;
  @Output() newMeeting = new EventEmitter<Customer>();
  @Output() prepareMeeting = new EventEmitter<Customer>();

  readonly tabs: Customer360Tab[] = ['meetings', 'openTasks', 'closedTasks', 'attachments'];
  activeTab: Customer360Tab = 'meetings';
  promoteGroupId = '';

  constructor(public workspace: ActionosWorkspaceService) {}

  get externalGroupOptions(): SelectOption[] {
    return this.workspace.externalCustomerGroups.map(g => ({ value: g.id, label: g.name }));
  }

  get meetings(): CustomerMeeting[] {
    return this.workspace.customerMeetingsByCustomer(this.customer.id);
  }

  get prep() {
    return this.workspace.getCustomerPreparationSummary(this.customer.id);
  }

  get closedTasks(): Task[] {
    return this.workspace
      .meetingTasksByCustomer(this.customer.id)
      .filter((t) => !this.workspace.isOpenMeetingTaskStatus(t.status));
  }

  get attachments() {
    return this.workspace.attachmentsFor('customer', this.customer.id);
  }

  tasksFromMeeting(m: CustomerMeeting): Task[] {
    return this.workspace.meetingTasksByMeeting(m.id);
  }

  openTask(task: Task): void {
    this.workspace.selectMeetingTask(task, true);
  }

  promote(): void {
    if (!this.promoteGroupId) {
      return;
    }
    const updated = this.workspace.promoteProspect(this.customer.id, this.promoteGroupId);
    if (updated) {
      this.customer = updated;
      this.promoteGroupId = '';
    }
  }

  formatDate(iso: string | undefined): string {
    if (!iso) {
      return '—';
    }
    return iso.slice(0, 10);
  }
}
