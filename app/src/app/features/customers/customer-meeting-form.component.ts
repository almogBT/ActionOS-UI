import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  Attachment, CreateCustomerMeetingInput, CreateMeetingNoteInput, Customer, CustomerMeeting, CustomerMeetingStatus, CustomerParticipant, Employee, MeetingNote, NoteType, ProgressionNote, Task, UpdateMeetingNoteInput } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import { findSimilarCustomers, SimilarCustomerMatch } from '../../core/utils/customer-name-match';
import { MeetingTaskCreationComponent } from './meeting-task-creation.component';
import { MeetingPrepBriefComponent } from './meeting-prep-brief.component';
import { NoteDetailModalComponent } from './note-detail-modal.component';

export type MeetingFormSaveIntent = 'continue' | 'close';

export interface MeetingFormSavedEvent {
  meetingId: string;
  intent: MeetingFormSaveIntent;
}

interface CustomerParticipantOption extends CustomerParticipant {
  key: string;
}

type MeetingTaskFilter = 'open' | 'blocked' | 'done' | 'all';

@Component({
  selector: 'app-customer-meeting-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SearchableSelectComponent, MeetingTaskCreationComponent, MeetingPrepBriefComponent, NoteDetailModalComponent],
  template: `
    <section class="panel" id="plan-section">
      <div class="panel-header">
        <div>
          <span class="eyebrow">{{ customer ? customer.name : ('customerMeeting.customer' | t) }}</span>
          <h3>{{ 'customerMeeting.title' | t }}</h3>
        </div>
        <div class="topbar-actions">
          <button type="button" class="ghost-action" (click)="cancelled.emit()">
            {{ 'common.cancel' | t }}
          </button>
          <button
            type="button"
            class="ghost-action"
            [disabled]="!canSave()"
            (click)="save('continue')"
          >
            {{ 'customerMeeting.saveAndContinue' | t }}
          </button>
          <button
            type="button"
            class="primary-action"
            [disabled]="!canSave()"
            (click)="save('close')"
          >
            {{ 'customerMeeting.saveAndClose' | t }}
          </button>
        </div>
      </div>


<div class="section-head">
        <span class="eyebrow">{{ 'customerMeeting.planSection' | t }}</span>
        <h4>{{ 'customerMeeting.planSubtitle' | t }}</h4>
      </div>

      <article class="meeting-setup-summary" *ngIf="setupCollapsed">
        <div class="summary-copy">
          <strong>{{ form.subject.trim() || ('customerMeeting.untitledMeeting' | t) }}</strong>
          <small>{{ setupSummaryLine }}</small>
        </div>
        <div class="topbar-actions">
          <span class="status-chip" [ngClass]="workspace.statusClass(currentStatus())">
            {{ ('customerMeeting.statusValues.' + currentStatus()) | t }}
          </span>
          <button type="button" class="ghost-action" (click)="setupCollapsed = false">
            {{ 'customerMeeting.expandSetup' | t }}
          </button>
        </div>
      </article>

      <div class="plan-layout" *ngIf="!setupCollapsed">
        <div class="plan-main">
          <div class="form-grid">
            <div class="field-control" *ngIf="!customer">
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

            <label class="field-control">
              {{ 'customerMeeting.meetingLeader' | t }}
              <app-searchable-select
                name="leader"
                [(ngModel)]="form.meetingLeaderEmployeeId"
                (ngModelChange)="onPlanChanged()"
                [options]="leaderSelectOptions"
              ></app-searchable-select>
            </label>

            <label class="field-control">
              {{ 'customerMeeting.goal' | t }}
              <input
                type="text"
                name="goal"
                [(ngModel)]="form.goal"
                (ngModelChange)="onPlanChanged()"
                [placeholder]="'customerMeeting.goalPlaceholder' | t"
                maxlength="200"
              />
              <small class="char-counter muted">{{ (form.goal || '').length }}/200</small>
            </label>

            <div class="field-control wide">
              {{ 'customerMeeting.internalParticipants' | t }}
              <details class="participant-dropdown" (click)="$event.stopPropagation()">
                <summary class="participant-dropdown-trigger">
                  <span class="participant-summary-text" *ngIf="form.internalParticipantEmployeeIds.length; else chooseInternalParticipants">
                    {{ selectedInternalParticipantsLabel() }}
                  </span>
                  <ng-template #chooseInternalParticipants>
                    <span class="participant-placeholder">{{ 'customerMeeting.selectInternalParticipants' | t }}</span>
                  </ng-template>
                </summary>

                <div class="participant-dropdown-menu">
                  <input
                    type="search"
                    class="participant-search"
                    name="internalParticipantsSearch"
                    [(ngModel)]="internalParticipantSearch"
                    [placeholder]="'customerMeeting.searchParticipants' | t"
                    (click)="$event.stopPropagation()"
                  />

                  <label
                    *ngFor="let e of filteredInternalEmployees"
                    class="participant-option"
                    (click)="$event.stopPropagation()"
                  >
                    <input
                      type="checkbox"
                      [checked]="form.internalParticipantEmployeeIds.includes(e.id)"
                      (change)="toggleInternal(e.id)"
                    />
                    <span>{{ e.fullName }}</span>
                  </label>

                  <div class="participant-empty" *ngIf="!filteredInternalEmployees.length">
                    {{ 'home.noMatches' | t }}
                  </div>
                </div>
              </details>

              <div class="selected-participants" *ngIf="form.internalParticipantEmployeeIds.length">
                <span class="selected-participant" *ngFor="let id of form.internalParticipantEmployeeIds">
                  <span>{{ workspace.employee(id)?.fullName }}</span>
                  <button type="button" (click)="toggleInternal(id)" title="Remove">×</button>
                </span>
              </div>
            </div>

            <div class="field-control wide">
              {{ 'customerMeeting.customerParticipants' | t }}
              <details class="participant-dropdown" (click)="$event.stopPropagation()">
                <summary class="participant-dropdown-trigger">
                  <span class="participant-summary-text" *ngIf="form.customerParticipants.length; else chooseCustomerParticipants">
                    {{ selectedCustomerParticipantsLabel() }}
                  </span>
                  <ng-template #chooseCustomerParticipants>
                    <span class="participant-placeholder">{{ 'customerMeeting.selectCustomerParticipants' | t }}</span>
                  </ng-template>
                </summary>

                <div class="participant-dropdown-menu">
                  <input
                    type="search"
                    class="participant-search"
                    name="customerParticipantsSearch"
                    [(ngModel)]="customerParticipantSearch"
                    [placeholder]="'customerMeeting.searchParticipants' | t"
                    (click)="$event.stopPropagation()"
                  />

                  <label
                    *ngFor="let p of filteredCustomerParticipantOptions"
                    class="participant-option"
                    (click)="$event.stopPropagation()"
                  >
                    <input
                      type="checkbox"
                      [checked]="isCustomerParticipantSelected(p)"
                      (change)="toggleCustomerParticipant(p)"
                    />
                    <span>
                      {{ p.name }}
                      <small class="muted" *ngIf="p.email"> - {{ p.email }}</small>
                      <small class="muted" *ngIf="p.phone"> · {{ p.phone }}</small>
                    </span>
                  </label>

                  <div class="participant-empty" *ngIf="!filteredCustomerParticipantOptions.length">
                    {{ 'home.noMatches' | t }}
                  </div>
                </div>
              </details>

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

              <div class="selected-participants" *ngIf="form.customerParticipants.length">
                <span class="selected-participant" *ngFor="let p of form.customerParticipants; let i = index">
                  <span>{{ p.name }}</span>
                  <button type="button" (click)="removeCustomerParticipant(i)" title="Remove">×</button>
                </span>
              </div>
            </div>
          </div>
        </div>

        <aside class="prep-sidebar" *ngIf="selectedCustomerForPrep as prepCustomer; else noPrepSidebar">
          <h5>{{ 'meetingPrep.summaryFor' | t }} {{ prepCustomer.name }}</h5>
          <app-meeting-prep-brief
            variant="compact"
            [customerId]="prepCustomer.id"
            [currentMeetingId]="editingMeeting?.id ?? null"
          ></app-meeting-prep-brief>
        </aside>
        <ng-template #noPrepSidebar>
          <aside class="prep-sidebar muted">
            {{ 'customerMeeting.pickCustomerForPrep' | t }}
          </aside>
        </ng-template>
      </div>

      <div class="plan-bottom-action" *ngIf="!setupCollapsed">
        <button
          type="button"
          class="primary-action"
          [disabled]="!canStartMeeting()"
          (click)="startOrCollapseSetup()"
        >
          {{ editing ? ('customerMeeting.collapseSetup' | t) : ('customerMeeting.startMeeting' | t) }}
        </button>
      </div>
    </section>

    <section class="panel run-panel" id="run-section">
      <div class="panel-header">
        <div>
          <span class="eyebrow">{{ 'customerMeeting.runSection' | t }}</span>
          <h3>{{ 'meetings.addMeetingOutput' | t }}</h3>
          <small class="muted">{{ 'customerMeeting.runSubtitle' | t }}</small>
        </div>
        <div class="topbar-actions" *ngIf="editing && editingMeeting">
          <button type="button" class="ghost-action small" (click)="captureCollapsed = !captureCollapsed">
            {{ captureCollapsed ? ('customerMeeting.expandCapture' | t) : ('customerMeeting.collapseCapture' | t) }}
          </button>
        </div>
      </div>

      <ng-container *ngIf="editing && editingMeeting; else runLocked">
        <form class="capture-shell" *ngIf="!captureCollapsed" (ngSubmit)="captureNote()" (click)="$event.stopPropagation()">
          <div class="capture-type-row">
            <button
              type="button"
              class="capture-chip"
              *ngFor="let option of captureTypeOptions; let idx = index"
              [class.active]="newNote.type === option"
              (click)="setNoteType(option)"
            >
              <span>{{ ('noteType.' + option) | t }}</span>
              <span class="chip-shortcut">⌃{{ idx + 1 }}</span>
            </button>
          </div>

          <label class="field-control wide composer-control">
            <input
              #noteComposerInput
              type="text"
              name="noteContent"
              [(ngModel)]="newNote.content"
              [placeholder]="'customerMeeting.noteContentPlaceholder' | t"
              (keydown)="onComposerKeydown($event)"
            />
          </label>

          <div class="capture-grid" *ngIf="newNote.type === 'action'">
            <label class="field-control">
              {{ 'common.owner' | t }}
              <app-searchable-select
                name="noteOwner"
                [(ngModel)]="newNote.ownerId"
                [options]="noteOwnerOptions"
              ></app-searchable-select>
            </label>
            <label class="field-control">
              {{ 'common.dueDate' | t }}
              <input type="date" name="noteDue" [(ngModel)]="newNote.dueDate" />
            </label>
          </div>
          <div class="capture-actions-row">
            <button type="submit" class="primary-action" [disabled]="!canAddNote()">
              {{ 'customerMeeting.addNote' | t }}
            </button>
            <button
              *ngIf="canCreateTaskFromType(newNote.type)"
              type="button"
              class="ghost-action"
              [disabled]="!canAddNote()"
              (click)="captureNote(true)"
            >
              {{ 'customerMeeting.captureAndTask' | t }}
            </button>
            <button type="button" class="ghost-action small" (click)="triggerNoteAttachInput()">
              📎 {{ pendingAttachmentFile ? pendingAttachmentFile.name : ('customerMeeting.attachFile' | t) }}
            </button>
            <input #noteAttachInput type="file" style="display:none" (change)="onPendingAttachSelected($event)" />
          </div>

          <p class="muted action-hint" *ngIf="newNote.type === 'action' && (!newNote.ownerId || !newNote.dueDate)">
            {{ 'customerMeeting.actionNeedsOwnerDue' | t }}
          </p>
        </form>

        <app-meeting-task-creation
          *ngIf="creatingTaskForNote && editingMeeting && editingMeeting.customerId"
          [meetingId]="editingMeeting.id"
          [customerId]="editingMeeting.customerId"
          [sourceNote]="creatingTaskForNote"
          (created)="onTaskCreated()"
          (cancelled)="creatingTaskForNote = null"
        />

        <div class="notes-list" id="notes-list" *ngIf="capturedNotes.length; else noNotesYet">
          <div *ngFor="let n of capturedNotes" class="note-row">
            <span class="status-chip" [ngClass]="n.type">
              {{ ('noteType.' + n.type) | t }}
            </span>
            <div class="note-content">
              <ng-container *ngIf="editingNoteId !== n.id; else editNoteForm">
                <p>{{ n.content }}</p>
                <div class="muted">
                  <span *ngIf="n.createdByEmployeeId">{{ workspace.employeeName(n.createdByEmployeeId) }}</span>
                  <span *ngIf="n.createdAt">- {{ n.createdAt | slice:0:10 }}</span>
                  <span *ngIf="n.ownerId">- {{ 'common.owner' | t }}: {{ workspace.employeeName(n.ownerId) }}</span>
                  <span *ngIf="n.dueDate">- {{ 'common.due' | t }} {{ n.dueDate }}</span>
                </div>
                <div class="note-linked" *ngIf="linkedTaskForNote(n) as linked">
                  <span class="status-chip linked-chip">{{ 'customerMeeting.convertedToTask' | t }}</span>
                  <span class="status-chip" [ngClass]="workspace.statusClass(linked.status)">
                    {{ ('meetingTask.statusValues.' +linked.status) | t }}
                  </span>
                </div>
                <small class="muted" *ngIf="n.type === 'action' && !isActionReady(n)">
                  {{ 'customerMeeting.actionNeedsOwnerDue' | t }}
                </small>
              </ng-container>
              <ng-template #editNoteForm>
                <div class="note-edit-grid">
                  <app-searchable-select
                    [name]="'editType-' + n.id"
                    [(ngModel)]="editingNoteDraft.type"
                    [options]="noteTypeOptions"
                  ></app-searchable-select>
                  <input
                    [name]="'editContent-' + n.id"
                    type="text"
                    [(ngModel)]="editingNoteDraft.content"
                  />
                  <app-searchable-select
                    [name]="'editOwner-' + n.id"
                    [(ngModel)]="editingNoteDraft.ownerId"
                    [options]="noteOwnerOptions"
                  ></app-searchable-select>
                  <input
                    [name]="'editDue-' + n.id"
                    type="date"
                    [(ngModel)]="editingNoteDraft.dueDate"
                  />
                </div>
              </ng-template>
            </div>
            <div class="note-actions" (click)="$event.stopPropagation()">
              <button
                *ngIf="editingNoteId !== n.id"
                type="button"
                class="ghost-action"
                (click)="startEditingNote(n)"
              >
                {{ 'common.edit' | t }}
              </button>
              <button
                *ngIf="editingNoteId === n.id"
                type="button"
                class="primary-action"
                [disabled]="!canSaveEditedNote()"
                (click)="saveEditedNote(n)"
              >
                {{ 'common.save' | t }}
              </button>
              <button
                *ngIf="editingNoteId === n.id"
                type="button"
                class="ghost-action"
                (click)="cancelEditingNote()"
              >
                {{ 'common.cancel' | t }}
              </button>
              <button
                type="button"
                class="ghost-action danger"
                (click)="deleteNote(n)"
              >
                {{ 'common.delete' | t }}
              </button>
              <button
                *ngIf="canCreateTaskFromNote(n) && !n.convertedTaskId"
                type="button"
                class="primary-action"
                [disabled]="n.type === 'action' && !isActionReady(n)"
                (click)="startTaskCreation(n)"
              >
                {{ 'customerMeeting.createTaskFromNote' | t }}
              </button>
              <button
                *ngIf="linkedTaskForNote(n) as linked"
                type="button"
                class="ghost-action"
                (click)="openMeetingTask(linked)"
              >
                {{ 'customerMeeting.openTask' | t }}
              </button>
              <button
                *ngIf="editingNoteId !== n.id"
                type="button"
                class="ghost-action"
                (click)="openNoteDetail(n)"
              >
                {{ 'customerMeeting.noteDetails' | t }}
              </button>
              <button
                *ngIf="editingNoteId !== n.id"
                type="button"
                class="ghost-action small"
                (click)="triggerNoteRowAttach(n.id)"
              >
                📎
              </button>
              <input
                [id]="'note-attach-' + n.id"
                type="file"
                style="display:none"
                (change)="onNoteRowFileSelected($event, n.id)"
              />
            </div>
            <div class="note-attachments" *ngIf="workspace.noteAttachments(n.id).length">
              <div class="note-attach-chip" *ngFor="let att of workspace.noteAttachments(n.id)">
                <span>{{ att.fileName }}</span>
                <button type="button" (click)="removeAttachment(att.id)" title="Remove">×</button>
              </div>
            </div>
          </div>
        </div>
        <ng-template #noNotesYet>
          <div class="empty-state compact-empty">
            <strong>{{ 'meetingPrep.nothing' | t }}</strong>
          </div>
        </ng-template>

        <section class="linked-tasks-panel">
          <div class="panel-header">
            <div>
              <span class="eyebrow">{{ 'customerMeeting.tasksFromMeeting' | t }}</span>
              <h4>{{ meetingTasksForCurrentMeeting.length }} {{ 'customerMeeting.tasksLabel' | t }}</h4>
            </div>
            <div class="task-filter-row">
              <button type="button" class="ghost-action" [class.active]="taskFilter === 'open'" (click)="taskFilter = 'open'">
                {{ 'customerMeeting.taskFilterOpen' | t }} ({{ countTasksByFilter('open') }})
              </button>
              <button type="button" class="ghost-action" [class.active]="taskFilter === 'blocked'" (click)="taskFilter = 'blocked'">
                {{ 'customerMeeting.taskFilterBlocked' | t }} ({{ countTasksByFilter('blocked') }})
              </button>
              <button type="button" class="ghost-action" [class.active]="taskFilter === 'done'" (click)="taskFilter = 'done'">
                {{ 'customerMeeting.taskFilterDone' | t }} ({{ countTasksByFilter('done') }})
              </button>
              <button type="button" class="ghost-action" [class.active]="taskFilter === 'all'" (click)="taskFilter = 'all'">
                {{ 'customerMeeting.taskFilterAll' | t }}
              </button>
            </div>
          </div>

          <div class="linked-task-list" *ngIf="filteredMeetingTasks.length; else noLinkedTasks">
            <div class="linked-task-card" *ngFor="let task of filteredMeetingTasks">
              <div class="linked-task-row">
                <button type="button" class="linked-task-title-btn" (click)="openMeetingTask(task)">
                  <strong>{{ task.title }}</strong>
                  <small class="muted">
                    {{ 'common.owner' | t }}: {{ workspace.employeeName(task.assignedToEmployeeId) }} · {{ 'common.due' | t }} {{ task.dueDate || '-' }}
                  </small>
                </button>
                <div class="linked-task-meta">
                  <span class="status-chip" [ngClass]="workspace.statusClass(task.status)">
                    {{ ('meetingTask.statusValues.' + task.status) | t }}
                  </span>
                  <button
                    type="button"
                    class="ghost-action small progress-toggle"
                    [class.active]="expandedTaskId === task.id"
                    (click)="toggleTaskExpanded(task.id)"
                  >
                    {{ (task.progressionNotes?.length || 0) }} {{ 'customerMeeting.updates' | t }}
                    {{ expandedTaskId === task.id ? '▲' : '▼' }}
                  </button>
                </div>
              </div>

              <div class="progression-notes-panel" *ngIf="expandedTaskId === task.id" (click)="$event.stopPropagation()">
                <div class="progression-note-row" *ngFor="let pn of task.progressionNotes">
                  <span class="muted">{{ pn.createdAt | slice:0:10 }} · {{ workspace.employeeName(pn.authorEmployeeId) }}</span>
                  <p>{{ pn.content }}</p>
                </div>
                <div class="progression-empty" *ngIf="!task.progressionNotes?.length">
                  <small class="muted">{{ 'customerMeeting.noUpdatesYet' | t }}</small>
                </div>
                <div class="progression-add-row">
                  <input
                    type="text"
                    [name]="'progress-' + task.id"
                    [(ngModel)]="newProgressionNoteByTask[task.id]"
                    [placeholder]="'customerMeeting.addUpdatePlaceholder' | t"
                    (keydown.enter)="addProgressionNote(task)"
                    (click)="$event.stopPropagation()"
                  />
                  <button
                    type="button"
                    class="ghost-action small"
                    [disabled]="!(newProgressionNoteByTask[task.id] ?? '').trim()"
                    (click)="addProgressionNote(task)"
                  >
                    {{ 'customerMeeting.addUpdate' | t }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <ng-template #noLinkedTasks>
            <div class="empty-state compact-empty">
              <strong>{{ 'customerMeeting.noTasksInFilter' | t }}</strong>
            </div>
          </ng-template>
        </section>

        <!-- Attachments -->
      </ng-container>

      <ng-template #runLocked>
        <div class="empty-state compact-empty">
          <strong>{{ 'customerMeeting.completePlanToStart' | t }}</strong>
        </div>
      </ng-template>
    </section>

    <section class="panel" id="wrapup-section">
      <div class="panel-header">
        <div>
          <span class="eyebrow">{{ 'customerMeeting.wrapUp' | t }}</span>
          <h3>{{ 'customerMeeting.publishRecap' | t }}</h3>
        </div>
        <div class="topbar-actions">
          <button type="button" class="primary-action" [disabled]="!editingMeeting" (click)="publishRecap()">
            {{ 'customerMeeting.publishRecap' | t }}
          </button>
        </div>
      </div>

      <ng-container *ngIf="editing && editingMeeting; else wrapLocked">
        <div class="form-grid">
          <label class="field-control wide">
            {{ 'customerMeeting.summary' | t }}
            <textarea
              name="summary"
              rows="4"
              [(ngModel)]="summaryText"
              (ngModelChange)="onWrapUpChanged()"
              [placeholder]="'customerMeeting.summaryPlaceholder' | t"
            ></textarea>
          </label>

          <label class="field-control">
            {{ 'customerMeeting.nextMeetingDate' | t }}
            <input
              type="datetime-local"
              name="nextMeetingDate"
              [(ngModel)]="nextMeetingDateLocal"
              (ngModelChange)="onWrapUpChanged()"
            />
          </label>

          <label class="field-control wide">
            {{ 'customerMeeting.nextMeetingNotes' | t }}
            <textarea
              name="nextMeetingNotes"
              rows="3"
              [(ngModel)]="nextMeetingNotesText"
              (ngModelChange)="onWrapNextMeetingNotesChanged()"
              [placeholder]="'customerMeeting.nextMeetingNotesPlaceholder' | t"
            ></textarea>
            <small class="muted">{{ 'customerMeeting.nextMeetingNotesHint' | t }}</small>
          </label>
        </div>
        <section class="meeting-review-checklist">
          <strong>{{ 'customerMeeting.beforePublishing' | t }}</strong>
          <ul>
            <li [class.warn]="actionsWithoutTaskCount > 0" [class.checklist-link]="actionsWithoutTaskCount > 0" (click)="actionsWithoutTaskCount > 0 && scrollToNotesList()">
              {{ 'customerMeeting.reviewActionsWithoutTask' | t }}: {{ actionsWithoutTaskCount }}
              <span *ngIf="actionsWithoutTaskCount > 0" class="checklist-hint">→ review</span>
            </li>
            <li [class.warn]="openBlockerTaskCount > 0" [class.checklist-link]="openBlockerTaskCount > 0" (click)="openBlockerTaskCount > 0 && scrollToNotesList()">
              {{ 'customerMeeting.reviewBlockersOpen' | t }}: {{ openBlockerTaskCount }}
              <span *ngIf="openBlockerTaskCount > 0" class="checklist-hint">→ review</span>
            </li>
            <li [class.warn]="uncategorizedNotesCount > 0">
              {{ 'customerMeeting.reviewNotesCaptured' | t }}: {{ capturedNotes.length }} ({{ 'customerMeeting.reviewUncategorized' | t }}: {{ uncategorizedNotesCount }})
            </li>
            <li [class.blocking]="openMeetingTasksCount > 0" [class.checklist-link]="openMeetingTasksCount > 0" (click)="openMeetingTasksCount > 0 && scrollToNotesList()">
              {{ 'customerMeeting.reviewOpenTasks' | t }}: {{ openMeetingTasksCount }}
              <span *ngIf="openMeetingTasksCount > 0" class="blocking-note">— {{ 'customerMeeting.reviewOpenTasksNote' | t }}</span>
              <span *ngIf="openMeetingTasksCount > 0" class="checklist-hint">→ review</span>
            </li>
          </ul>
        </section>
        <p class="muted">{{ 'customerMeeting.publishRecapHint' | t }}</p>
        <pre class="recap-preview" *ngIf="lastRecap">{{ lastRecap }}</pre>
      </ng-container>

      <ng-template #wrapLocked>
        <div class="empty-state compact-empty">
          <strong>{{ 'customerMeeting.completePlanToStart' | t }}</strong>
        </div>
      </ng-template>
    </section>

    <app-note-detail-modal
      *ngIf="openedNote && editingMeeting"
      [note]="openedNote"
      [meeting]="editingMeeting"
      (close)="openedNote = null"
    />
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .panel-header h3 { margin: 0; }
    .section-head { margin: 14px 0 10px; }
    .section-head h4 { margin: 0; }
    .plan-bottom-action { padding: 16px 0 4px; display: flex; justify-content: flex-end; }
    .plan-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
      gap: 14px;
      align-items: start;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    .field-control.wide { grid-column: 1 / -1; }
    .participant-dropdown {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--bg-elevated);
      overflow: hidden;
    }
    .participant-dropdown-trigger {
      min-height: 40px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      cursor: pointer;
      user-select: none;
    }
    .participant-dropdown-trigger::-webkit-details-marker { display: none; }
    .participant-summary-text,
    .participant-placeholder {
      display: block;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      line-height: 1.3;
    }
    .participant-placeholder { color: var(--muted); }
    .participant-dropdown-menu {
      display: grid;
      gap: 6px;
      max-height: 280px;
      overflow-y: auto;
      overflow-x: hidden;
      border-top: 1px solid var(--line);
      padding: 8px;
      background: var(--bg-elevated);
    }
    .participant-search {
      width: 100%;
      min-height: 34px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg-elevated);
      color: var(--ink);
    }
    .participant-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 8px;
      cursor: pointer;
    }
    .participant-option input {
      width: 18px;
      height: 18px;
      min-height: 18px;
      padding: 0;
      margin: 0;
      flex: 0 0 auto;
    }
    .participant-empty {
      padding: 6px 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .prospect-form {
      display: grid;
      gap: 8px;
      padding: 12px;
      border: 1px dashed var(--border-subtle);
      border-radius: 10px;
      background: var(--bg-canvas);
      margin-top: 8px;
    }
    .dup-warning {
      border: 1px solid #d9a400;
      background: rgba(217, 164, 0, 0.10);
      border-radius: 10px;
      padding: 8px 10px;
    }
    .dup-warning-title { color: #8a6d00; font-size: 12px; }
    .dup-warning-text { margin: 4px 0 6px; font-size: 11px; color: var(--text-secondary); }
    .dup-warning-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .dup-match {
      width: 100%;
      text-align: start;
      display: flex;
      align-items: baseline;
      gap: 8px;
      background: var(--bg-elevated);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer;
      color: inherit;
      font: inherit;
    }
    .dup-match:hover { border-color: var(--accent); }
    .dup-match-name { font-weight: 600; }
    .dup-match small { color: var(--text-secondary); font-size: 11px; }
    .warn-action { background: #d9a400; border-color: #d9a400; }
    .prospect-form-title {
      font-size: 12px;
      text-transform: uppercase;
      color: var(--muted);
    }
    .prospect-form-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .customer-add-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: 6px;
      margin-top: 8px;
      padding: 10px 12px;
      border: 1px dashed var(--line);
      border-radius: 10px;
      background: var(--bg-canvas);
    }
    .add-participant-toggle {
      margin-top: 8px;
    }
    .selected-participants {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .selected-participant {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--bg-elevated);
      font-size: 12px;
    }
    .selected-participant button {
      border: 0;
      background: transparent;
      color: var(--muted);
      padding: 0;
      line-height: 1;
      min-height: 0;
      cursor: pointer;
      opacity: 0;
      transition: opacity 150ms ease;
    }
    .selected-participant:hover button {
      opacity: 1;
    }
    .prep-sidebar {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--bg-elevated);
      padding: 10px;
      display: grid;
      gap: 10px;
    }
    .prep-sidebar h5 { margin: 0; font-size: 14px; }
    .prep-block { display: grid; gap: 6px; }
    .prep-block strong { font-size: 12px; text-transform: uppercase; color: var(--muted); }
    .prep-block ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    .prep-block li {
      display: grid;
      gap: 4px;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg-canvas);
      font-size: 13px;
      line-height: 1.3;
    }
    .section-head-split-unused {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    .meeting-setup-summary {
      position: sticky;
      top: 10px;
      z-index: 2;
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--bg-elevated);
      padding: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .summary-copy {
      display: grid;
      gap: 4px;
    }
    .summary-copy small { color: var(--muted); }
    .run-panel { overflow: hidden; }
    .capture-shell {
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface-strong);
    }
    .capture-type-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .capture-chip {
      border: 1px solid var(--line);
      background: var(--bg-elevated);
      border-radius: 999px;
      padding: 4px 10px;
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: var(--ink);
    }
    .capture-chip.active {
      border-color: var(--accent-strong);
      background: var(--accent-soft);
      box-shadow: inset 0 0 0 1px var(--accent);
    }
    .chip-shortcut {
      display: inline-grid;
      place-items: center;
      min-width: 22px;
      height: 18px;
      border-radius: 4px;
      border: 1px solid var(--line);
      font-size: 10px;
      color: var(--muted);
      padding: 0 3px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .composer-control input {
      min-height: 46px;
      font-size: 16px;
      font-weight: 600;
    }
    .capture-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 10px;
      align-items: end;
    }
    .capture-actions-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .shortcut-hint { margin: 0; font-size: 12px; }
    .action-hint { margin: 8px 0 0; color: var(--warning); }
    .notes-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
    .note-row {
      display: grid;
      grid-template-columns: 110px 1fr auto;
      gap: 0.75rem;
      align-items: start;
      padding: 0.75rem;
      background: rgba(255,255,255,0.03);
      border-radius: 0.5rem;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .note-content p { margin: 0; }
    .note-content .muted {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      font-size: 0.8rem;
      margin-top: 0.25rem;
      color: var(--muted);
    }
    .note-linked {
      margin-top: 6px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .note-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: flex-start;
      gap: 6px;
    }
    .note-attachments {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .note-attach-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--bg-elevated);
      font-size: 12px;
    }
    .note-attach-chip button {
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--muted);
      font-size: 14px;
      padding: 0;
      line-height: 1;
      min-height: 0;
    }
    .note-edit-grid {
      display: grid;
      grid-template-columns: minmax(0, 170px) minmax(0, 1fr);
      gap: 8px;
    }
    .ghost-action.danger {
      border-color: rgba(192, 57, 43, 0.32);
      color: var(--danger);
    }
    .ghost-action.active {
      border-color: var(--accent-strong);
      color: var(--accent-strong);
      background: var(--accent-soft);
    }
    .linked-tasks-panel {
      margin-top: 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--bg-elevated);
      padding: 12px;
      display: grid;
      gap: 10px;
    }
    .linked-tasks-panel h4 {
      margin: 2px 0 0;
      font-size: 18px;
    }
    .task-filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .linked-task-list {
      display: grid;
      gap: 8px;
    }
    .meeting-review-checklist {
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface-strong);
      padding: 10px 12px;
      display: grid;
      gap: 6px;
    }
    .meeting-review-checklist strong {
      font-size: 12px;
      text-transform: uppercase;
      color: var(--muted);
    }
    .meeting-review-checklist ul {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 4px;
      font-size: 13px;
    }
    .meeting-review-checklist li.warn {
      color: var(--warning);
      font-weight: 700;
    }
    .meeting-review-checklist li.blocking {
      color: var(--danger);
      font-weight: 700;
    }
    .blocking-note {
      font-size: 11px;
      font-weight: 400;
      opacity: 0.8;
    }
    .checklist-link { cursor: pointer; }
    .checklist-link:hover { text-decoration: underline dotted; }
    .checklist-hint {
      font-size: 11px;
      font-weight: 400;
      opacity: 0.65;
      margin-left: 4px;
    }
    .char-counter {
      font-size: 11px;
      text-align: right;
      display: block;
      margin-top: 2px;
    }
    @keyframes pulse-border {
      0%, 100% { box-shadow: 0 0 0 0 transparent; }
      50% { box-shadow: 0 0 0 4px var(--accent-soft); }
    }
    .start-ready { animation: pulse-border 2s ease-in-out infinite; }
    .linked-chip { background: var(--olive-soft); color: var(--olive); }
    .recap-preview {
      margin: 0;
      padding: 14px;
      background: var(--surface-strong);
      border: 1px solid var(--line);
      border-radius: 10px;
      font-family: ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Consolas, monospace;
      font-size: 13px;
      white-space: pre-wrap;
      line-height: 1.5;
      max-height: 360px;
      overflow-y: auto;
    }
    .prev-meeting-notes {
      display: grid;
      gap: 6px;
      padding: 10px 12px;
      border: 1px solid var(--accent-soft);
      border-left: 3px solid var(--accent);
      border-radius: 8px;
      background: var(--accent-soft);
      margin-bottom: 10px;
    }
    .prev-meeting-notes .eyebrow { margin-bottom: 0; }
    .prev-notes-body {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: var(--ink);
      white-space: pre-wrap;
    }
    .linked-task-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg-elevated);
      overflow: hidden;
    }
    .linked-task-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: var(--bg-elevated);
    }
    .linked-task-title-btn {
      flex: 1;
      display: grid;
      gap: 2px;
      border: none;
      background: var(--bg-elevated);
      color: var(--ink);
      text-align: left;
      cursor: pointer;
      padding: 4px 0;
      min-width: 0;
    }
    .linked-task-title-btn:hover { background: var(--bg-hover); border-radius: 6px; }
    .linked-task-title-btn strong { display: block; }
    .linked-task-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .progress-toggle { font-size: 11px; }
    .progression-notes-panel {
      border-top: 1px solid var(--line);
      padding: 10px;
      background: var(--surface-strong);
      display: grid;
      gap: 8px;
    }
    .progression-note-row {
      display: grid;
      gap: 2px;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--bg-elevated);
    }
    .progression-note-row p { margin: 0; font-size: 13px; }
    .progression-empty { padding: 4px 0; }
    .progression-add-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
    }
    .attachments-panel { margin-top: 14px; }
    .attachment-list { display: grid; gap: 8px; }
    .attachment-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg-canvas);
    }
    .attachment-info { display: grid; gap: 2px; min-width: 0; }
    .attachment-name {
      font-weight: 600;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .attachment-actions { display: flex; gap: 6px; flex-shrink: 0; }
    a.ghost-action {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
    }
    @media (max-width: 980px) {
      .plan-layout { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
.form-grid { grid-template-columns: 1fr; }
      .customer-add-row { grid-template-columns: 1fr; }
      .note-row { grid-template-columns: 1fr; }
      .meeting-setup-summary { flex-direction: column; align-items: flex-start; }
      .capture-grid { grid-template-columns: 1fr; }
      .capture-actions-row { justify-content: flex-start; }
      .note-edit-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class CustomerMeetingFormComponent implements OnChanges {
  /**
   * Optional. When provided, the customer is fixed (no picker shown - used from
   * Customer 360 -> New meeting). When omitted, a picker is shown inside the
   * form (used from the Meetings tab -> New meeting).
   */
  @Input() customer: Customer | null = null;
  @Input() existingMeetingId: string | null = null;
  @Output() saved = new EventEmitter<MeetingFormSavedEvent>();
  @Output() cancelled = new EventEmitter<void>();

  readonly noteTypes: NoteType[] = ['note', 'action', 'decision', 'blocker'];
  readonly captureTypeOptions: NoteType[] = ['note', 'action', 'decision', 'blocker'];
  readonly meetingStatusFlow: CustomerMeetingStatus[] = [
    'Planned',
    'Draft Summary',
    'Tasks Created',
    'Closed'
  ];

  form!: CreateCustomerMeetingInput & {
    customerParticipants: CustomerParticipant[];
    internalParticipantEmployeeIds: string[];
  };
  pickedCustomerId = '';
  summaryText = '';
  meetingDateLocal = '';
  nextMeetingDateLocal = '';
  newNote: CreateMeetingNoteInput = { type: 'note', content: '' };
  internalParticipantSearch = '';
  customerParticipantSearch = '';
  customCustomerParticipant: CustomerParticipant = { name: '', email: '', phone: '', role: '' };
  private customParticipantPool: CustomerParticipantOption[] = [];
  showProspectForm = false;
  newProspect = { name: '', contactName: '', contactEmail: '', contactPhone: '' };
  setupCollapsed = false;
  taskFilter: MeetingTaskFilter = 'open';
  editingNoteId: string | null = null;
  editingNoteDraft: UpdateMeetingNoteInput & { content: string } = {
    type: 'note',
    content: '',
    ownerId: undefined,
    dueDate: undefined
  };

  editing = false;
  editingMeeting: CustomerMeeting | null = null;
  creatingTaskForNote: MeetingNote | null = null;
  openedNote: MeetingNote | null = null;
  lastRecap = '';
  nextMeetingNotesText = '';
  captureCollapsed = false;
  expandedTaskId: string | null = null;
  newProgressionNoteByTask: Record<string, string | undefined> = {};
  uploadingAttachment = false;
  pendingAttachmentFile: File | null = null;
  showAddParticipantRow = false;
  @ViewChild('noteComposerInput') noteComposerInput?: ElementRef<HTMLInputElement>;
  @ViewChild('noteAttachInput') noteAttachInput?: ElementRef<HTMLInputElement>;

  constructor(
    public workspace: ActionosWorkspaceService,
    private i18n: ActionosI18nService,
    private el: ElementRef
  ) {}

  @HostListener('document:click')
  onDocumentClick(): void {
    (this.el.nativeElement as HTMLElement)
      .querySelectorAll<HTMLDetailsElement>('details[open]')
      .forEach(d => d.removeAttribute('open'));
  }

  get customerSelectOptions(): SelectOption[] {
    return [
      { value: '', label: this.i18n.translate('customerMeeting.selectCustomer') },
      ...this.workspace.customers.map(c => ({ value: c.id, label: c.name }))
    ];
  }

  get leaderSelectOptions(): SelectOption[] {
    return [
      { value: '', label: this.i18n.translate('customerMeeting.selectLeader') },
      ...this.workspace.employees.map(e => ({ value: e.id, label: e.fullName }))
    ];
  }

  get noteTypeOptions(): SelectOption[] {
    return this.noteTypes.map(n => ({
      value: n, label: this.i18n.translate('noteType.' + n)
    }));
  }

  get noteOwnerOptions(): SelectOption[] {
    return [
      { value: undefined, label: '—' },
      ...this.workspace.employees.map(e => ({ value: e.id, label: e.fullName }))
    ];
  }

  get setupSummaryLine(): string {
    const customerName = this.selectedCustomerForPrep?.name ?? 'No customer';
    const when = this.meetingDateLocal ? this.meetingDateLocal.replace('T', ' ') : 'No date';
    const participants = this.form.internalParticipantEmployeeIds.length + this.form.customerParticipants.length;
    return `${customerName} · ${when} · ${participants} participants`;
  }

  get capturedNotes(): MeetingNote[] {
    if (!this.editingMeeting) {
      return [];
    }
    return [...this.editingMeeting.notes].sort((a, b) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    );
  }

  get meetingTasksForCurrentMeeting(): Task[] {
    if (!this.editingMeeting) {
      return [];
    }
    return this.workspace.meetingTasksByMeeting(this.editingMeeting.id);
  }

  get filteredMeetingTasks(): Task[] {
    const tasks = this.meetingTasksForCurrentMeeting;
    if (this.taskFilter === 'all') {
      return tasks;
    }
    if (this.taskFilter === 'done') {
      return tasks.filter((task) => task.status === 'Done');
    }
    if (this.taskFilter === 'blocked') {
      return tasks.filter(
        (task) => task.status === 'Waiting For Customer' || task.status === 'Waiting For Internal'
      );
    }
    return tasks.filter((task) => this.workspace.isOpenMeetingTaskStatus(task.status));
  }

  get meetingActionsWithoutTask(): MeetingNote[] {
    return this.capturedNotes.filter((note) => note.type === 'action' && !note.convertedTaskId);
  }

  get actionsWithoutTaskCount(): number {
    return this.meetingActionsWithoutTask.length;
  }

  get openBlockerTaskCount(): number {
    return this.capturedNotes
      .filter((note) => note.type === 'blocker')
      .filter((note) => {
        const linked = this.linkedTaskForNote(note);
        if (!linked) {
          return true;
        }
        return this.workspace.isOpenMeetingTaskStatus(linked.status);
      }).length;
  }

  get uncategorizedNotesCount(): number {
    return this.capturedNotes.filter((note) => note.type === 'note').length;
  }

  get openMeetingTasksCount(): number {
    if (!this.editingMeeting) {
      return 0;
    }
    return this.meetingTasksForCurrentMeeting.filter(
      t => t.status !== 'Done' && t.status !== 'Cancelled'
    ).length;
  }

  get allMeetingTasksDone(): boolean {
    if (!this.editingMeeting) {
      return true;
    }
    return this.workspace.canCloseMeeting(this.editingMeeting.id);
  }

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
    }
  }

  canSave(): boolean {
    return this.canCreateDraft();
  }

  canStartMeeting(): boolean {
    return this.canCreateDraft();
  }

  canCollapseSetup(): boolean {
    return this.setupCollapsed || this.canCreateDraft();
  }

  scrollToSection(status: CustomerMeetingStatus): void {
    const sectionMap: Partial<Record<CustomerMeetingStatus, string>> = {
      'Planned': 'plan-section',
      'Draft Summary': 'run-section',
      'Tasks Created': 'run-section',
      'Closed': 'wrapup-section'
    };
    const id = sectionMap[status];
    if (id) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  scrollToNotesList(): void {
    document.getElementById('notes-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleSetupCollapsed(): void {
    if (!this.setupCollapsed && !this.canCreateDraft()) {
      return;
    }
    this.setupCollapsed = !this.setupCollapsed;
    if (this.setupCollapsed) {
      this.focusComposer();
    }
  }

  startMeetingCapture(): void {
    const updated = this.persistMeeting(true);
    if (!updated) {
      return;
    }
    this.setupCollapsed = true;
    this.focusComposer();
  }

  startOrCollapseSetup(): void {
    if (!this.editing) {
      this.startMeetingCapture();
    } else {
      this.setupCollapsed = true;
    }
  }

  currentStatus(): CustomerMeetingStatus {
    return this.editingMeeting?.status ?? 'Planned';
  }

  currentStatusIndex(): number {
    return this.meetingStatusFlow.indexOf(this.currentStatus());
  }

  statusCriteria(status: CustomerMeetingStatus): string {
    return this.i18n.translate(`customerMeeting.statusCriteria.${status}`);
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

  get filteredInternalEmployees(): Employee[] {
    const term = this.internalParticipantSearch.trim().toLowerCase();
    const all = this.workspace.employees;
    if (!term) {
      return all;
    }
    return all.filter((e) => e.fullName.toLowerCase().includes(term));
  }

  get filteredCustomerParticipantOptions(): CustomerParticipantOption[] {
    const term = this.customerParticipantSearch.trim().toLowerCase();
    const all = this.customerParticipantOptions();
    if (!term) {
      return all;
    }
    return all.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      (p.email?.toLowerCase().includes(term) ?? false) ||
      (p.role?.toLowerCase().includes(term) ?? false)
    );
  }

  onWrapNextMeetingNotesChanged(): void {
    if (this.editingMeeting) {
      this.persistMeeting(false);
    }
  }

  // ── Task progression notes ───────────────────────────────────────────────

  toggleTaskExpanded(taskId: string): void {
    this.expandedTaskId = this.expandedTaskId === taskId ? null : taskId;
  }

  addProgressionNote(task: Task): void {
    const content = (this.newProgressionNoteByTask[task.id] ?? '').trim();
    if (!content) {
      return;
    }
    this.workspace.addTaskProgressionNote(task.id, content);
    this.newProgressionNoteByTask[task.id] = undefined;
    if (this.editingMeeting) {
      this.editingMeeting = this.workspace.customerMeeting(this.editingMeeting.id) ?? this.editingMeeting;
    }
  }

  // ── Attachments ──────────────────────────────────────────────────────────

  triggerNoteAttachInput(): void {
    this.noteAttachInput?.nativeElement.click();
  }

  onPendingAttachSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.pendingAttachmentFile = input.files?.[0] ?? null;
  }

  triggerNoteRowAttach(noteId: string): void {
    const el = document.getElementById('note-attach-' + noteId) as HTMLInputElement | null;
    el?.click();
  }

  async onNoteRowFileSelected(event: Event, noteId: string): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.editingMeeting) {
      return;
    }
    for (const file of Array.from(input.files)) {
      await this.workspace.uploadNoteAttachment(this.editingMeeting.id, noteId, file);
    }
    this.editingMeeting = this.workspace.customerMeeting(this.editingMeeting.id) ?? this.editingMeeting;
    input.value = '';
  }

  removeAttachment(id: string): void {
    this.workspace.removeAttachment(id);
  }

  onProspectOrCustomerPicked(): void {
    this.showProspectForm = false;
    this.onPlanChanged();
  }

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
    this.pickedCustomerId = created.id;
    this.cancelProspectForm();
    this.onPlanChanged();
  }

  cancelProspectForm(): void {
    this.showProspectForm = false;
    this.newProspect = { name: '', contactName: '', contactEmail: '', contactPhone: '' };
  }

  onPlanChanged(): void {
    if (!this.editingMeeting) {
      this.tryCreateDraftMeeting();
    }
    if (this.editingMeeting) {
      this.persistMeeting(false);
    }
  }

  onWrapUpChanged(): void {
    if (this.editingMeeting) {
      this.persistMeeting(false);
    }
  }

  save(intent: MeetingFormSaveIntent): void {
    if (!this.canSave()) {
      return;
    }
    const updated = this.persistMeeting(true);
    if (!updated) {
      return;
    }
    if (intent === 'close' && updated.status !== 'Closed') {
      const hasContent = updated.notes.length > 0 ||
        this.workspace.meetingTasksByMeeting(updated.id).length > 0 ||
        !!updated.summary?.trim();
      if (hasContent) {
        this.publishRecap();
      }
    }
    this.saved.emit({ meetingId: updated.id, intent });
  }

  canAddNote(): boolean {
    if (!this.newNote.content.trim()) {
      return false;
    }
    if (this.newNote.type === 'action') {
      return !!this.newNote.ownerId && !!this.newNote.dueDate;
    }
    return true;
  }

  canCreateTaskFromType(type: NoteType): boolean {
    return type === 'action' || type === 'blocker';
  }

  canCreateTaskFromNote(note: MeetingNote): boolean {
    return this.canCreateTaskFromType(note.type);
  }

  captureNote(openTaskAfter = false): void {
    const created = this.addNoteInternal();
    if (!created) {
      return;
    }
    if (openTaskAfter && this.canCreateTaskFromNote(created)) {
      this.startTaskCreation(created);
    }
  }

  addNote(): void {
    this.captureNote(false);
  }

  setNoteType(type: NoteType): void {
    this.newNote.type = type;
    if (type === 'action' && !this.newNote.dueDate) {
      this.newNote.dueDate = new Date().toISOString().slice(0, 10);
    }
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key >= '1' && event.key <= '4') {
      const index = Number(event.key) - 1;
      const nextType = this.captureTypeOptions[index];
      if (nextType) {
        event.preventDefault();
        this.setNoteType(nextType);
      }
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.captureNote(event.ctrlKey || event.metaKey);
    }
  }

  isActionReady(note: MeetingNote): boolean {
    if (note.type !== 'action') {
      return true;
    }
    return !!note.ownerId && !!note.dueDate;
  }

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

  selectedInternalParticipantsLabel(): string {
    const names = this.form.internalParticipantEmployeeIds
      .map((id) => this.workspace.employee(id)?.fullName ?? '')
      .filter((name) => !!name);
    if (!names.length) {
      return '';
    }
    if (names.length <= 2) {
      return names.join(', ');
    }
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  selectedCustomerParticipantsLabel(): string {
    const names = this.form.customerParticipants
      .map((p) => p.name.trim())
      .filter((name) => !!name);
    if (!names.length) {
      return '';
    }
    if (names.length <= 2) {
      return names.join(', ');
    }
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  isCustomerParticipantSelected(option: CustomerParticipantOption): boolean {
    return this.form.customerParticipants.some((p) => this.customerParticipantKey(p) === option.key);
  }

  toggleCustomerParticipant(option: CustomerParticipantOption): void {
    const idx = this.form.customerParticipants.findIndex((p) =>
      this.customerParticipantKey(p) === option.key
    );
    if (idx === -1) {
      this.form.customerParticipants.push({
        name: option.name,
        email: option.email,
        role: option.role
      });
    } else {
      this.form.customerParticipants.splice(idx, 1);
    }
    this.onPlanChanged();
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

  removeCustomerParticipant(index: number): void {
    this.form.customerParticipants.splice(index, 1);
    this.onPlanChanged();
  }

  linkedTaskForNote(note: MeetingNote): Task | undefined {
    if (!note.convertedTaskId) {
      return undefined;
    }
    return this.workspace.Task(note.convertedTaskId);
  }

  countTasksByFilter(filter: MeetingTaskFilter): number {
    if (filter === 'all') {
      return this.meetingTasksForCurrentMeeting.length;
    }
    if (filter === 'done') {
      return this.meetingTasksForCurrentMeeting.filter((task) => task.status === 'Done').length;
    }
    if (filter === 'blocked') {
      return this.meetingTasksForCurrentMeeting.filter(
        (task) => task.status === 'Waiting For Customer' || task.status === 'Waiting For Internal'
      ).length;
    }
    return this.meetingTasksForCurrentMeeting.filter((task) => this.workspace.isOpenMeetingTaskStatus(task.status)).length;
  }

  openMeetingTask(task: Task): void {
    this.workspace.selectMeetingTask(task, true);
  }

  startTaskCreation(note: MeetingNote): void {
    if (!this.canCreateTaskFromNote(note)) {
      return;
    }
    if (note.type === 'action' && !this.isActionReady(note)) {
      return;
    }
    this.creatingTaskForNote = note;
  }

  startEditingNote(note: MeetingNote): void {
    this.editingNoteId = note.id;
    this.editingNoteDraft = {
      type: note.type,
      content: note.content,
      ownerId: note.ownerId,
      dueDate: note.dueDate
    };
  }

  cancelEditingNote(): void {
    this.editingNoteId = null;
    this.editingNoteDraft = {
      type: 'note',
      content: '',
      ownerId: undefined,
      dueDate: undefined
    };
  }

  canSaveEditedNote(): boolean {
    if (!this.editingNoteDraft.content?.trim()) {
      return false;
    }
    if (this.editingNoteDraft.type === 'action') {
      return !!this.editingNoteDraft.ownerId && !!this.editingNoteDraft.dueDate;
    }
    return true;
  }

  saveEditedNote(note: MeetingNote): void {
    if (!this.editingMeeting || !this.canSaveEditedNote()) {
      return;
    }
    const updated = this.workspace.updateCustomerMeetingNote(this.editingMeeting.id, note.id, {
      type: this.editingNoteDraft.type,
      content: this.editingNoteDraft.content.trim(),
      ownerId: this.editingNoteDraft.ownerId,
      dueDate: this.editingNoteDraft.dueDate
    });
    if (!updated) {
      return;
    }
    this.editingMeeting = this.workspace.customerMeeting(this.editingMeeting.id) ?? this.editingMeeting;
    this.cancelEditingNote();
  }

  deleteNote(note: MeetingNote): void {
    if (!this.editingMeeting) {
      return;
    }
    const removed = this.workspace.removeCustomerMeetingNote(this.editingMeeting.id, note.id);
    if (!removed) {
      return;
    }
    this.editingMeeting = this.workspace.customerMeeting(this.editingMeeting.id) ?? this.editingMeeting;
    if (this.editingNoteId === note.id) {
      this.cancelEditingNote();
    }
  }

  openNoteDetail(note: MeetingNote): void {
    this.openedNote = note;
  }

  publishRecap(): void {
    if (!this.editingMeeting) {
      return;
    }
    const recap = this.workspace.publishMeetingRecap(this.editingMeeting.id);
    if (recap !== null) {
      this.lastRecap = recap;
      this.editingMeeting =
        this.workspace.customerMeeting(this.editingMeeting.id) ?? this.editingMeeting;
    }
  }

  onTaskCreated(): void {
    this.creatingTaskForNote = null;
    if (this.editingMeeting) {
      this.editingMeeting = this.workspace.customerMeeting(this.editingMeeting.id) ?? this.editingMeeting;
    }
    this.focusComposer();
  }

  private addNoteInternal(): MeetingNote | null {
    if (!this.editingMeeting || !this.canAddNote()) {
      return null;
    }
    const created = this.workspace.addCustomerMeetingNote(this.editingMeeting.id, this.newNote);
    this.editingMeeting = this.workspace.customerMeeting(this.editingMeeting.id) ?? this.editingMeeting;
    if (!created) {
      return null;
    }
    if (this.pendingAttachmentFile && this.editingMeeting) {
      const meetingId = this.editingMeeting.id;
      const noteId = created.id;
      const file = this.pendingAttachmentFile;
      this.pendingAttachmentFile = null;
      void this.workspace.uploadNoteAttachment(meetingId, noteId, file).then(() => {
        this.editingMeeting = this.workspace.customerMeeting(meetingId) ?? this.editingMeeting;
      });
    }
    this.newNote = {
      type: this.newNote.type,
      content: '',
      ownerId: this.newNote.ownerId,
      dueDate: this.newNote.dueDate
    };
    this.focusComposer();
    return created;
  }

  private focusComposer(): void {
    setTimeout(() => this.noteComposerInput?.nativeElement.focus(), 0);
  }

  private initializeForm(): void {
    this.form = this.emptyForm();
    const now = new Date();
    now.setMinutes(0, 0, 0);
    this.meetingDateLocal = this.toLocalInput(now);
    this.nextMeetingDateLocal = '';
    this.summaryText = '';
    this.nextMeetingNotesText = '';
    this.captureCollapsed = false;
    this.pendingAttachmentFile = null;
    this.lastRecap = '';
    this.setupCollapsed = false;
    this.taskFilter = 'open';
    this.editingNoteId = null;
    this.editingNoteDraft = {
      type: 'note',
      content: '',
      ownerId: undefined,
      dueDate: undefined
    };
    this.newNote = { type: 'note', content: '', ownerId: this.workspace.currentEmployeeId };
    this.editing = false;
    this.editingMeeting = null;
    this.internalParticipantSearch = '';
    this.customerParticipantSearch = '';
    this.customCustomerParticipant = { name: '', email: '', phone: '', role: '' };
    this.customParticipantPool = [];
    this.showProspectForm = false;
    this.showAddParticipantRow = false;
    this.newProspect = { name: '', contactName: '', contactEmail: '', contactPhone: '' };
    this.pickedCustomerId = this.customer?.id ?? '';

    if (this.existingMeetingId) {
      this.loadExistingMeeting(this.existingMeetingId);
    } else {
      // New meeting: honor a slot the user clicked in the calendar, then clear it
      // so the next "New meeting" opened normally falls back to "now".
      if (this.workspace.pendingNewMeetingDate) {
        this.meetingDateLocal = this.toLocalInput(new Date(this.workspace.pendingNewMeetingDate));
        this.workspace.pendingNewMeetingDate = null;
      }
      if (this.customer) {
        this.form.customerId = this.customer.id;
      }
    }
  }

  private canCreateDraft(): boolean {
    const customerId = this.resolveCustomerId();
    return !!this.form.subject.trim() && !!customerId && !!this.meetingDateLocal;
  }

  private resolveCustomerId(): string {
    return this.customer?.id ?? this.pickedCustomerId;
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
      summary: this.summaryText,
      nextMeetingDate: this.fromLocalInput(this.nextMeetingDateLocal) || undefined,
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
    this.summaryText = meeting.summary ?? '';
    this.nextMeetingNotesText = meeting.nextMeetingNotes ?? '';
    this.meetingDateLocal = this.toLocalInput(new Date(meeting.meetingDate));
    this.nextMeetingDateLocal = meeting.nextMeetingDate
      ? this.toLocalInput(new Date(meeting.nextMeetingDate))
      : '';
    this.setupCollapsed = meeting.notes.length > 0 || meeting.status !== 'Planned';
    if (meeting.publishedRecap) {
      this.lastRecap = meeting.publishedRecap;
    }
    this.customParticipantPool = meeting.customerParticipants
      .filter(p => p.name?.trim())
      .map(p => ({ name: p.name.trim(), email: p.email?.trim() || undefined, phone: p.phone?.trim() || undefined, role: p.role?.trim() || undefined, key: this.customerParticipantKey(p) }));
  }

  private customerParticipantOptions(): CustomerParticipantOption[] {
    const byKey = new Map<string, CustomerParticipantOption>();
    const customer = this.selectedCustomerForPrep;
    if (customer?.primaryContactName?.trim()) {
      const seed: CustomerParticipant = {
        name: customer.primaryContactName.trim(),
        email: customer.primaryContactEmail?.trim() || undefined,
        role: undefined
      };
      byKey.set(this.customerParticipantKey(seed), {
        ...seed,
        key: this.customerParticipantKey(seed)
      });
    }

    if (customer) {
      for (const meeting of this.workspace.customerMeetingsByCustomer(customer.id)) {
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
          byKey.set(this.customerParticipantKey(item), {
            ...item,
            key: this.customerParticipantKey(item)
          });
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
    return {
      customerId: this.customer?.id ?? '',
      subject: '',
      meetingDate: new Date().toISOString(),
      meetingLeaderEmployeeId: this.workspace?.currentEmployeeId ?? '',
      internalParticipantEmployeeIds: [] as string[],
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
