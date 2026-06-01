import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Customer } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { Customer360Component } from './customer-360.component';
import { MeetingPrepComponent } from './meeting-prep.component';

// 'list' is no longer hosted here — the customer list lives on the Home screen.
export type CustomersSubView = 'detail' | 'prep';

/**
 * Customer detail container. Since the customer list moved onto the Home
 * screen, this view is only ever entered for a specific customer (passed in
 * via [initialCustomer]). Its "back" action returns to Home rather than to an
 * in-module list. Still uses ngSwitch sub-view routing (no router), matching
 * the existing prototype navigation pattern.
 */
@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    Customer360Component,
    MeetingPrepComponent
  ],
  template: `
    <section class="screen" *ngIf="activeCustomer as customer">
      <div class="screen-title">
        <div>
          <span class="eyebrow">{{ 'customers.eyebrow' | t }}</span>
          <h2>{{ pageTitle | t }}</h2>
        </div>
        <div class="topbar-actions">
          <button type="button" class="ghost-action" (click)="backToHome()">
            {{ 'customer360.backToHome' | t }}
          </button>
        </div>
      </div>

      <ng-container [ngSwitch]="subView">
        <app-customer-360
          *ngSwitchCase="'detail'"
          [customer]="customer"
          (newMeeting)="newMeetingFor($event)"
          (prepareMeeting)="prepareForCustomer($event)"
        />

        <app-meeting-prep
          *ngSwitchCase="'prep'"
          [customer]="customer"
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
export class CustomersComponent implements OnChanges {
  /** The customer to open, handed off from the Home screen list. */
  @Input() initialCustomer: Customer | null = null;
  /** Which sub-view to land on: detail (default) or meeting prep. */
  @Input() initialView: CustomersSubView = 'detail';
  /** Emitted when the user leaves the detail flow — AppComponent returns to Home. */
  @Output() exit = new EventEmitter<void>();

  subView: CustomersSubView = 'detail';
  activeCustomer: Customer | null = null;

  constructor(public workspace: ActionosWorkspaceService) {}

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.initialCustomer) {
      this.activeCustomer = this.initialCustomer;
      this.subView = this.initialView;
    } else {
      // No customer to show — bounce back to Home.
      this.exit.emit();
    }
  }

  get pageTitle(): string {
    switch (this.subView) {
      case 'prep':
        return 'meetingPrep.title';
      default:
        return 'customer360.title';
    }
  }

  newMeetingFor(customer: Customer): void {
    this.workspace.openNewMeetingModal(customer.id);
  }

  prepareForCustomer(customer: Customer): void {
    this.activeCustomer = customer;
    this.subView = 'prep';
  }

  backToHome(): void {
    this.exit.emit();
  }

  returnToDetail(): void {
    if (this.activeCustomer) {
      this.subView = 'detail';
    } else {
      this.backToHome();
    }
  }
}
