import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Customer } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { CustomerMeetingFormComponent, MeetingFormSavedEvent } from '../customers/customer-meeting-form.component';

@Component({
  selector: 'app-meeting-drawer',
  standalone: true,
  imports: [CommonModule, CustomerMeetingFormComponent],
  template: `
    <div
      *ngIf="workspace.meetingModalOpen"
      class="meeting-modal-backdrop"
      role="presentation"
      (click)="workspace.closeMeetingDrawer()"
    >
      <div
        class="meeting-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Meeting"
        (click)="$event.stopPropagation()"
      >
        <div class="meeting-modal-handle"></div>

        <app-customer-meeting-form
          *ngIf="workspace.openMeetingId"
          [existingMeetingId]="workspace.openMeetingId"
          (saved)="onSaved($event)"
          (cancelled)="workspace.closeMeetingDrawer()"
        />

        <app-customer-meeting-form
          *ngIf="workspace.openNewMeetingCustomerId !== null && !workspace.openMeetingId"
          [customer]="preselectedCustomer"
          (saved)="onSaved($event)"
          (cancelled)="workspace.closeMeetingDrawer()"
        />
      </div>
    </div>
  `,
  styles: [`
    .meeting-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 900;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    .meeting-modal {
      width: 100%;
      max-width: 960px;
      max-height: 92vh;
      background: var(--surface);
      border-radius: 20px 20px 0 0;
      overflow-y: auto;
      overflow-x: hidden;
      box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.18);
      animation: meetingSlideUp 0.28s cubic-bezier(0.22, 1, 0.36, 1);
      display: flex;
      flex-direction: column;
    }

    .meeting-modal-handle {
      flex-shrink: 0;
      width: 40px;
      height: 4px;
      background: var(--border-subtle, #d1d5db);
      border-radius: 2px;
      margin: 10px auto 4px;
    }

    @keyframes meetingSlideUp {
      from { transform: translateY(100%); opacity: 0.6; }
      to   { transform: translateY(0);    opacity: 1;   }
    }

    @media (max-width: 720px) {
      .meeting-modal { max-height: 96vh; border-radius: 16px 16px 0 0; }
    }
  `]
})
export class MeetingDrawerComponent {
  constructor(public workspace: ActionosWorkspaceService) {}

  get preselectedCustomer(): Customer | null {
    const id = this.workspace.openNewMeetingCustomerId;
    if (!id) return null;
    return this.workspace.customer(id) ?? null;
  }

  onSaved(event: MeetingFormSavedEvent): void {
    if (event.intent === 'close') {
      this.workspace.closeMeetingDrawer();
    } else {
      // 'continue': switch from new-meeting mode to editing the just-saved meeting
      this.workspace.openNewMeetingCustomerId = null;
      this.workspace.openMeetingId = event.meetingId;
    }
  }
}
