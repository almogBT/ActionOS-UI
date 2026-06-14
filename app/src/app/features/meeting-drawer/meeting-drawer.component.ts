import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { DrawerShellComponent } from '../shared/drawer-shell/drawer-shell.component';
import { CustomerMeetingFormComponent, MeetingFormSavedEvent } from '../customers/customer-meeting-form.component';

@Component({
  selector: 'app-meeting-drawer',
  standalone: true,
  imports: [CommonModule, DrawerShellComponent, CustomerMeetingFormComponent],
  template: `
    <app-drawer-shell
      [open]="workspace.meetingModalOpen"
      ariaLabel="Meeting"
      bodyPadding="0"
      (closed)="workspace.closeMeetingDrawer()"
    >
      <app-customer-meeting-form
        *ngIf="workspace.openMeetingId"
        [existingMeetingId]="workspace.openMeetingId"
        [inDrawer]="true"
        (saved)="onSaved($event)"
        (cancelled)="workspace.closeMeetingDrawer()"
      />

      <app-customer-meeting-form
        *ngIf="workspace.openNewMeetingCustomerId !== null && !workspace.openMeetingId"
        [initialCustomerId]="workspace.openNewMeetingCustomerId"
        [inDrawer]="true"
        (saved)="onSaved($event)"
        (cancelled)="workspace.closeMeetingDrawer()"
      />
    </app-drawer-shell>
  `,
  styles: [``]
})
export class MeetingDrawerComponent {
  constructor(public workspace: ActionosWorkspaceService) {}

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
