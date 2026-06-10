import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CreateCustomerMeetingInput, Customer, CustomerMeeting, CustomerMeetingStatus, CustomerParticipant,
  MeetingNote, Task
} from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { findSimilarCustomers, SimilarCustomerMatch } from '../../core/utils/customer-name-match';
import { MeetingPrepBriefComponent } from './meeting-prep-brief.component';
import { MEETING_FORM_STYLES } from './meeting-form/meeting-form.styles';
import { ParticipantChip, ParticipantPickerComponent, ParticipantPickerOption } from './meeting-form/participant-picker.component';
import { MeetingNotesSectionComponent } from './meeting-form/meeting-notes-section.component';
import { MeetingSummaryDraft, MeetingSummarySectionComponent } from './meeting-form/meeting-summary-section.component';
import { MeetingTasksSectionComponent } from './meeting-form/meeting-tasks-section.component';

export type MeetingFormSaveIntent = 'continue' | 'close';

export interface MeetingFormSavedEvent {
  meetingId: string;
  intent: MeetingFormSaveIntent;
}

interface CustomerParticipantOption extends CustomerParticipant {
  key: string;
}

interface MeetingClientOption {
  id: string;
  name: string;
}

/**
 * Orchestrator for the customer meeting form.
 *
 * After the v4 simplification this component owns the meeting LIFECYCLE (draft
 * create / persist / save / close), the Plan/Settings section (the planning gate is
 * intentionally kept), the progress stepper, and the sticky action bar. The heavy
 * interior — note capture, wrap-up summary, and tasks — lives in focused child
 * components under `./meeting-form/`, and the two participant dropdowns are now a
 * single reusable `app-participant-picker`.
 */
