import {
  Customer,
  CreateCustomerInput,
  CustomerStatus,
  CustomerType,
} from '../models/actionos.models';

/**
 * Boundary for customer storage.
 *
 * Future Fritz/Azure implementation: query reportcental.[dig].[Servitz_Customers_Groups]
 * through HomePage_Server. ActionOS never reads the DB directly.
 *
 * The "customer GROUP IS the customer" rule applies — externalGroupId is the FK to
 * Servitz_Customers_Groups.id. A null externalGroupId means the record is a prospect
 * captured inside ActionOS that has not yet been linked to a real customer group.
 */
export interface CustomerRepositoryPort {
  list(): Customer[];
  get(id: string): Customer | undefined;
  add(input: CreateCustomerInput): Customer;
  update(id: string, changes: Partial<Customer>): Customer | null;
  promoteProspect(id: string, externalGroupId: string): Customer | null;
}

interface CustomerState {
  customers: Customer[];
}

export class InMemoryCustomerRepository implements CustomerRepositoryPort {
  constructor(
    private readonly state: CustomerState,
    private readonly save: () => void,
    private readonly idFactory: () => string,
    private readonly now: () => string,
  ) {}

  list(): Customer[] {
    return this.state.customers.slice();
  }

  get(id: string): Customer | undefined {
    return this.state.customers.find((c) => c.id === id);
  }

  add(input: CreateCustomerInput): Customer {
    const timestamp = this.now();
    const status: CustomerStatus = input.type === 'Prospect' ? 'Prospect' : 'Active';
    const customer: Customer = {
      id: this.idFactory(),
      externalGroupId: input.externalGroupId ?? null,
      name: input.name.trim(),
      type: input.type,
      status,
      primaryContactName: input.primaryContactName?.trim(),
      primaryContactEmail: input.primaryContactEmail?.trim(),
      primaryContactPhone: input.primaryContactPhone?.trim(),
      accountOwnerEmployeeId: input.accountOwnerEmployeeId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.state.customers.push(customer);
    this.save();
    return customer;
  }

  update(id: string, changes: Partial<Customer>): Customer | null {
    const target = this.state.customers.find((c) => c.id === id);
    if (!target) {
      return null;
    }
    Object.assign(target, changes, { updatedAt: this.now() });
    this.save();
    return target;
  }

  promoteProspect(id: string, externalGroupId: string): Customer | null {
    const target = this.state.customers.find((c) => c.id === id);
    if (!target || target.type !== 'Prospect') {
      return null;
    }
    target.externalGroupId = externalGroupId;
    target.type = 'Existing';
    target.status = 'Active';
    target.updatedAt = this.now();
    this.save();
    return target;
  }
}

export function isValidCustomerType(value: string): value is CustomerType {
  return value === 'Existing' || value === 'Prospect';
}
