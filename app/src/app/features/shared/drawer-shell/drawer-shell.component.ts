import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

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
export class DrawerShellComponent {
  @Input() open = false;
  @Input() ariaLabel = '';
  @Input() maxWidth = '960px';
  @Input() bodyPadding = '14px 24px 24px';
  @Input() dismissable = true;
  @Output() closed = new EventEmitter<void>();

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
