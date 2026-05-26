import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Customer } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { CustomerListComponent } from './customer-list.component';
import { Customer360Component } from './customer-360.component';
import { CustomerMeetingFormComponent } from './customer-meeting-form.component';
import { MeetingPrepComponent } from './meeting-prep.component';

export type CustomersSubView = 'list' | 'detail' | 'meeting-form' | 'prep';

/**
 * Top-level Customers container. Owns sub-view routing for the new module
 * without introducing a router — matches the existing prototype's ngSwitch
 * navigation pattern (see app.component.html).
 */
@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    CustomerListComponent,
    Customer360Component,
    CustomerMeetingFormComponent,
    MeetingPrepComponent
  ],
  template: `
    <section class="screen">
      <div class="screen-title">
        <div>
          <span class="eyebrow">{{ 'customers.eyebrow' | t }}</span>
          <h2>{{ pageTitle | t }}</h2>
        </div>
        <div class="topbar-actions" *ngIf="subView !== 'list'">
          <button type="button" class="ghost-action" (click)="goToList()">
            {{ 'customer360.backToList' | t }}
          </button>
        </div>
      </div>

      <ng-container [ngSwitch]="subView">
        <app-customer-list
          *ngSwitchCase="'list'"
          (openCustomer)="openCustomer($event)"
          (prepareMeeting)="prepareForCustomer($event)"
        />

        <app-customer-360
          *ngSwitchCase="'detail'"
          [customer]="activeCustomer!"
          (newMeeting)="newMeetingFor($event)"
          (prepareMeeting)="prepareForCustomer($event)"
        />

        <app-customer-meeting-form
          *ngSwitchCase="'meeting-form'"
          [customer]="activeCustomer!"
          (saved)="onMeetingSaved($event)"
          (cancelled)="returnToDetail()"
        />

        <app-meeting-prep
          *ngSwitchCase="'prep'"
          [customer]="activeCustomer!"
          (back)="returnToDetail()"
          (startMeeting)="newMeetingFor($event)"
        />
      </ng-container>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
  `]
})
export class CustomersComponent {
  subView: CustomersSubView = 'list';
  activeCustomer: Customer | null = null;

  constructor(public workspace: ActionosWorkspaceService) {}

  get pageTitle(): string {
    switch (this.subView) {
      case 'detail':
        return 'customer360.title';
      case 'meeting-form':
        return 'customerMeeting.title';
      case 'prep':
        return 'meetingPrep.title';
      default:
        return 'customers.title';
    }
  }

  openCustomer(customer: Customer): void {
    this.activeCustomer = customer;
    this.subView = 'detail';
  }

  newMeetingFor(customer: Customer): void {
    this.activeCustomer = customer;
    this.subView = 'meeting-form';
  }

  prepareForCustomer(customer: Customer): void {
    this.activeCustomer = customer;
    this.subView = 'prep';
  }

  goToList(): void {
    this.subView = 'list';
    this.activeCustomer = null;
  }

  returnToDetail(): void {
    if (this.activeCustomer) {
      this.subView = 'detail';
    } else {
      this.goToList();
    }
  }

  onMeetingSaved(_meetingId: string): void {
    this.returnToDetail();
  }
}