@Component({
  selector: 'app-customer-meeting-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe, SearchableSelectComponent, MeetingPrepBriefComponent,
    ParticipantPickerComponent, MeetingNotesSectionComponent, MeetingSummarySectionComponent,
    MeetingTasksSectionComponent
  ],
  template: `
    <nav class="phase-stepper" aria-label="Meeting progress">
      <button type="button" class="phase-step active" (click)="scrollToId('plan-section')">
        <span class="phase-dot">1</span>
        <span class="phase-label">{{ 'customerMeeting.stepSettings' | t }}</span>
      </button>
      <span class="phase-line" [class.filled]="editing"></span>
      <button type="button" class="phase-step" [class.active]="editing" [disabled]="!editing" (click)="scrollToId('capture-section')">
        <span class="phase-dot">2</span>
        <span class="phase-label">{{ 'customerMeeting.stepCapture' | t }}</span>
      </button>
      <span class="phase-line" [class.filled]="meetingTasksForCurrentMeeting.length > 0"></span>
      <button type="button" class="phase-step" [class.active]="meetingTasksForCurrentMeeting.length > 0" [disabled]="!editing" (click)="scrollToId('tasks-section')">
        <span class="phase-dot">3</span>
        <span class="phase-label">{{ 'customerMeeting.stepTasks' | t }}</span>
      </button>
    </nav>

    <section class="panel" id="plan-section">
      <div class="panel-header">
        <div class="panel-header-lead">
          <button type="button" class="section-toggle" [class.collapsed]="collapsedSections.plan" (click)="toggleSection('plan')" aria-label="Toggle section">▾</button>
          <div>
            <span class="eyebrow">{{ selectedClientForPrep?.name || ('customerMeeting.customer' | t) }}</span>
            <h3>{{ 'customerMeeting.title' | t }}</h3>
          </div>
        </div>
        <span
          *ngIf="workspace.shouldShowMeetingStatus(currentStatus())"
          class="status-chip"
          [ngClass]="workspace.statusClass(currentStatus())"
        >
          {{ ('customerMeeting.statusValues.' + currentStatus()) | t }}
        </span>
      </div>

      <ng-container *ngIf="!collapsedSections.plan">
      <div class="section-head section-head-row">
        <div>
          <span class="eyebrow">{{ 'customerMeeting.planSection' | t }}</span>
          <h4>{{ 'customerMeeting.planSubtitle' | t }}</h4>
        </div>
        <button
          *ngIf="selectedClientForPrep as prepCustomer"
          type="button"
          class="ghost-action small"
          (click)="showPrepBrief = true"
        >
          📋 {{ 'meetingPrep.summaryFor' | t }} {{ prepCustomer.name }}
        </button>
      </div>

      <article class="meeting-setup-summary" *ngIf="setupCollapsed">
        <div class="summary-copy">
          <strong>{{ form.subject.trim() || ('customerMeeting.untitledMeeting' | t) }}</strong>
          <small>{{ setupSummaryLine }}</small>
        </div>
        <div class="topbar-actions">
          <span
            *ngIf="workspace.shouldShowMeetingStatus(currentStatus())"
            class="status-chip"
            [ngClass]="workspace.statusClass(currentStatus())"
          >
            {{ ('customerMeeting.statusValues.' + currentStatus()) | t }}
          </span>
          <button type="button" class="ghost-action" (click)="setupCollapsed = false">
            {{ 'customerMeeting.expandSetup' | t }}
          </button>
        </div>
      </article>

      <div *ngIf="!setupCollapsed">
        <div class="form-grid">
          <div class="field-control wide" *ngIf="!startedWithCustomer && !pickedCustomerId">
              {{ 'customerMeeting.customer' | t }}
              <app-searchable-select
                name="formCustomer"
                [(ngModel)]="pickedCustomerId"
                (ngModelChange)="onProspectOrCustomerPicked()"
                [options]="customerSelectOptions"
                [crossLanguageMatch]="true"
                [createNewLabel]="'+ ' + ('customers.addNewProspect' | t)"
                (createNew)="showProspectForm = true"
              ></app-searchable-select>

              <div class="prospect-form" *ngIf="showProspectForm" (click)="$event.stopPropagation()">
                <strong class="prospect-form-title">{{ 'customers.newProspectTitle' | t }}</strong>
                <input
                  type="text"
                  name="prospectName"
                  [(ngModel)]="newProspect.name"
                  [placeholder]="'customers.prospectNamePlaceholder' | t"
                  (click)="$event.stopPropagation()"
                />

                <div class="dup-warning" *ngIf="prospectDuplicateMatches.length">
                  <strong class="dup-warning-title">⚠ {{ 'customers.possibleDuplicateTitle' | t }}</strong>
                  <p class="dup-warning-text">{{ 'customers.possibleDuplicateText' | t }}</p>
                  <ul class="dup-warning-list">
                    <li *ngFor="let match of prospectDuplicateMatches">
                      <button type="button" class="dup-match" (click)="useExistingCustomer(match.customer)">
                        <span class="dup-match-name">{{ match.customer.name }}</span>
                        <small>{{ ('customerType.' + match.customer.type) | t }}</small>
                      </button>
                    </li>
                  </ul>
                </div>
                <input
                  type="text"
                  name="prospectContactName"
                  [(ngModel)]="newProspect.contactName"
                  [placeholder]="'customers.prospectContactNamePlaceholder' | t"
                  (click)="$event.stopPropagation()"
                />
                <input
                  type="email"
                  name="prospectContactEmail"
                  [(ngModel)]="newProspect.contactEmail"
                  [placeholder]="'customers.prospectContactEmailPlaceholder' | t"
                  (click)="$event.stopPropagation()"
                />
                <input
                  type="tel"
                  name="prospectContactPhone"
                  [(ngModel)]="newProspect.contactPhone"
                  [placeholder]="'customers.prospectContactPhonePlaceholder' | t"
                  (click)="$event.stopPropagation()"
                />
                <div class="prospect-form-actions">
                  <button
                    type="button"
                    class="primary-action"
                    [class.warn-action]="prospectDuplicateMatches.length"
                    [disabled]="!canAddProspect()"
                    (click)="addProspect()"
                  >
                    {{ (prospectDuplicateMatches.length ? 'customers.addAnyway' : 'customers.addAndSelect') | t }}
                  </button>
                  <button type="button" class="ghost-action" (click)="cancelProspectForm()">
                    {{ 'common.cancel' | t }}
                  </button>
                </div>
              </div>
            </div>

            <ng-container *ngIf="showPlanFields">
            <label class="field-control">
              {{ 'customerMeeting.subject' | t }}
              <input
                type="text"
                name="subject"
                [(ngModel)]="form.subject"
                (ngModelChange)="onPlanChanged()"
                [placeholder]="'customerMeeting.subjectPlaceholder' | t"
              />
            </label>

            <label class="field-control">
              {{ 'customerMeeting.meetingDate' | t }}
              <input
                type="datetime-local"
                name="meetingDate"
                [(ngModel)]="meetingDateLocal"
                (ngModelChange)="onPlanChanged()"
              />
            </label>

            <div class="dropdowns-row">
            <div class="field-control">
              {{ 'customerMeeting.internalParticipants' | t }}
              <app-participant-picker
                name="internalParticipants"
                [placeholder]="'customerMeeting.selectInternalParticipants' | t"
                [searchPlaceholder]="'customerMeeting.searchParticipants' | t"
                [emptyText]="'home.noMatches' | t"
                [options]="internalPickerOptions"
                [selectedKeys]="form.internalParticipantEmployeeIds"
                [chips]="internalChips"
                (toggle)="toggleInternal($event)"
                (remove)="toggleInternal($event)"
              ></app-participant-picker>
            </div>

            <div class="field-control">
              {{ 'customerMeeting.customerParticipants' | t }}
              <app-participant-picker
                name="customerParticipants"
                [placeholder]="'customerMeeting.selectCustomerParticipants' | t"
                [searchPlaceholder]="'customerMeeting.searchParticipants' | t"
                [emptyText]="'home.noMatches' | t"
                [options]="customerPickerOptions"
                [selectedKeys]="customerSelectedKeys"
                [chips]="customerChips"
                (toggle)="toggleCustomerParticipantByKey($event)"
                (remove)="removeCustomerParticipantByKey($event)"
              >
                <button
                  type="button"
                  class="ghost-action small add-participant-toggle"
                  (click)="showAddParticipantRow = !showAddParticipantRow"
                >
                  {{ showAddParticipantRow ? ('common.cancel' | t) : ('+ ' + ('customerMeeting.addParticipant' | t)) }}
                </button>

                <div class="customer-add-row" *ngIf="showAddParticipantRow">
                  <input
                    type="text"
                    name="customParticipantName"
                    [(ngModel)]="customCustomerParticipant.name"
                    [placeholder]="'customerMeeting.participantName' | t"
                  />
                  <input
                    type="email"
                    name="customParticipantEmail"
                    [(ngModel)]="customCustomerParticipant.email"
                    [placeholder]="'customerMeeting.participantEmail' | t"
                  />
                  <input
                    type="tel"
                    name="customParticipantPhone"
                    [(ngModel)]="customCustomerParticipant.phone"
                    [placeholder]="'customerMeeting.participantPhone' | t"
                  />
                  <input
                    type="text"
                    name="customParticipantRole"
                    [(ngModel)]="customCustomerParticipant.role"
                    [placeholder]="'customerMeeting.participantRole' | t"
                  />
                  <button
                    type="button"
                    class="primary-action small"
                    [disabled]="!canAddCustomCustomerParticipant()"
                    (click)="addCustomCustomerParticipant()"
                  >
                    + {{ 'customerMeeting.addParticipant' | t }}
                  </button>
                </div>
              </app-participant-picker>
            </div>
            </div>
            </ng-container>
          </div>
      </div>

      <div class="plan-bottom-action" *ngIf="!setupCollapsed && showPlanFields">
        <button
          type="button"
          class="primary-action"
          [class.start-ready]="!editing && canStartMeeting()"
          [disabled]="!canStartMeeting()"
          (click)="startOrCollapseSetup()"
        >
          {{ editing ? ('customerMeeting.collapseSetup' | t) : ('customerMeeting.startMeeting' | t) }}
        </button>
      </div>
      </ng-container>
    </section>

    <section class="panel work-panel" id="capture-section">
      <div class="panel-header work-header">
        <div class="panel-header-lead">
          <button type="button" class="section-toggle" [class.collapsed]="collapsedSections.capture" (click)="toggleSection('capture')" aria-label="Toggle section">▾</button>
          <div>
            <span class="eyebrow">{{ 'customerMeeting.captureSection' | t }}</span>
            <h3>{{ 'meetings.addMeetingOutput' | t }}</h3>
            <small class="muted">
              {{ (captureTab === 'notes' ? 'customerMeeting.notesTabHint' : 'customerMeeting.summaryTabHint') | t }}
            </small>
          </div>
        </div>
        <div class="tab-toggle" *ngIf="editingMeeting && !collapsedSections.capture" role="tablist">
          <button
            type="button"
            class="tab-btn"
            role="tab"
            [class.active]="captureTab === 'notes'"
            (click)="captureTab = 'notes'"
          >
            {{ 'customerMeeting.tabNotes' | t }}
            <span class="tab-count" *ngIf="capturedNotesCount">{{ capturedNotesCount }}</span>
          </button>
          <button
            type="button"
            class="tab-btn"
            role="tab"
            [class.active]="captureTab === 'summary'"
            (click)="captureTab = 'summary'"
          >
            {{ 'customerMeeting.tabSummary' | t }}
          </button>
        </div>
      </div>

      <ng-container *ngIf="!collapsedSections.capture">
      <ng-container *ngIf="editingMeeting as meeting; else runLocked">
        <div class="capture-tab" *ngIf="captureTab === 'notes'">
          <app-meeting-notes-section
            [meeting]="meeting"
            [nextMeetingNotes]="nextMeetingNotesText"
            (nextMeetingNotesChange)="onNextMeetingNotesChanged($event)"
            (changed)="reloadMeeting()"
            (createTaskFromNote)="onCreateTaskFromNote($event)"
          ></app-meeting-notes-section>
        </div>

        <div class="capture-tab summary-tab" *ngIf="captureTab === 'summary'">
          <app-meeting-summary-section
            [meeting]="meeting"
            [draft]="summaryDraft"
            [recap]="lastRecap"
            (changed)="onSummaryChanged()"
            (publish)="publishRecap()"
            (goToNotes)="goToNotes()"
            (goToTasks)="scrollToId('tasks-section')"
          ></app-meeting-summary-section>
        </div>
      </ng-container>

      <ng-template #runLocked>
        <div class="empty-state compact-empty">
          <strong>{{ 'customerMeeting.completePlanToStart' | t }}</strong>
        </div>
      </ng-template>
      </ng-container>
    </section>

    <section class="panel" id="tasks-section">
      <div class="panel-header">
        <div class="panel-header-lead">
          <button type="button" class="section-toggle" [class.collapsed]="collapsedSections.tasks" (click)="toggleSection('tasks')" aria-label="Toggle section">▾</button>
          <div>
            <span class="eyebrow">{{ 'customerMeeting.assignTasks' | t }}</span>
            <h3>{{ meetingTasksForCurrentMeeting.length }} {{ 'customerMeeting.tasksLabel' | t }}</h3>
            <small class="muted">{{ 'customerMeeting.assignTasksSubtitle' | t }}</small>
          </div>
        </div>
      </div>

      <ng-container *ngIf="!collapsedSections.tasks">
      <ng-container *ngIf="editingMeeting as meeting; else tasksLocked">
        <app-meeting-tasks-section
          [meeting]="meeting"
          [creatingTaskForNote]="creatingTaskForNote"
          (taskCreated)="onTaskCreated()"
          (cancelCreate)="creatingTaskForNote = null"
        ></app-meeting-tasks-section>
      </ng-container>

      <ng-template #tasksLocked>
        <div class="empty-state compact-empty">
          <strong>{{ 'customerMeeting.completePlanToStart' | t }}</strong>
        </div>
      </ng-template>
      </ng-container>
    </section>

    <!-- The form auto-saves on every change, so there's no draft/save action —
         just one button to finish and close the drawer. -->
    <div class="action-bar">
      <span class="action-bar-spacer"></span>
      <button type="button" class="primary-action" (click)="finish()">
        {{ 'customerMeeting.finish' | t }}
      </button>
    </div>

    <div
      class="modal-backdrop"
      *ngIf="showPrepBrief && selectedClientForPrep as prepCustomer"
      role="presentation"
      (click)="showPrepBrief = false"
    >
      <aside class="modal-card prep-modal-card" role="dialog" aria-label="Meeting summary" (click)="$event.stopPropagation()">
        <header class="modal-header">
          <div>
            <span class="eyebrow">{{ 'customerMeeting.planSection' | t }}</span>
            <h2>{{ 'meetingPrep.summaryFor' | t }} {{ prepCustomer.name }}</h2>
          </div>
          <button type="button" class="ghost-action" (click)="showPrepBrief = false">
            {{ 'common.close' | t }}
          </button>
        </header>
        <app-meeting-prep-brief
          variant="full"
          [customerId]="prepCustomer.id"
          [currentMeetingId]="editingMeeting?.id ?? null"
        ></app-meeting-prep-brief>
      </aside>
    </div>
  `,
  styles: [MEETING_FORM_STYLES, `
    .section-head-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    /* Per-section collapse toggle in each panel header. */
    .panel-header-lead {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .section-toggle {
      flex-shrink: 0;
      border: 0;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: 13px;
      line-height: 1;
      padding: 4px;
      border-radius: 6px;
      transition: transform 150ms ease, background 150ms ease;
    }
    .section-toggle:hover { background: var(--bg-hover, var(--surface-strong)); }
    .section-toggle.collapsed { transform: rotate(-90deg); }
    /* Our-side + their-side participant dropdowns share one row. The meeting
       leader is resolved to the current user automatically, so it has no field. */
    .dropdowns-row {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      align-items: start;
    }
    @media (max-width: 720px) {
      .dropdowns-row { grid-template-columns: 1fr; }
    }
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
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .prep-modal-card { max-width: 560px; }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
    }
    .modal-header h2 { margin: 4px 0 0; font-size: 20px; }
  `]
})
export class CustomerMeetingFormComponent implements OnInit, OnChanges {
  /**
   * Optional. When provided, the customer is fixed (no picker shown - used from
   * Customer 360 -> New meeting). When omitted, a picker is shown inside the
   * form (used from the Meetings tab -> New meeting).
   */
  @Input() customer: Customer | null = null;
  @Input() initialCustomerId: string | null = null;
  @Input() existingMeetingId: string | null = null;
  @Output() saved = new EventEmitter<MeetingFormSavedEvent>();
  @Output() cancelled = new EventEmitter<void>();

