import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CreateCustomerInput,
  Customer,
  CustomerStatus,
  CustomerType
} from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';

type CustomerFilter = 'all' | CustomerType | CustomerStatus;

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <section class="panel">
      <form class="task-capture" (ngSubmit)="addCustomer()">
        <div class="capture-header">
          <div>
            <span class="eyebrow">{{ 'customers.addCustomer' | t }}</span>
            <h3>{{ (showAdvanced ? 'customers.newCustomer' : 'customers.newProspect') | t }}</h3>
          </div>
          <div class="topbar-actions">
            <button
              type="button"
              class="ghost-action"
              (click)="toggleAdvanced(); $event.stopPropagation()"
            >
              {{ showAdvanced ? ('customerType.Prospect' | t) : ('customerType.Existing' | t) }}
            </button>
            <button
              type="submit"
              class="primary-action"
              [disabled]="!newCustomer.name.trim()"
            >
              {{ 'customers.save' | t }}
            </button>
          </div>
        </div>

        <div class="capture-grid">
          <label class="field-control" (click)="$event.stopPropagation()">
            {{ 'customers.name' | t }}
            <input
              name="custName"
              type="text"
              [(ngModel)]="newCustomer.name"
              [placeholder]="'customers.namePlaceholder' | t"
            />
          </label>

          <label class="field-control" (click)="$event.stopPropagation()">
            {{ 'customers.type' | t }}
            <select name="custType" [(ngModel)]="newCustomer.type">
              <option value="Existing">{{ 'customerType.Existing' | t }}</option>
              <option value="Prospect">{{ 'customerType.Prospect' | t }}</option>
            </select>
          </label>

          <label
            class="field-control"
            *ngIf="newCustomer.type === 'Existing'"
            (click)="$event.stopPropagation()"
          >
            {{ 'customers.externalGroup' | t }}
            <select name="custGroup" [(ngModel)]="newCustomer.externalGroupId">
              <option [ngValue]="undefined">{{ 'customers.selectExternalGroup' | t }}</option>
              <option *ngFor="let g of workspace.externalCustomerGroups" [value]="g.id">
                {{ g.name }}
              </option>
            </select>
          </label>

          <label class="field-control" (click)="$event.stopPropagation()">
            {{ 'customers.primaryContactName' | t }}
            <input name="custContact" type="text" [(ngModel)]="newCustomer.primaryContactName" />
          </label>

          <label class="field-control" (click)="$event.stopPropagation()">
            {{ 'customers.primaryContactEmail' | t }}
            <input name="custEmail" type="email" [(ngModel)]="newCustomer.primaryContactEmail" />
          </label>

          <label class="field-control" (click)="$event.stopPropagation()">
            {{ 'customers.primaryContactPhone' | t }}
            <input name="custPhone" type="tel" [(ngModel)]="newCustomer.primaryContactPhone" />
          </label>

          <label class="field-control" (click)="$event.stopPropagation()">
            {{ 'customers.accountOwner' | t }}
            <select name="custOwner" [(ngModel)]="newCustomer.accountOwnerEmployeeId">
              <option [ngValue]="undefined">—</option>
              <option *ngFor="let e of workspace.employees" [value]="e.id">
                {{ e.fullName }}
              </option>
            </select>
          </label>
        </div>
      </form>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <span class="eyebrow">{{ 'customers.search' | t }}</span>
          <h3>{{ 'customers.title' | t }}</h3>
        </div>
        <div class="topbar-actions">
          <input
            type="search"
            class="search-input"
            [(ngModel)]="searchText"
            [placeholder]="'customers.searchPlaceholder' | t"
          />
        </div>
      </div>

      <div class="tab-strip">
        <button
          type="button"
          *ngFor="let f of filters"
          [class.active]="filter === f"
          (click)="filter = f"
        >
          {{ filterLabel(f) | t }}
        </button>
      </div>

      <div class="table-scroll">
        <div class="table-row table-head customer-table-row">
          <span>{{ 'customers.name' | t }}</span>
          <span>{{ 'customers.type' | t }}</span>
          <span>{{ 'common.status' | t }}</span>
          <span>{{ 'customers.accountOwner' | t }}</span>
          <span class="numeric">{{ 'customers.openTasks' | t }}</span>
          <span></span>
        </div>

        <div
          *ngFor="let c of filteredCustomers"
          class="table-row customer-row customer-table-row"
          (click)="openCustomer.emit(c)"
        >
          <span class="member-cell">
            <span class="avatar">{{ initials(c.name) }}</span>
            <strong>{{ c.name }}</strong>
          </span>
          <span>{{ ('customerType.' + c.type) | t }}</span>
          <span>
            <span class="status-chip" [ngClass]="workspace.statusClass(c.status)">
              {{ ('customerStatus.' + c.status) | t }}
            </span>
          </span>
          <span class="ellipsis">{{ workspace.employeeName(c.accountOwnerEmployeeId) }}</span>
          <span class="numeric">{{ openTasksFor(c) }}</span>
          <span class="row-action">
            <button
              type="button"
              class="ghost-action small"
              (click)="$event.stopPropagation(); prepareMeeting.emit(c)"
            >
              {{ 'customers.prepareMeeting' | t }}
            </button>
          </span>
        </div>
      </div>

      <div *ngIf="!filteredCustomers.length" class="empty-state">
        <h3>{{ 'customers.noCustomersTitle' | t }}</h3>
        <p>{{ 'customers.noCustomersText' | t }}</p>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    /* Custom 6-col layout for the customer table; overrides the global .table-row grid. */
    .customer-table-row {
      display: grid;
      grid-template-columns: minmax(180px, 1.6fr) 110px 130px 150px 80px minmax(160px, auto);
      align-items: center;
      gap: 12px;
      min-width: 820px;
      padding: 10px 12px;
    }
    .table-scroll {
      overflow-x: auto;
      margin: 0 -12px;
      padding: 0 12px;
    }
    .customer-row { cursor: pointer; }
    .customer-row:hover { background: var(--surface-strong); }
    .customer-row .ellipsis {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .customer-row .numeric { text-align: end; font-variant-numeric: tabular-nums; }
    .customer-row .row-action { display: flex; justify-content: flex-end; }
    .row-action .ghost-action.small {
      padding: 6px 10px;
      font-size: 12px;
      white-space: nowrap;
    }
    .search-input {
      background: var(--bg-elevated);
      border: 1px solid var(--line);
      color: var(--ink);
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      min-width: 240px;
    }
    .empty-state { padding: 2rem; text-align: center; color: var(--muted); }
    /* Stack rows on narrow viewports — table-style is unreadable below ~640px. */
    @media (max-width: 720px) {
      .customer-table-row {
        grid-template-columns: 1fr;
        min-width: 0;
        gap: 4px;
        padding: 12px;
      }
      .customer-table-row.table-head { display: none; }
      .customer-row { border: 1px solid var(--line); border-radius: 8px; margin-bottom: 8px; }
      .customer-row .numeric { text-align: start; }
      .customer-row .row-action { justify-content: flex-start; }
      .search-input { min-width: 100%; }
      .table-scroll { overflow-x: visible; margin: 0; padding: 0; }
    }
  `]
})
export class CustomerListComponent {
  @Output() openCustomer = new EventEmitter<Customer>();
  @Output() prepareMeeting = new EventEmitter<Customer>();

  readonly filters: CustomerFilter[] = ['all', 'Existing', 'Prospect', 'At Risk'];
  filter: CustomerFilter = 'all';
  searchText = '';
  showAdvanced = false;
  newCustomer: CreateCustomerInput = this.emptyCustomer();

  constructor(public workspace: ActionosWorkspaceService) {}

  get filteredCustomers(): Customer[] {
    const term = this.searchText.trim().toLowerCase();
    const filtered = this.workspace.customersByStatus(this.filter);
    if (!term) {
      return filtered;
    }
    return filtered.filter((c) => {
      return (
        c.name.toLowerCase().includes(term) ||
        c.primaryContactName?.toLowerCase().includes(term) ||
        c.primaryContactEmail?.toLowerCase().includes(term)
      );
    });
  }

  filterLabel(filter: CustomerFilter): string {
    if (filter === 'all') {
      return 'customers.filterAll';
    }
    if (filter === 'Existing' || filter === 'Prospect') {
      return 'customerType.' + filter;
    }
    return 'customerStatus.' + filter;
  }

  toggleAdvanced(): void {
    this.showAdvanced = !this.showAdvanced;
    this.newCustomer.type = this.showAdvanced ? 'Existing' : 'Prospect';
  }

  addCustomer(): void {
    if (!this.newCustomer.name.trim()) {
      return;
    }
    this.workspace.addCustomer(this.newCustomer);
    this.newCustomer = this.emptyCustomer();
  }

  openTasksFor(customer: Customer): number {
    return this.workspace
      .meetingTasksByCustomer(customer.id)
      .filter((t) => this.workspace.isOpenMeetingTaskStatus(t.status)).length;
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  private emptyCustomer(): CreateCustomerInput {
    return {
      name: '',
      type: this.showAdvanced ? 'Existing' : 'Prospect'
    };
  }
}
