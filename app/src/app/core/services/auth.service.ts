import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { skip } from 'rxjs/operators';
import { HostContextService } from './host-context.service';

const TOKEN_STORAGE_KEY = 'actionos.auth.token';

/**
 * Holds the Azure B2C ID token that authenticates HomePage_Server requests.
 *
 * Token sources, in priority order:
 *   1. postMessage from a trusted parent window (the iframe handoff case)
 *   2. sessionStorage under `actionos.auth.token` (manual dev injection)
 *
 * For local development without an iframe parent, paste a fresh ID token from
 * a logged-in HomePage_Client session into the browser console:
 *
 *   sessionStorage.setItem('actionos.auth.token', '<paste token>');
 *   location.reload();
 */
@Injectable({ providedIn: 'root' })
export class ActionosAuthService {
  private readonly tokenSubject = new BehaviorSubject<string | null>(
    this.readFromStorage()
  );

  /** Emits only when the token actually changes after startup. */
  readonly tokenChanged$: Observable<string | null> = this.tokenSubject
    .asObservable()
    .pipe(skip(1));

  constructor(hostContext: HostContextService) {
    hostContext.token$.subscribe(token => {
      // Host context is authoritative once available.
      this.setToken(token);
    });
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  setToken(token: string | null): void {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    this.tokenSubject.next(token);
  }

  private readFromStorage(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
