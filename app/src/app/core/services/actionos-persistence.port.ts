export interface ActionosPersistencePort<TState> {
  load(): TState | null;
  save(state: TState): void;
  clear(): void;
}

export class LocalStorageActionosPersistence<TState> implements ActionosPersistencePort<TState> {
  constructor(private readonly storageKey: string) {}

  load(): TState | null {
    const rawState = localStorage.getItem(this.storageKey);

    if (!rawState) {
      return null;
    }

    try {
      return JSON.parse(rawState) as TState;
    } catch {
      this.clear();
      return null;
    }
  }

  save(state: TState): void {
    localStorage.setItem(this.storageKey, JSON.stringify(state));
  }

  clear(): void {
    localStorage.removeItem(this.storageKey);
  }
}
