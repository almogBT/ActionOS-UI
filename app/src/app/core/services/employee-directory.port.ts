import { Employee } from '../models/actionos.models';

/**
 * Read-only employee directory.
 *
 * Future Fritz/Azure implementation: read reportcental.emp.EasyDoc_Employees_Dim
 * via HomePage_Server. Only rows where IsActive = 1 AND email is on a fritz/critilog
 * domain should ever be returned. ActionOS never writes to this source — the Fritz
 * HR system owns employee identity.
 */
export interface EmployeeDirectoryPort {
  list(): Employee[];
  get(id: string): Employee | undefined;
  isAssignable(id: string): boolean;
}

interface EmployeeState {
  employees: Employee[];
}

/**
 * Matches the rule from the Monday brief: only @fritz.* or @critilog.* emails count.
 */
export function hasFritzDomain(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  return /@(fritz|critilog)\./.test(normalized);
}

export class InMemoryEmployeeDirectory implements EmployeeDirectoryPort {
  constructor(private readonly state: EmployeeState) {}

  list(): Employee[] {
    return this.state.employees.filter((e) => e.isActive && hasFritzDomain(e.email));
  }

  get(id: string): Employee | undefined {
    return this.state.employees.find((e) => e.id === id);
  }

  isAssignable(id: string): boolean {
    const employee = this.get(id);
    if (!employee) {
      return false;
    }
    return employee.isActive && hasFritzDomain(employee.email);
  }
}