  form!: CreateCustomerMeetingInput & {
    customerParticipants: CustomerParticipant[];
    internalParticipantEmployeeIds: string[];
  };
  pickedCustomerId = '';
  meetingDateLocal = '';
  summaryDraft: MeetingSummaryDraft = { summary: '' };
  /** Notes for the next meeting — edited in the Notes tab, persisted with the meeting. */
  nextMeetingNotesText = '';

  customCustomerParticipant: CustomerParticipant = { name: '', email: '', phone: '', role: '' };
  private customParticipantPool: CustomerParticipantOption[] = [];
  showProspectForm = false;
  newProspect = { name: '', contactName: '', contactEmail: '', contactPhone: '' };
  setupCollapsed = false;
  showAddParticipantRow = false;
  showPrepBrief = false;
  /** Per-section collapse state for the drawer (each panel can fold to its header). */
  collapsedSections: { plan: boolean; capture: boolean; tasks: boolean } = {
    plan: false,
    capture: false,
    tasks: false
  };
  /**
   * True when the form opened with a customer already decided (Customer 360 entry,
   * or editing an existing meeting). When false (new meeting from the FAB/Meetings),
   * the form shows ONLY the client picker first and reveals the rest of the settings
   * once a client is chosen. Tracked separately from `customer` because `customer`
   * gets set internally when the draft is created — we must not let the picker vanish
   * mid-edit (that caused the layout to jump).
   */
  startedWithCustomer = false;

