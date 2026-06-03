import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/** One selectable view inside a stat popup (e.g. Meetings / Tasks). */
export interface StatModalView {
  /** Stable id the caller switches its body on (bound to [(activeView)]). */
  id: string;
  /** Already-translated label shown on the toggle segment. */
  label: string;
  /** Item count shown as a quiet badge on the segment. */
  count: number;
}

/**
 * Shared shell for every "stat tile" popup in the app (Home metrics, Meetings
 * KPIs, client/member board preview). Owns the backdrop, card, header and the
 * single segmented view-switch — so the three former popups no longer each
 * carry their own copy of this chrome.
 *
 * Layout:
 *   ┌ eyebrow + title ─────────────── [ …caller actions… ] [ Close ] ┐
 *   │ ◖ View A (n) ◗ ◖ View B (n) ◗   (only when >1 view)             │
 *   │ <ng-content> — the active view's body                           │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * The body is projected by the caller and switched with *ngIf on the
 * two-way-bound `activeView`, so a single popup can "alternate" between a
 * meetings view and a tasks view when an entity has both.
 */
@Component({
  selector: 'app-stat-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stat-modal-backdrop" role="presentation" (click)="close.emit()">
      <aside
        class="stat-modal-card"
        role="dialog"
        [attr.aria-label]="title"
        (click)="$event.stopPropagation()"
      >
        <header class="stat-modal-header">
          <div class="stat-modal-heading">
            <span class="eyebrow" *ngIf="eyebrow">{{ eyebrow }}</span>
            <h2>{{ title }}</h2>
          </div>
          <div class="stat-modal-actions">
            <ng-content select="[statActions]"></ng-content>
            <button type="button" class="ghost-action" (click)="close.emit()">
              {{ closeLabel }}
            </button>
          </div>
        </header>

        <!-- Segmented view switch — shown only when there's more than one view -->
        <div
          class="stat-modal-switch"
          *ngIf="views.length > 1"
          role="tablist"
          [attr.aria-label]="title"
        >
          <button
            *ngFor="let v of views"
            type="button"
            role="tab"
            [class.active]="activeView === v.id"
            [attr.aria-selected]="activeView === v.id"
            (click)="selectView(v.id)"
          >
            <span class="switch-label">{{ v.label }}</span>
            <span class="switch-count">{{ v.count }}</span>
          </button>
        </div>

        <div class="stat-modal-body">
          <ng-content></ng-content>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .stat-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(20, 30, 50, 0.45);
      display: grid;
      place-items: center;
      z-index: 50;
      padding: 1rem;
    }

    .stat-modal-card {
      background: var(--bg-elevated);
      border: 1px solid var(--line);
      border-radius: 16px;
      box-shadow: var(--shadow);
      max-width: 680px;
      width: 100%;
      max-height: 85vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 22px;
    }

    .stat-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }

    .stat-modal-heading .eyebrow {
      color: var(--muted);
      letter-spacing: 0.05em;
    }

    .stat-modal-heading h2 { margin: 2px 0 0; font-size: 20px; }

    /* One tidy action row: caller's buttons + the built-in Close, all equal
       pills on a single line (they wrap together on narrow widths). */
    .stat-modal-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .stat-modal-actions .ghost-action,
    .stat-modal-actions .primary-action { min-height: 34px; font-size: 13px; }

    /* Segmented control — a single rounded track holding the view segments,
       so it reads as ONE switch rather than a second row of loose buttons. */
    .stat-modal-switch {
      display: inline-flex;
      align-self: flex-start;
      gap: 4px;
      padding: 4px;
      border-radius: 999px;
      background: var(--surface-strong);
      border: 1px solid var(--line);
    }

    .stat-modal-switch button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      padding: 0 16px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
      transition: background var(--duration-fast) var(--ease-out),
        color var(--duration-fast) var(--ease-out);
    }

    .stat-modal-switch button:hover { color: var(--ink); }

    .stat-modal-switch button.active {
      background: var(--bg-elevated);
      color: var(--accent);
      box-shadow: 0 2px 8px rgba(24, 34, 31, 0.10);
    }

    .switch-count {
      min-width: 20px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--surface-strong);
      color: var(--muted);
      font-size: 11px;
      text-align: center;
    }
    .stat-modal-switch button.active .switch-count {
      background: var(--accent-soft);
      color: var(--accent);
    }

    /* Visible overflow so the embedded task-table's status popovers aren't
       clipped — the card scrolls instead. */
    .stat-modal-body {
      overflow: visible;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
    }
  `]
})
export class StatModalComponent {
  /** Small uppercase label above the title (already translated). */
  @Input() eyebrow = '';
  /** Popup title (already translated, or a raw entity name). */
  @Input() title = '';
  /** Translated label for the built-in Close button. */
  @Input() closeLabel = 'Close';
  /** Views to switch between. 0–1 → no toggle; ≥2 → segmented switch. */
  @Input() views: StatModalView[] = [];
  /** Currently selected view id (two-way bound). */
  @Input() activeView = '';
  @Output() activeViewChange = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  selectView(id: string): void {
    if (id === this.activeView) return;
    this.activeView = id;
    this.activeViewChange.emit(id);
  }
}
