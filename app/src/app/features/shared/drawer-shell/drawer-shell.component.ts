import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';

/**
 * Base stacking layer for drawers. Each drawer that opens is bumped one step
 * above the last so the most-recently-opened sheet always wins, regardless of
 * the order the drawer components appear in the DOM. The band stays small (and
 * resets when every drawer closes) so drawers never climb over overlays that
 * must sit above them, e.g. the calendar create-picker (950) or task-table
 * popovers (1045+).
 */
const DRAWER_BASE_Z = 900;

/**
 * Reusable bottom-sheet drawer shell.
 *
 * Single source of truth for the "slide up from the bottom" drawer interaction used
 * across the app (meeting drawer, task drawer, catch-up brief). It owns the backdrop,
 * the drag handle, the slide-up animation, and the dismiss behaviour (click-outside +
 * Escape). Feature content is projected via <ng-content>.
 *
 * Inputs:
 *  - open        → whether the drawer is visible.
 *  - ariaLabel   → accessible label for the dialog.
 *  - maxWidth    → CSS max-width of the sheet (default 960px).
 *  - bodyPadding → CSS padding applied inside the sheet. Pass '0' when the projected
 *                  content brings its own padding (e.g. the meeting form).
 *  - dismissable → when false, backdrop/Esc do not close (caller controls it).
 */
@Component({
  selector: 'app-drawer-shell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="open"
      class="ds-backdrop"
      role="presentation"
      [style.z-index]="zIndex"
      (click)="onBackdrop()"
    >
      <aside
        class="ds-sheet"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="ariaLabel"
        [style.max-width]="maxWidth"
        [style.padding]="bodyPadding"
        (click)="$event.stopPropagation()"
      >
        <div class="ds-handle" aria-hidden="true"></div>
        <ng-content></ng-content>
      </aside>
    </div>
  `,
  styles: [`
    .ds-backdrop {
      position: fixed;
      inset: 0;
      z-index: 900;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      background: rgba(12, 18, 16, 0.28);
      backdrop-filter: blur(6px);
      animation: dsFade 0.18s ease-out;
    }
    .ds-sheet {
      width: min(960px, 100vw);
      max-height: 92vh;
      overflow-y: auto;
      overflow-x: hidden;
      border: 1px solid var(--line);
      border-bottom: 0;
      border-radius: 20px 20px 0 0;
      background:
        radial-gradient(circle at top right, var(--accent-soft), transparent 24%),
        linear-gradient(180deg, var(--bg-sunken), transparent 34%),
        var(--bg-elevated);
      box-shadow: 0 -18px 45px rgba(24, 34, 31, 0.25);
      animation: dsSlideUp 0.28s cubic-bezier(0.22, 1, 0.36, 1);
      display: flex;
      flex-direction: column;
    }
    .ds-handle {
      flex-shrink: 0;
      width: 42px;
      height: 4px;
      border-radius: 999px;
      background: var(--line);
      margin: 2px auto 12px;
    }
    @keyframes dsSlideUp {
      from { transform: translateY(100%); opacity: 0.6; }
      to   { transform: translateY(0);    opacity: 1;   }
    }
    @keyframes dsFade {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @media (max-width: 720px) {
      .ds-sheet { max-height: 96vh; border-radius: 16px 16px 0 0; }
    }
  `]
})
export class DrawerShellComponent implements OnChanges, OnDestroy {
  /** Number of drawers currently open, shared across all shell instances. */
  private static activeCount = 0;
  /** Highest z-index handed out so far; resets to base when all drawers close. */
  private static topZ = DRAWER_BASE_Z;

  @Input() open = false;
  @Input() ariaLabel = '';
  @Input() maxWidth = '960px';
  @Input() bodyPadding = '14px 24px 24px';
  @Input() dismissable = true;
  @Output() closed = new EventEmitter<void>();

  /** Stacking layer for this drawer's backdrop; assigned when it opens. */
  zIndex = DRAWER_BASE_Z;
  /** Whether this instance is currently counted as open (guards double-counts). */
  private counted = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      this.syncStack(this.open);
    }
  }

  ngOnDestroy(): void {
    // A drawer torn down while still open must release its slot, or the shared
    // counter never returns to zero and the band would creep upward.
    this.syncStack(false);
  }

  /**
   * Keep the shared stack in sync with this drawer's open state. On open it
   * claims the next z-index above every other open drawer; on close it releases
   * its slot and resets the band once nothing is left open.
   */
  private syncStack(open: boolean): void {
    if (open && !this.counted) {
      this.counted = true;
      DrawerShellComponent.activeCount += 1;
      DrawerShellComponent.topZ += 1;
      this.zIndex = DrawerShellComponent.topZ;
    } else if (!open && this.counted) {
      this.counted = false;
      DrawerShellComponent.activeCount = Math.max(0, DrawerShellComponent.activeCount - 1);
      if (DrawerShellComponent.activeCount === 0) {
        DrawerShellComponent.topZ = DRAWER_BASE_Z;
      }
    }
  }

  onBackdrop(): void {
    if (this.dismissable) {
      this.closed.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open && this.dismissable) {
      this.closed.emit();
    }
  }
}