  editing = false;
  editingMeeting: CustomerMeeting | null = null;
  creatingTaskForNote: MeetingNote | null = null;
  lastRecap = '';
  captureTab: 'notes' | 'summary' = 'summary';

  @ViewChild(MeetingNotesSectionComponent) notesSection?: MeetingNotesSectionComponent;

  constructor(
    public workspace: ActionosWorkspaceService,
    private i18n: ActionosI18nService
  ) {}

  // ── Derived option lists ──────────────────────────────────────────────────

  get customerSelectOptions(): SelectOption[] {
    return [
      { value: '', label: this.i18n.translate('customerMeeting.selectCustomer') },
      ...this.workspace.clientOptions.map((c) => ({ value: c.id, label: c.name }))
    ];
  }

  get internalPickerOptions(): ParticipantPickerOption[] {
    return this.workspace.employees.map((e) => ({ key: e.id, label: e.fullName }));
  }

  get internalChips(): ParticipantChip[] {
    return this.form.internalParticipantEmployeeIds.map((id) => ({
      key: id,
      label: this.workspace.employee(id)?.fullName ?? ''
    }));
  }

  get customerPickerOptions(): ParticipantPickerOption[] {
    return this.customerParticipantOptions().map((p) => ({
      key: p.key,
      label: p.name,
      sublabel: [p.email ? `- ${p.email}` : '', p.phone ? `· ${p.phone}` : '']
        .filter(Boolean)
        .join(' ')
    }));
  }

