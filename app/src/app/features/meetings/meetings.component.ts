import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  Customer, CustomerMeeting, CustomerMeetingStatus, ViewId } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { CustomerMeetingFormComponent, MeetingFormSavedEvent } from '../customers/customer-meeting-form.component';

type MeetingsSubView = 'overview' | 'editor';
type MeetingLane = 'upcoming' | 'in-progress' | 'closed';

interface LaneBucket {
  lane: MeetingLane;
  labelKey: string;
  meetings: CustomerMeeting[];
}

/**
 * Top-level Meetings tab — the spine of the app.
 *
 * Replaces the v1 legacy single-meeting demo. Shows all customer meetings
 * across all customers, grouped by lane (upcoming / in-progress / closed),
 * with a customer filter and a quick "new meeting" entry point.
 */
@Component({
  selector: 'app-meetings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SearchableSelectComponent, CustomerMeetingFormComponent],
  template: `
    <section class="screen" *ngIf="subView === 'overview'">
      <div class="screen-title">
        <div>
          <span class="eyebrow">{{ 'meetingsOverview.eyebrow' | t }}</span>
          <h2>{{ 'meetingsOverview.title' | t }}</h2>
          <p class="screen-subtitle">{{ 'meetingsOverview.subtitle' | t }}</p>
        </div>
        <div class="topbar-actions">
          <ng-container *ngIf="showPrepPicker; else planBtn">
            <app-searchable-select
              class="filter-select"
              [(ngModel)]="prepPickerCustomerId"
              (ngModelChange)="onPrepCustomerSelected($event)"
              [options]="prepPickerOptions"
              [placeholder]="'meetingsOverview.selectCustomer' | t"
            ></app-searchable-select>
            <button type="button" class="ghost-action" (click)="showPrepPicker = false; prepPickerCustomerId = ''">{{ 'common.cancel' | t }}</button>
          </ng-container>
          <ng-template #planBtn>
            <button type="button" class="ghost-action" (click)="showPrepPicker = true">{{ 'meetingsOverview.planMeeting' | t }}</button>
          </ng-template>
          <button type="button" class="primary-action" (click)="newMeeting()">
            + {{ 'meetingsOverview.newMeeting' | t }}
          </button>
        </div>
      </div>

      <section class="panel">
        <div class="panel-header">
          <div>
            <span class="eyebrow">{{ 'meetingsOverview.filters' | t }}</span>
            <h3>{{ 'meetingsOverview.allMeetings' | t }}</h3>
          </div>
          <div class="topbar-actions">
            <app-searchable-select
              [(ngModel)]="customerFilter"
              [options]="customerFilterOptions"
              class="filter-select"
            ></app-searchable-select>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card">
            <span class="eyebrow">{{ 'meetingsOverview.upcoming' | t }}</span>
            <strong>{{ getLane('upcoming').length }}</strong>
          </div>
          <div class="kpi-card">
            <span class="eyebrow">{{ 'meetingsOverview.inProgress' | t }}</span>
            <strong>{{ getLane('in-progress').length }}</strong>
          </div>
          <div class="kpi-card">
            <span class="eyebrow">{{ 'meetingsOverview.openMeetingTasks' | t }}</span>
            <strong>{{ openMeetingTasksCount }}</strong>
          </div>
        </div>
      </section>

      <section class="panel" *ngFor="let bucket of buckets">
        <div class="panel-header">
          <div>
            <span class="eyebrow">{{ ('meetingsOverview.' + bucket.lane) | t }}</span>
            <h3>{{ bucket.meetings.length }} {{ 'common.meeting' | t }}</h3>
          </div>
        </div>

        <div *ngIf="!bucket.meetings.length" class="empty-state lane-empty">
          <p>{{ 'meetingsOverview.noMeetingsInLane' | t }}</p>
          <button
            *ngIf="bucket.lane === 'upcoming'"
            type="button"
            class="primary-action"
            (click)="newMeeting()"
          >
            + {{ 'meetingsOverview.newMeeting' | t }}
          </button>
        </div>

        <div
          *ngFor="let m of bucket.meetings"
          class="meeting-row"
          (click)="openMeeting(m)"
        >
          <div class="meeting-row-main">
            <strong>{{ m.subject }}</strong>
            <span class="muted">{{ workspace.customer(m.customerId)?.name }}</span>
          </div>
          <div class="meeting-row-meta">
            <span class="muted">{{ m.meetingDate | slice:0:16 }}</span>
            <span class="status-chip" [ngClass]="workspace.statusClass(m.status)">
              {{ ('customerMeeting.statusValues.' + m.status) | t }}
            </span>
            <span class="muted">
              {{ tasksFromMeeting(m).length }} {{ 'common.task' | t }}
            </span>
          </div>
        </div>
      </section>
    </section>

    <!-- Editor sub-view: shows the existing customer meeting form -->
    <section class="screen" *ngIf="subView === 'editor'">
      <div class="screen-title">
        <div>
          <span class="eyebrow">{{ 'meetingsOverview.eyebrow' | t }}</span>
          <h2>{{ 'customerMeeting.title' | t }}</h2>
        </div>
        <div class="topbar-actions">
          <button type="button" class="ghost-action" (click)="backToOverview()">
            {{ 'meetingsOverview.backToList' | t }}
          </button>
        </div>
      </div>

      <app-customer-meeting-form
        [existingMeetingId]="editingMeetingId"
        (saved)="onMeetingSaved($event)"
        (cancelled)="backToOverview()"
      />
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .screen-subtitle { max-width: 680px; margin: 6px 0 0; color: var(--muted); }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      margin-top: 12px;
    }
    .kpi-card {
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface-strong);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .kpi-card strong { font-size: 28px; }
    .filter-select {
      min-width: 200px;
    }
    .meeting-row {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, auto);
      align-items: center;
      gap: 14px;
      padding: 12px;
      border-top: 1px solid var(--line);
      cursor: pointer;
    }
    .meeting-row:first-of-type { border-top: 0; }
    .meeting-row:hover { background: var(--surface-strong); }
    .meeting-row-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .meeting-row-main strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meeting-row-meta {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .muted { color: var(--muted); font-size: 13px; }
    .empty-state { padding: 1.5rem; text-align: center; color: var(--muted); }
    .lane-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 28px 20px;
      border: 1px dashed var(--border-subtle);
      border-radius: var(--radius-lg);
      background: var(--bg-canvas);
    }
    .lane-empty p { margin: 0; font-size: 13px; }
    .lane-empty .primary-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    @media (max-width: 720px) {
      .kpi-row { grid-template-columns: 1fr; }
      .meeting-row { grid-template-columns: 1fr; }
      .meeting-row-meta { justify-content: flex-start; }
    }
  `]
})
export class MeetingsComponent implements OnInit, OnChanges {
  @Input() openNewTick = 0;
  @Output() viewChange = new EventEmitter<ViewId>();
  @Output() prepareMeeting = new EventEmitter<Customer>();

