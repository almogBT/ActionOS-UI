import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CreateCustomerInput, Customer, CustomerStatus, CustomerType } from '../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../core/services/actionos-workspace.service';
import { SearchableSelectComponent, SelectOption } from '../../shared/searchable-select/searchable-select.component';
import {
  customerNameMatchesSearch,
  findSimilarCustomers,
  SimilarCustomerMatch
} from '../../core/utils/customer-name-match';

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
              [class.warn-action]="duplicateMatches.length"
              [disabled]="!newCustomer.name.trim()"
            >
              {{ (duplicateMatches.length ? 'customers.addAnyway' : 'customers.save') | t }}
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
              (ngModelChange)="onNewNameChanged()"
              [placeholder]="'customers.namePlaceholder' | t"
            />
          </label>

          <div
            class="dup-warning"
            *ngIf="duplicateMatches.length"
            (click)="$event.stopPropagation()"
          >
            <strong class="dup-warning-title">⚠ {{ 'customers.possibleDuplicateTitle' | t }}</strong>
            <p class="dup-warning-text">{{ 'customers.possibleDuplicateText' | t }}</p>
            <ul class="dup-warning-list">
              <li *ngFor="let match of duplicateMatches">
                <button type="button" class="dup-match" (click)="openExisting(match.customer)">
                  <span class="dup-match-name">{{ match.customer.name }}</span>
                  <small>{{ ('customerType.' + match.customer.type) | t }}</small>
                </button>
              </li>
            </ul>
          </div>

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
            (ngModelChange)="custList.scrollTop = 0"
            [placeholder]="'customers.searchPlaceholder' | t"
          />
          <button
            type="button"
            class="add-customer-btn"
            (click)="openAddModal()"
            [attr.aria-label]="'customers.addCustomer' | t"
            [title]="'customers.addCustomer' | t"
          >
            +
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

      <div class="workload-list" #custList>
        <button
          *ngFor="let c of filteredCustomers"
          type="button"
          class="workload-row workload-row-btn cust-row"
          (click)="viewBoard.emit(c)"
        >
          <span class="avatar">{{ initials(c.name) }}</span>
          <div>
            <strong>{{ c.name }}</strong>
            <small>{{ ('customerType.' + c.type) | t }} · {{ openTasksFor(c) }} {{ 'common.open' | t }}</small>
          </div>
        </button>

        <div *ngIf="!filteredCustomers.length" class="empty-state">
          <h3>{{ 'customers.noCustomersTitle' | t }}</h3>
          <p>{{ 'customers.noCustomersText' | t }}</p>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; height: 100%; }
    .panel { display: flex; flex-direction: column; height: 100%; }
    /* Grow to fill remaining panel height, scroll when content overflows. */
    .workload-list {
      flex: 1 1 0;
      min-height: 0;
      overflow-y: auto;
    }
    /* Reset button chrome for workload-style rows. */
    .workload-row-btn {
      width: 100%;
      text-align: start;
      background: none;
      border: 0;
      color: inherit;
      font: inherit;
      cursor: pointer;
      padding: 0;
    }
    .cust-row:hover { background: var(--surface-strong); border-radius: 8px; }
    .cust-row small { display: block; font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
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
    .search-input {
      background: var(--bg-elevated);
      border: 1px solid var(--line);
      color: var(--ink);
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      min-width: 240px;
    }
    .panel-header .topbar-actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .add-customer-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1px solid var(--accent);
      background: var(--accent);
      color: #fff;
      font-size: 22px;
      line-height: 1;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      flex: 0 0 auto;
    }
    .add-customer-btn:hover {
      filter: brightness(1.05);
    }
    .add-customer-btn:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    /* Duplicate-client warning shown inside the add modal. */
    .dup-warning {
      grid-column: 1 / -1;
      border: 1px solid #d9a400;
      background: rgba(217, 164, 0, 0.10);
      border-radius: 10px;
      padding: 10px 12px;
      margin-top: -4px;
    }
    .dup-warning-title { color: #8a6d00; font-size: 13px; }
    .dup-warning-text { margin: 4px 0 8px; font-size: 12px; color: var(--text-secondary); }
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
    .dup-match:hover { border-color: var(--accent); background: var(--accent-soft); }
    .dup-match-name { font-weight: 600; }
    .dup-match small { color: var(--text-secondary); font-size: 11px; }
    .warn-action { background: #d9a400; border-color: #d9a400; }
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
    @media (max-width: 480px) {
      .panel-header .topbar-actions {
        width: 100%;
      }
      .search-input {
        min-width: 0;
        flex: 1 1 auto;
      }
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
    const rawTerm = this.searchText.trim();
    const term = rawTerm.toLowerCase();
    let rows = this.workspace.customersByStatus(this.filter);
    if (rawTerm) {
      rows = rows.filter((c) => {
        return (
          // Name search is language-aware: matches across Hebrew/English too.
          customerNameMatchesSearch(c.name, rawTerm) ||
          c.primaryContactName?.toLowerCase().includes(term) ||
          c.primaryContactEmail?.toLowerCase().includes(term)
        );
      });
    }
    return this.sortCustomers(rows);
  }

  /**
   * Customers whose name looks like the one being entered — including the same
   * name written in the other language. Drives the duplicate warning in the modal.
   */
  get duplicateMatches(): SimilarCustomerMatch<Customer>[] {
    return findSimilarCustomers(this.newCustomer.name, this.workspace.customers);
  }

  /** Re-evaluates duplicate matches as the user types (the getter handles the work). */
  onNewNameChanged(): void {
    // No-op body: bound for change detection; `duplicateMatches` recomputes reactively.
  }

  /** Lets the user jump to an existing match instead of creating a duplicate. */
  openExisting(customer: Customer): void {
    this.closeAddModal();
    this.viewBoard.emit(customer);
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