  get customerSelectedKeys(): string[] {
    return this.form.customerParticipants.map((p) => this.customerParticipantKey(p));
  }

  get customerChips(): ParticipantChip[] {
    return this.form.customerParticipants.map((p) => ({
      key: this.customerParticipantKey(p),
      label: p.name
    }));
  }

  // ── Stepper / tab helpers ──────────────────────────────────────────────────

  get setupSummaryLine(): string {
    const customerName = this.selectedClientForPrep?.name ?? 'No customer';
    const when = this.meetingDateLocal ? this.meetingDateLocal.replace('T', ' ') : 'No date';
    const participants = this.form.internalParticipantEmployeeIds.length + this.form.customerParticipants.length;
    return `${customerName} · ${when} · ${participants} participants`;
  }

  get capturedNotesCount(): number {
    return this.editingMeeting?.notes.length ?? 0;
  }

  get meetingTasksForCurrentMeeting(): Task[] {
    if (!this.editingMeeting) {
      return [];
    }
    return this.workspace.meetingTasksByMeeting(this.editingMeeting.id);
  }

  /** Reveal subject/date/leader/participants only once a client is chosen. */
  get showPlanFields(): boolean {
    return this.startedWithCustomer || !!this.pickedCustomerId;
  }

  get selectedCustomerForPrep(): Customer | null {
    if (this.customer) {
      return this.customer;
    }
    if (!this.pickedCustomerId) {
      return null;
    }
    return this.workspace.customer(this.pickedCustomerId) ?? null;
  }

  get selectedClientForPrep(): MeetingClientOption | null {
    const id = this.customer?.id || this.pickedCustomerId || this.initialCustomerId || '';
    if (!id) {
      return null;
    }
    return { id, name: this.workspace.clientName(id) ?? id };
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['existingMeetingId'] && !changes['existingMeetingId'].firstChange) {
      this.initializeForm();
      return;
    }

    if (changes['customer'] && this.form && !this.editing && this.customer) {
      this.form.customerId = this.customer.id;
      this.pickedCustomerId = this.customer.id;
      this.startedWithCustomer = true;
    }

