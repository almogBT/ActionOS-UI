import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { CustomerMeetingFormComponent, MeetingFormSavedEvent } from '../customers/customer-meeting-form.component';

@Component({
  selector: 'app-meeting-drawer',
  standalone: true,
  imports: [CommonModule, TranslatePipe, CustomerMeetingFormComponent],
  template: `
    <div
      *ngIf="workspace.openMeetingId"
      class="drawer-backdrop"
      role="presentation"
      (click)="workspace.closeMeetingDrawer()"
    >
      <aside
        class="meeting-drawer"
        role="dialog"
        aria-label="Meeting details"
        (click)="$event.stopPropagation()"
      >
        <app-customer-meeting-form
          [existingMeetingId]="workspace.openMeetingId"
          (saved)="onSaved($event)"
          (cancelled)="workspace.closeMeetingDrawer()"
        />
      </aside>
    </div>
  `
})
export class MeetingDrawerComponent {
  constructor(public workspace: ActionosWorkspaceService) {}

  onSaved(event: MeetingFormSavedEvent): void {
    if (event.intent === 'close') {
      this.workspace.closeMeetingDrawer();
    }
  }
}
