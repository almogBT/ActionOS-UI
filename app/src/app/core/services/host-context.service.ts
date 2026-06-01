import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { ActionosLanguage } from '../i18n/actionos-i18n.service';
import { environment } from '../../../environments/environment';

const HOST_CONTEXT_STORAGE_KEY = 'actionos.host.context.v1';

export interface ActionosHostContext {
  token: string | null;
  lang: ActionosLanguage;
  selectedOrg: string | null;
  moduleSlugName: string | null;
  environmentName: string | null;
}

interface HostSetDataMessage {
  type: 'set-data';
  token?: string | null;
  lang?: string | null;
  selectedOrg?: string | null;
  moduleSlugName?: string | null;
  environmentName?: string | null;
}

interface LegacyAuthMessage {
  type: 'actionos:auth';
  token?: string | null;
}

function normalizeOrigin(value: string): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }

  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return null;
  }
}

function buildTrustedOrigins(): Set<string> {
  const origins = environment.trustedHostOrigins ?? [];
  const normalized = origins
    .map(origin => normalizeOrigin(origin))
    .filter((origin): origin is string => !!origin);
  return new Set(normalized);
}

@Injectable({ providedIn: 'root' })
export class HostContextService {
  private readonly trustedOrigins = buildTrustedOrigins();
  private readonly contextSubject = new BehaviorSubject<ActionosHostContext>(
    this.readFromStorage()
  );

  readonly context$: Observable<ActionosHostContext> = this.contextSubject.asObservable();
  readonly token$: Observable<string | null> = this.context$.pipe(
    map(ctx => ctx.token),
    distinctUntilChanged()
  );
  readonly selectedOrg$: Observable<string | null> = this.context$.pipe(
    map(ctx => ctx.selectedOrg),
    distinctUntilChanged()
  );
  readonly language$: Observable<ActionosLanguage> = this.context$.pipe(
    map(ctx => ctx.lang),
    distinctUntilChanged()
  );

  constructor() {
    this.listenForHostMessage();
  }

  get snapshot(): ActionosHostContext {
    return this.contextSubject.value;
  }

  merge(partial: Partial<ActionosHostContext>): void {
    const next = { ...this.contextSubject.value, ...partial };
    this.contextSubject.next(next);
    this.writeToStorage(next);
  }

  private listenForHostMessage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('message', (event: MessageEvent) => {
      if (!this.isTrustedOrigin(event.origin)) {
        return;
      }

      const data = event.data as HostSetDataMessage | LegacyAuthMessage | undefined;
      if (!data || typeof data !== 'object' || !('type' in data)) {
        return;
      }

      if (data.type === 'actionos:auth') {
        this.merge({
          token: typeof data.token === 'string' ? data.token : null
        });
        return;
      }

      if (data.type !== 'set-data') {
        return;
      }

      const lang = this.normalizeLanguage(data.lang);
      this.merge({
        token: typeof data.token === 'string' ? data.token : null,
        lang,
        selectedOrg: this.normalizeNullable(data.selectedOrg),
        moduleSlugName: this.normalizeNullable(data.moduleSlugName),
        environmentName: this.normalizeNullable(data.environmentName),
      });
    });
  }

  private normalizeLanguage(value: string | null | undefined): ActionosLanguage {
    return value === 'he' ? 'he' : 'en';
  }

  private normalizeNullable(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private isTrustedOrigin(origin: string): boolean {
    const normalized = normalizeOrigin(origin);
    return normalized !== null && this.trustedOrigins.has(normalized);
  }

  private readFromStorage(): ActionosHostContext {
    try {
      const raw = sessionStorage.getItem(HOST_CONTEXT_STORAGE_KEY);
      if (!raw) {
        return {
          token: null,
          lang: 'en',
          selectedOrg: null,
          moduleSlugName: null,
          environmentName: null
        };
      }
      const parsed = JSON.parse(raw) as Partial<ActionosHostContext>;
      return {
        token: typeof parsed.token === 'string' ? parsed.token : null,
        lang: parsed.lang === 'he' ? 'he' : 'en',
        selectedOrg: this.normalizeNullable(parsed.selectedOrg),
        moduleSlugName: this.normalizeNullable(parsed.moduleSlugName),
        environmentName: this.normalizeNullable(parsed.environmentName)
      };
    } catch {
      return {
        token: null,
        lang: 'en',
        selectedOrg: null,
        moduleSlugName: null,
        environmentName: null
      };
    }
  }

  private writeToStorage(context: ActionosHostContext): void {
    try {
      sessionStorage.setItem(HOST_CONTEXT_STORAGE_KEY, JSON.stringify(context));
    } catch {
      // Ignore storage failures in locked-down browser contexts.
    }
  }
}
