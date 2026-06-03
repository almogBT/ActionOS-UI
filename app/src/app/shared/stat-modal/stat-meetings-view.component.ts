import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CustomerMeeting } from '../../core/models/actionos.models';
import { MeetingCardComponent } from '../meeting-card/meeting-card.component';

/**
 * The "meetings" body used inside a stat popup (Home board preview, Meetings &
 * My Work KPIs). Renders the shared <app-meeting-card> in a small grid so a
 * meeting looks identical here and everywhere else. The card self-opens the
 * meeting drawer; `meetingOpened` fires so the host popup can close itself.
 */
@Component({
  selector: 'app-stat-meetings-view',
  standalone: true,
  imports: [CommonModule, MeetingCardComponent],
  template: `
    <div *ngIf="meetings.length; else empty" class="stat-meeting-grid">
      <app-meeting-card
        *ngFor="let m of meetings"
        [meeting]="m"
        (opened)="meetingOpened.emit($event)"
      ></app-meeting-card>
    </div>

    <ng-template #empty>
      <div class="empty-state"><strong>{{ emptyText }}</strong></div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }

    .stat-meeting-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      align-items: start;
      gap: 10px;
    }

    .empty-state { padding: 1.5rem; text-align: center; color: var(--muted); }
  `]
})
export class StatMeetingsViewComponent {
  @Input() meetings: CustomerMeeting[] = [];
  /** Already-translated message shown when the list is empty. */
  @Input() emptyText = '';
  @Output() meetingOpened = new EventEmitter<CustomerMeeting>();
}
