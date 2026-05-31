import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CreateCustomerInput, Customer, CustomerStatus, CustomerType } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';

type CustomerFilter = 'all' | CustomerType | CustomerStatus;
type SortColumn = 'name' | 'openTasks';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, SearchableSelectComponent],
  template: `
    <div
      *ngIf="showAddModal"
      class="modal-backdrop"
      role="presentation"
      (click)="closeAddModal()"
    >
      <form
        class="modal-card task-capture"
        role="dialog"
        aria-label="Add client"
        (ngSubmit)="addCustomer()"
        (click)="$event.stopPropagation()"
      >
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
            <button type="button" class="ghost-action" (click)="closeAddModal()">
              {{ 'common.close' | t }}
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
            <app-searchable-select
              name="custType"
              [(ngModel)]="newCustomer.type"
              [options]="customerTypeOptions"
            ></app-searchable-select>
          </label>

          <label
            class="field-control"
            *ngIf="newCustomer.type === 'Existing'"
            (click)="$event.stopPropagation()"
          >
            {{ 'customers.externalGroup' | t }}
            <app-searchable-select
              name="custGroup"
              [(ngModel)]="newCustomer.externalGroupId"
              [options]="externalGroupOptions"
              [placeholder]="'customers.selectExternalGroup' | t"
            ></app-searchable-select>
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
            <app-searchable-select
              name="custOwner"
              [(ngModel)]="newCustomer.accountOwnerEmployeeId"
              [options]="accountOwnerOptions"
            ></app-searchable-select>
          </label>
        </div>
      </form>
    </div>

    <section class="panel">
      <div class="panel-header">
        <h3>{{ 'customers.title' | t }}</h3>
        <div class="topbar-actions">
          <input
            type="search"
            class="search-input"
            [(ngModel)]="searchText"
            [placeholder]="'customers.searchPlaceholder' | t"
          />
          <button type="button" class="primary-action" (click)="openAddModal()">
            {{ 'customers.addCustomer' | t }}
          </button>
        </div>
      </div>

      <div class="cust-filters">
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
          <button type="button" class="sort-head" (click)="sortBy('name')">
            {{ 'customers.name' | t }}<span class="sort-arrow">{{ sortArrow('name') }}</span>
          </button>
          <button type="button" class="sort-head numeric" (click)="sortBy('openTasks')">
            {{ 'customers.openTasks' | t }}<span class="sort-arrow">{{ sortArrow('openTasks') }}</span>
          </button>
        </div>

        <div
          *ngFor="let c of filteredCustomers"
          class="table-row customer-row customer-table-row"
          (click)="viewBoard.emit(c)"
        >
          <span class="member-cell">
            <span class="avatar">{{ initials(c.name) }}</span>
            <strong>{{ c.name }}</strong>
          </span>
          <span class="numeric">{{ openTasksFor(c) }}</span>
        </div>
      </div>

      <div *ngIf="!filteredCustomers.length" class="empty-state">
        <h3>{{ 'customers.noCustomersTitle' | t }}</h3>
        <p>{{ 'customers.noCustomersText' | t }}</p>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; height: 100%; }
    .panel { display: flex; flex-direction: column; height: 100%; }
    /* Custom 2-col layout for the customer table; overrides the global .table-row grid. */
    .customer-table-row {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) 80px;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-width: 0;
      padding: 10px 12px;
    }
    /* Cap the table height so a long customer/member list doesn't stretch the
       whole page — scroll inside instead, with the header pinned. */
    .table-scroll {
      overflow-y: auto;
      overflow-x: hidden;
      /* Match the Home team-workload card height budget so Customers does not
         become the row height driver. */
      max-height: 320px;
      margin: 0 -12px;
      padding: 0 12px;
    }
    .table-scroll .table-head {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--bg-elevated);
    }
    /* Add-client popup, mirrors the note-detail modal styling. */
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
      max-width: 640px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 20px;
    }
    /* Sortable header cells render as bare buttons so the table head still
       aligns to the same grid columns as the data rows. */
    .sort-head {
      background: none;
      border: 0;
      padding: 0;
      margin: 0;
      font: inherit;
      color: inherit;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      text-align: start;
    }
    .sort-head.numeric { justify-content: center; text-align: center; width: 100%; }
    .sort-head:hover { color: var(--ink); }
    .sort-arrow { font-size: 10px; min-width: 8px; color: var(--muted); }
    .customer-row { cursor: pointer; }
    .customer-row:hover { background: var(--surface-strong); }
    .customer-row .numeric {
      display: block;
      width: 100%;
      text-align: center;
      font-variant-numeric: tabular-nums;
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
    .cust-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
    }
    .cust-filters button {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 500;
      background: var(--bg-elevated);
      border: 1px solid var(--line);
      color: var(--text-secondary);
      cursor: pointer;
      transition: background 160ms, color 160ms, border-color 160ms;
    }
    .cust-filters button:hover {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent);
    }
    .cust-filters button.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    /* Stack rows on narrow viewports — table-style is unreadable below ~480px. */
    @media (max-width: 480px) {
      .customer-table-row {
        grid-template-columns: 1fr;
        gap: 4px;
        padding: 12px;
      }
      .customer-table-row.table-head { display: none; }
      .customer-row { border: 1px solid var(--line); border-radius: 8px; margin-bottom: 8px; }
      .customer-row .numeric { text-align: start; }
      .search-input { min-width: 100%; }
      .table-scroll { overflow-x: visible; margin: 0; padding: 0; }
    }
  `]
})
export class CustomerListComponent {
  @Output() openCustomer = new EventEmitter<Customer>();
  /** Emitted when the row is clicked — opens the board preview popup on Home. */
  @Output() viewBoard = new EventEmitter<Customer>();

