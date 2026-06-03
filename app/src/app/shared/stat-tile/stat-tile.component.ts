import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IconComponent, IconName } from '../icons/icon.component';

/**
 * The one stat/KPI tile used across ActionOS (Tasks, Meetings, My Work). Tiles
 * sit in a `.stat-tile-row` (a single non-wrapping flex row, styled globally in
 * styles.scss). Each tile is its own container query: when it gets too narrow
 * for the text it collapses to just the icon — so a row of tiles always stays
 * on one line and degrades gracefully instead of wrapping.
 */
@Component({
  selector: 'app-stat-tile',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <button
      type="button"
      class="stat-tile"
      [class.tone-danger]="tone === 'danger'"
      [class.is-zero]="zero"
      [title]="label + ': ' + value"
      [attr.aria-label]="label + ': ' + value"
      (click)="tileClick.emit()"
    >
      <span class="stat-tile-icon"><app-icon [name]="icon" [size]="18"></app-icon></span>
      <span class="stat-tile-text">
        <strong>{{ value }}</strong>
        <small>{{ label }}</small>
      </span>
    </button>
  `,
  styles: [`
    :host { display: block; flex: 1 1 0; min-width: 0; container-type: inline-size; }

    .stat-tile {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: var(--bg-elevated);
      cursor: pointer;
      text-align: start;
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.05s;
    }
    .stat-tile:hover { border-color: var(--muted); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .stat-tile:active { transform: translateY(1px); }
    .stat-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    .stat-tile-icon {
      flex-shrink: 0;
      display: inline-flex;
      width: 36px; height: 36px;
      align-items: center; justify-content: center;
      border-radius: 10px;
      background: var(--surface-strong);
      color: var(--muted);
    }

    .stat-tile-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .stat-tile-text strong { font-size: 24px; font-weight: 700; color: var(--ink); line-height: 1.05; }
    .stat-tile-text small {
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .tone-danger .stat-tile-text strong { color: var(--danger); }
    .tone-danger .stat-tile-icon { background: var(--danger-soft); color: var(--danger); }
    .is-zero { opacity: 0.6; }

    /* No room for the text → show just the icon (centered). */
    @container (max-width: 138px) {
      .stat-tile { justify-content: center; padding: 12px; }
      .stat-tile-text { display: none; }
    }
  `]
})
export class StatTileComponent {
  @Input() icon: IconName = 'check-square';
  @Input() value: string | number = 0;
  @Input() label = '';
  @Input() tone: 'normal' | 'danger' = 'normal';
  @Input() zero = false;
  @Output() tileClick = new EventEmitter<void>();
}
