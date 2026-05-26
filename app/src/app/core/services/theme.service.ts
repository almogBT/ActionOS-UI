import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, computed, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'actionos.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _preference = signal<ThemePreference>(this.loadStored());
  private readonly _systemDark = signal<boolean>(this.detectSystemDark());

  readonly preference = this._preference.asReadonly();
  readonly effective = computed<EffectiveTheme>(() => {
    const pref = this._preference();
    if (pref === 'system') {
      return this._systemDark() ? 'dark' : 'light';
    }
    return pref;
  });

  constructor(@Inject(DOCUMENT) private readonly doc: Document) {
    this.applyToDom();
    this.watchSystem();
  }

  setPreference(pref: ThemePreference): void {
    this._preference.set(pref);
    try {
      this.doc.defaultView?.localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* ignore */
    }
    this.applyToDom();
  }

  cycle(): void {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(this._preference()) + 1) % order.length];
    this.setPreference(next);
  }

  private applyToDom(): void {
    const root = this.doc.documentElement;
    root.dataset['theme'] = this.effective();
  }

  private loadStored(): ThemePreference {
    try {
      const value = this.doc?.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (value === 'light' || value === 'dark' || value === 'system') {
        return value;
      }
    } catch {
      /* ignore */
    }
    return 'system';
  }

  private detectSystemDark(): boolean {
    try {
      return !!this.doc?.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  }

  private watchSystem(): void {
    try {
      const mql = this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)');
      if (!mql) return;
      const handler = (event: MediaQueryListEvent) => {
        this._systemDark.set(event.matches);
        this.applyToDom();
      };
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', handler);
      } else if (typeof (mql as MediaQueryList & { addListener?: unknown }).addListener === 'function') {
        (mql as unknown as { addListener: (cb: (event: MediaQueryListEvent) => void) => void }).addListener(handler);
      }
    } catch {
      /* ignore */
    }
  }
}