  readonly filters: CustomerFilter[] = ['all', 'Existing', 'Prospect', 'At Risk'];
  filter: CustomerFilter = 'all';
  searchText = '';
  showAdvanced = false;
  showAddModal = false;
  sortColumn: SortColumn = 'name';
  sortDir: SortDir = 'asc';
  newCustomer: CreateCustomerInput = this.emptyCustomer();

  constructor(public workspace: ActionosWorkspaceService, private i18n: ActionosI18nService) {}

  get customerTypeOptions(): SelectOption[] {
    return [
      { value: 'Existing', label: this.i18n.translate('customerType.Existing') },
      { value: 'Prospect', label: this.i18n.translate('customerType.Prospect') }
    ];
  }

  get externalGroupOptions(): SelectOption[] {
    return [
      { value: undefined, label: '—' },
      ...this.workspace.externalCustomerGroups.map(g => ({ value: g.id, label: g.name }))
    ];
  }

  get accountOwnerOptions(): SelectOption[] {
    return [
      { value: undefined, label: '—' },
      ...this.workspace.employees.map(e => ({ value: e.id, label: e.fullName }))
    ];
  }

  get filteredCustomers(): Customer[] {
    const term = this.searchText.trim().toLowerCase();
    let rows = this.workspace.customersByStatus(this.filter);
    if (term) {
      rows = rows.filter((c) => {
        return (
          c.name.toLowerCase().includes(term) ||
          c.primaryContactName?.toLowerCase().includes(term) ||
          c.primaryContactEmail?.toLowerCase().includes(term)
        );
      });
    }
    return this.sortCustomers(rows);
  }

  /** Toggles direction when re-clicking the active column, else sorts that column ascending. */
  sortBy(column: SortColumn): void {
    if (this.sortColumn === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDir = 'asc';
    }
  }

  sortArrow(column: SortColumn): string {
    if (this.sortColumn !== column) {
      return '';
    }
    return this.sortDir === 'asc' ? '▲' : '▼';
  }

  /** Returns a new, sorted array so the workspace repo data is never mutated in place. */
  private sortCustomers(rows: Customer[]): Customer[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => this.compare(a, b) * dir);
  }

  private compare(a: Customer, b: Customer): number {
    switch (this.sortColumn) {
      case 'openTasks':
        return this.openTasksFor(a) - this.openTasksFor(b);
      case 'name':
      default:
        return a.name.localeCompare(b.name);
    }
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

  openAddModal(): void {
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
  }

  addCustomer(): void {
    if (!this.newCustomer.name.trim()) {
      return;
    }
    this.workspace.addCustomer(this.newCustomer);
    this.newCustomer = this.emptyCustomer();
    this.closeAddModal();
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