    if (
      changes['initialCustomerId'] &&
      this.form &&
      !this.editing &&
      !this.customer &&
      this.initialCustomerId
    ) {
      this.form.customerId = this.initialCustomerId;
      this.pickedCustomerId = this.initialCustomerId;
      this.startedWithCustomer = true;
    }
  }

  currentStatus(): CustomerMeetingStatus {
    return this.editingMeeting?.status ?? 'Planned';
  }

  scrollToId(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleSection(key: 'plan' | 'capture' | 'tasks'): void {
    this.collapsedSections[key] = !this.collapsedSections[key];
  }

  goToNotes(): void {
    this.captureTab = 'notes';
    setTimeout(() => document.getElementById('notes-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  // ── Finish / start ─────────────────────────────────────────────────────────────

  canStartMeeting(): boolean {
    return this.canCreateDraft();
  }

  startOrCollapseSetup(): void {
    if (!this.editing) {
      const updated = this.persistMeeting(true);
      if (!updated) {
        return;
      }
      this.setupCollapsed = true;
      this.captureTab = 'notes';
      this.notesSection?.focusComposer();
    } else {
      this.setupCollapsed = true;
    }
  }

  /**
   * Finish editing and close the drawer. The form already auto-saves on every change,
   * so this just flushes any last edit and emits `saved` (intent 'close'); publishing the
   * recap is a separate, explicit action in the Summary tab. If no draft was ever created
   * (incomplete form), there's nothing to save — just close.
   */
  finish(): void {
    if (this.editingMeeting) {
      const updated = this.persistMeeting(false) ?? this.editingMeeting;
      this.saved.emit({ meetingId: updated.id, intent: 'close' });
    } else {
      this.cancelled.emit();
    }
  }

  // ── Plan field changes ───────────────────────────────────────────────────────

  onPlanChanged(): void {
    if (!this.editingMeeting) {
      this.tryCreateDraftMeeting();
    }
    if (this.editingMeeting) {
      this.persistMeeting(false);
    }
  }

  onSummaryChanged(): void {
    if (this.editingMeeting) {
      this.persistMeeting(false);
    }
  }

  onNextMeetingNotesChanged(value: string): void {
    this.nextMeetingNotesText = value;
    if (this.editingMeeting) {
      this.persistMeeting(false);
    }
  }

  onProspectOrCustomerPicked(): void {
    this.showProspectForm = false;
    this.onPlanChanged();
  }

  // ── Prospect creation ────────────────────────────────────────────────────────

  canAddProspect(): boolean {
    return !!this.newProspect.name.trim();
  }

  /** Existing customers that look like the prospect name being typed (incl. cross-language). */
  get prospectDuplicateMatches(): SimilarCustomerMatch<Customer>[] {
    return findSimilarCustomers(this.newProspect.name, this.workspace.customers);
  }

  /** Selects an existing customer instead of creating a duplicate prospect. */
  useExistingCustomer(customer: Customer): void {
    this.pickedCustomerId = customer.id;
    this.cancelProspectForm();
    this.onProspectOrCustomerPicked();
  }

  addProspect(): void {
    if (!this.canAddProspect()) {
      return;
    }
    const created = this.workspace.addCustomer({
      name: this.newProspect.name.trim(),
      type: 'Prospect',
      primaryContactName: this.newProspect.contactName.trim() || undefined,
      primaryContactEmail: this.newProspect.contactEmail.trim() || undefined,
      primaryContactPhone: this.newProspect.contactPhone.trim() || undefined
    });
    if (!created) {
      return;
    }
    this.pickedCustomerId = created.id;
    this.cancelProspectForm();
    this.onPlanChanged();
  }

  cancelProspectForm(): void {
    this.showProspectForm = false;
    this.newProspect = { name: '', contactName: '', contactEmail: '', contactPhone: '' };
  }

  // ── Participants ───────────────────────────────────────────────────────────────

  toggleInternal(id: string): void {
    const list = this.form.internalParticipantEmployeeIds;
    const index = list.indexOf(id);
    if (index === -1) {
      list.push(id);
    } else {
      list.splice(index, 1);
    }
    this.onPlanChanged();
  }

  toggleCustomerParticipantByKey(key: string): void {
    const idx = this.form.customerParticipants.findIndex((p) => this.customerParticipantKey(p) === key);
    if (idx === -1) {
      const option = this.customerParticipantOptions().find((o) => o.key === key);
      if (option) {
        this.form.customerParticipants.push({
          name: option.name,
          email: option.email,
          role: option.role
        });
      }
    } else {
      this.form.customerParticipants.splice(idx, 1);
    }
    this.onPlanChanged();
  }

  removeCustomerParticipantByKey(key: string): void {
    const idx = this.form.customerParticipants.findIndex((p) => this.customerParticipantKey(p) === key);
    if (idx !== -1) {
      this.form.customerParticipants.splice(idx, 1);
      this.onPlanChanged();
    }
  }

  canAddCustomCustomerParticipant(): boolean {
    return !!this.customCustomerParticipant.name?.trim();
  }

  addCustomCustomerParticipant(): void {
    if (!this.canAddCustomCustomerParticipant()) {
      return;
    }
    const participant: CustomerParticipant = {
      name: this.customCustomerParticipant.name.trim(),
      email: this.customCustomerParticipant.email?.trim() || undefined,
      phone: this.customCustomerParticipant.phone?.trim() || undefined,
      role: this.customCustomerParticipant.role?.trim() || undefined
    };
    const key = this.customerParticipantKey(participant);
    if (!this.form.customerParticipants.some((p) => this.customerParticipantKey(p) === key)) {
      this.form.customerParticipants.push(participant);
    }
    if (!this.customParticipantPool.some((p) => p.key === key)) {
      this.customParticipantPool.push({ ...participant, key });
    }
    this.customCustomerParticipant = { name: '', email: '', phone: '', role: '' };
    this.showAddParticipantRow = false;
    this.onPlanChanged();
  }

  // ── Tasks / recap from children ──────────────────────────────────────────────

  onCreateTaskFromNote(note: MeetingNote): void {
    this.creatingTaskForNote = note;
    setTimeout(() => this.scrollToId('tasks-section'), 0);
  }

  onTaskCreated(): void {
    this.creatingTaskForNote = null;
    this.reloadMeeting();
    this.notesSection?.focusComposer();
  }

  publishRecap(): void {
    if (!this.editingMeeting) {
      return;
    }
    const recap = this.workspace.publishMeetingRecap(this.editingMeeting.id);
    if (recap !== null) {
      this.lastRecap = recap;
      this.reloadMeeting();
    }
  }

  reloadMeeting(): void {
    if (this.editingMeeting) {
      this.editingMeeting = this.workspace.customerMeeting(this.editingMeeting.id) ?? this.editingMeeting;
    }
  }

  // ── Form init / load / persist ──────────────────────────────────────────────

  private initializeForm(): void {
    this.form = this.emptyForm();
    const now = new Date();
    now.setMinutes(0, 0, 0);
    this.meetingDateLocal = this.toLocalInput(now);
    this.summaryDraft = { summary: '' };
    this.nextMeetingNotesText = '';
    this.captureTab = 'summary';
    this.lastRecap = '';
    this.setupCollapsed = false;
    this.creatingTaskForNote = null;
    this.editing = false;
    this.editingMeeting = null;
    this.customCustomerParticipant = { name: '', email: '', phone: '', role: '' };
    this.customParticipantPool = [];
    this.showProspectForm = false;
    this.showAddParticipantRow = false;
    this.showPrepBrief = false;
    this.newProspect = { name: '', contactName: '', contactEmail: '', contactPhone: '' };
    this.pickedCustomerId = this.customer?.id ?? this.initialCustomerId ?? '';
    this.startedWithCustomer = !!(this.customer || this.initialCustomerId);

    if (this.existingMeetingId) {
      this.loadExistingMeeting(this.existingMeetingId);
      this.startedWithCustomer = true;
    } else {
      // New meeting: honor a slot the user clicked in the calendar, then clear it
      // so the next "New meeting" opened normally falls back to "now".
      if (this.workspace.pendingNewMeetingDate) {
        this.meetingDateLocal = this.toLocalInput(new Date(this.workspace.pendingNewMeetingDate));
        this.workspace.pendingNewMeetingDate = null;
      }
      if (this.customer) {
        this.form.customerId = this.customer.id;
      } else if (this.initialCustomerId) {
        this.form.customerId = this.initialCustomerId;
      }
    }
  }

  private canCreateDraft(): boolean {
    const customerId = this.resolveCustomerId();
    return !!this.form.subject.trim() && !!customerId && !!this.meetingDateLocal;
  }

  private resolveCustomerId(): string {
    return this.customer?.id || this.pickedCustomerId || this.initialCustomerId || '';
  }

  private tryCreateDraftMeeting(): CustomerMeeting | null {
    if (this.editingMeeting || !this.canCreateDraft()) {
      return this.editingMeeting;
    }

    const customerId = this.resolveCustomerId();
    if (!customerId) {
      return null;
    }

    const created = this.workspace.addCustomerMeeting({
      customerId,
      subject: this.form.subject,
      meetingDate: this.fromLocalInput(this.meetingDateLocal),
      meetingLeaderEmployeeId: this.form.meetingLeaderEmployeeId || this.workspace.currentEmployeeId,
      internalParticipantEmployeeIds: this.form.internalParticipantEmployeeIds,
      customerParticipants: this.form.customerParticipants.filter((p) => p.name.trim()),
      goal: this.form.goal
    });

    this.editing = true;
    this.editingMeeting = this.workspace.customerMeeting(created.id) ?? created;
    if (!this.customer) {
      this.customer = this.workspace.customer(customerId) ?? null;
    }
    this.form.customerId = customerId;

    return this.editingMeeting;
  }

  private persistMeeting(createIfNeeded: boolean): CustomerMeeting | null {
    if (!this.editingMeeting && createIfNeeded) {
      this.tryCreateDraftMeeting();
    }
    if (!this.editingMeeting) {
      return null;
    }

    const updated = this.workspace.updateCustomerMeetingSummary(this.editingMeeting.id, {
      subject: this.form.subject,
      meetingDate: this.fromLocalInput(this.meetingDateLocal),
      meetingLeaderEmployeeId: this.form.meetingLeaderEmployeeId || this.workspace.currentEmployeeId,
      internalParticipantEmployeeIds: this.form.internalParticipantEmployeeIds,
      customerParticipants: this.form.customerParticipants.filter((p) => p.name.trim()),
      goal: this.form.goal,
      summary: this.summaryDraft.summary,
      nextMeetingNotes: this.nextMeetingNotesText || undefined
    });

    if (!updated) {
      return null;
    }
    this.editing = true;
    this.editingMeeting = updated;
    return updated;
  }

  private loadExistingMeeting(meetingId: string): void {
    const meeting = this.workspace.customerMeeting(meetingId);
    if (!meeting) {
      return;
    }
    this.editing = true;
    this.editingMeeting = meeting;
    this.customer = this.workspace.customer(meeting.customerId) ?? this.customer;
    this.form = {
      customerId: meeting.customerId,
      subject: meeting.subject,
      meetingDate: meeting.meetingDate,
      meetingLeaderEmployeeId: meeting.meetingLeaderEmployeeId,
      internalParticipantEmployeeIds: [...meeting.internalParticipantEmployeeIds],
      customerParticipants: meeting.customerParticipants.map((p) => ({ ...p })),
      goal: meeting.goal ?? ''
    };
    this.pickedCustomerId = meeting.customerId;
    this.summaryDraft = { summary: meeting.summary ?? '' };
    this.nextMeetingNotesText = meeting.nextMeetingNotes ?? '';
    this.meetingDateLocal = this.toLocalInput(new Date(meeting.meetingDate));
    // Existing meetings open with the settings collapsed by default — the user is
    // here to capture/review, not re-edit the setup. They can expand it if needed.
    this.setupCollapsed = true;
    if (meeting.publishedRecap) {
      this.lastRecap = meeting.publishedRecap;
    }
    this.customParticipantPool = meeting.customerParticipants
      .filter((p) => p.name?.trim())
      .map((p) => ({
        name: p.name.trim(),
        email: p.email?.trim() || undefined,
        phone: p.phone?.trim() || undefined,
        role: p.role?.trim() || undefined,
        key: this.customerParticipantKey(p)
      }));
  }

  private customerParticipantOptions(): CustomerParticipantOption[] {
    const byKey = new Map<string, CustomerParticipantOption>();
    const customer = this.selectedCustomerForPrep;
    const client = this.selectedClientForPrep;
    if (customer?.primaryContactName?.trim()) {
      const seed: CustomerParticipant = {
        name: customer.primaryContactName.trim(),
        email: customer.primaryContactEmail?.trim() || undefined,
        role: undefined
      };
      byKey.set(this.customerParticipantKey(seed), { ...seed, key: this.customerParticipantKey(seed) });
    }

    if (client) {
      for (const meeting of this.workspace.customerMeetingsByCustomer(client.id)) {
        for (const participant of meeting.customerParticipants) {
          if (!participant.name?.trim()) {
            continue;
          }
          const item: CustomerParticipant = {
            name: participant.name.trim(),
            email: participant.email?.trim() || undefined,
            phone: participant.phone?.trim() || undefined,
            role: participant.role?.trim() || undefined
          };
          byKey.set(this.customerParticipantKey(item), { ...item, key: this.customerParticipantKey(item) });
        }
      }
    }

    for (const poolEntry of this.customParticipantPool) {
      byKey.set(poolEntry.key, poolEntry);
    }

    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private customerParticipantKey(participant: CustomerParticipant): string {
    const name = participant.name.trim().toLowerCase();
    const email = (participant.email ?? '').trim().toLowerCase();
    return `${name}|${email}`;
  }

  private emptyForm() {
    // The meeting leader is always the current user (no field shown), and that
    // user is also pre-selected on our side so they don't have to add themselves.
    const me = this.workspace?.currentEmployeeId ?? '';
    return {
      customerId: this.customer?.id ?? '',
      subject: '',
      meetingDate: new Date().toISOString(),
      meetingLeaderEmployeeId: me,
      internalParticipantEmployeeIds: me ? [me] : [],
      customerParticipants: [] as CustomerParticipant[],
      goal: ''
    };
  }

  private toLocalInput(date: Date): string {
    const pad = (n: number): string => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private fromLocalInput(value: string): string {
    if (!value) {
      return '';
    }
    return new Date(value).toISOString();
  }
}
