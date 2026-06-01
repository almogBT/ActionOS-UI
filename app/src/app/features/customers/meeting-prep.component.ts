import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Customer, Task } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { MeetingPrepBriefComponent } from './meeting-prep-brief.component';

@Component({
  selector: 'app-meeting-prep',
  standalone: true,
  imports: [CommonModule, TranslatePipe, MeetingPrepBriefComponent],
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

      <app-meeting-prep-brief
        variant="full"
        [customerId]="customer.id"
        (openTask)="openTask($event)"
      ></app-meeting-prep-brief>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
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

  openTask(task: Task): void {
    this.workspace.selectMeetingTask(task, true);
  }

  print(): void {
    window.print();
  }
}