  subView: MeetingsSubView = 'overview';
  customerFilter: 'all' | string = 'all';
  editingMeetingId: string | null = null;
  showPrepPicker = false;
  prepPickerCustomerId = '';

  constructor(public workspace: ActionosWorkspaceService, private i18n: ActionosI18nService) {}

  ngOnInit(): void {
    const id = this.workspace.pendingOpenMeetingId;
    if (id) {
      this.workspace.pendingOpenMeetingId = null;
      const meeting = this.workspace.customerMeetings.find(m => m.id === id);
      if (meeting) { this.openMeeting(meeting); }
    } else if (this.openNewTick > 0) {
      this.newMeeting();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['openNewTick'] && !changes['openNewTick'].firstChange) {
      this.newMeeting();
    }
  }

  get customerFilterOptions(): SelectOption[] {
    return [
      { value: 'all', label: this.i18n.translate('meetingsOverview.allCustomers') },
      ...this.workspace.customers.map(c => ({ value: c.id, label: c.name }))
    ];
  }

  get prepPickerOptions(): SelectOption[] {
    return this.workspace.customers.map(c => ({ value: c.id, label: c.name }));
  }

  get filteredMeetings(): CustomerMeeting[] {
    const all = this.workspace.customerMeetings;
    if (this.customerFilter === 'all') {
      return all;
    }
    return all.filter((m) => m.customerId === this.customerFilter);
  }

  get buckets(): LaneBucket[] {
    return [
      { lane: 'upcoming', labelKey: 'meetingsOverview.upcoming', meetings: this.getLane('upcoming') },
      { lane: 'in-progress', labelKey: 'meetingsOverview.inProgress', meetings: this.getLane('in-progress') },
      { lane: 'closed', labelKey: 'meetingsOverview.closed', meetings: this.getLane('closed') }
    ];
  }

  get openMeetingTasksCount(): number {
    return this.workspace.meetingTasks.filter((t) =>
      this.workspace.isOpenMeetingTaskStatus(t.status)
    ).length;
  }

  getLane(lane: MeetingLane): CustomerMeeting[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.filteredMeetings.filter((m) => this.assignLane(m, today) === lane);
  }

  tasksFromMeeting(m: CustomerMeeting) {
    return this.workspace.meetingTasksByMeeting(m.id);
  }

  onPrepCustomerSelected(customerId: string): void {
    const customer = this.workspace.customers.find(c => c.id === customerId);
    if (customer) {
      this.showPrepPicker = false;
      this.prepPickerCustomerId = '';
      this.prepareMeeting.emit(customer);
    }
  }

  newMeeting(): void {
    this.editingMeetingId = null;
    this.subView = 'editor';
  }

  openMeeting(m: CustomerMeeting): void {
    this.workspace.openMeetingDrawer(m.id);
  }

  onMeetingSaved(event: MeetingFormSavedEvent): void {
    this.editingMeetingId = event.meetingId;
    if (event.intent === 'close') {
      this.backToOverview();
    }
  }

  backToOverview(): void {
    this.subView = 'overview';
    this.editingMeetingId = null;
  }

  private assignLane(m: CustomerMeeting, today: string): MeetingLane {
    const meetingDay = m.meetingDate.slice(0, 10);
    const closedStatuses: CustomerMeetingStatus[] = ['Closed'];
    if (closedStatuses.includes(m.status)) {
      return 'closed';
    }
    if (meetingDay >= today) {
      return 'upcoming';
    }
    return 'in-progress';
  }
}
