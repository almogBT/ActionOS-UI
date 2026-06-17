import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ActionosI18nService } from '../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconComponent } from '../icons/icon.component';

/**
 * Lightweight chooser shown when an empty calendar time box is clicked on pages
 * that host *both* meetings and tasks (Home, My Work). The user picks what to
 * create at that slot; the host wires the two outputs to the matching creator.
 * On single-purpose pages (Meetings / Tasks) the picker is skipped entirely and
 * the creator is opened directly.
 *
 *   <app-calendar-create-picker
 *     [slot]="createSlot()"
 *     (chooseMeeting)="createMeeting($event)"
 *     (chooseTask)="createTask($event)"
 *     (cancel)="createSlot.set(null)"
 *   />
 */
@Component({
  selector: 'app-calendar-create-picker',
  standalone: true,
  imports: [CommonModule, TranslatePipe, IconComponent],
  template: `
    <div
      *ngIf="slot"
      class="ccp-backdrop"
      role="presentation"
      (click)="cancel.emit()"
    >
      <div
        class="ccp-dialog"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'calendar.createPrompt' | t"
        (click)="$event.stopPropagation()"
      >
        <span class="ccp-when">{{ slotLabel }}</span>
        <h3 class="ccp-title">{{ 'calendar.createPrompt' | t }}</h3>

        <div class="ccp-options">
          <button type="button" class="ccp-option" (click)="chooseMeeting.emit(slot!)">
            <app-icon name="calendar" [size]="22"></app-icon>
            <span>{{ 'common.meeting' | t }}</span>
          </button>
          <button type="button" class="ccp-option" (click)="chooseTask.emit(slot!)">
            <app-icon name="check-square" [size]="22"></app-icon>
            <span>{{ 'common.task' | t }}</span>
          </button>
        </div>

        <button type="button" class="ccp-cancel" (click)="cancel.emit()">
          {{ 'common.cancel' | t }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ccp-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      z-index: 950;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .ccp-dialog {
      width: 100%;
      max-width: 340px;
      background: var(--surface);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
      padding: 18px;
      display: grid;
      gap: 12px;
      animation: ccpPop 0.18s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .ccp-when {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: var(--muted);
    }
    .ccp-title { margin: 0; font-size: 16px; }
    .ccp-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .ccp-option {
      display: grid;
      justify-items: center;
      gap: 8px;
      padding: 16px 10px;
      border: 1px solid var(--line, var(--border-subtle));
      border-radius: 12px;
      background: var(--bg-elevated);
      color: var(--ink);
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: border-color 120ms ease, background 120ms ease;
    }
    .ccp-option:hover,
    .ccp-option:focus-visible {
      border-color: var(--accent);
      background: var(--accent-soft);
      color: var(--accent);
      outline: none;
    }
    .ccp-cancel {
      justify-self: center;
      border: none;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: 13px;
      padding: 4px 8px;
    }
    .ccp-cancel:hover { color: var(--ink); }
    @keyframes ccpPop {
      from { transform: scale(0.96); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
  `]
})
export class CalendarCreatePickerComponent {
  private readonly i18n = inject(ActionosI18nService);

  /** The clicked slot. `null` keeps the dialog hidden. */
  @Input() slot: Date | null = null;

  @Output() chooseMeeting = new EventEmitter<Date>();
  @Output() chooseTask = new EventEmitter<Date>();
  @Output() cancel = new EventEmitter<void>();

  /** Human-readable "Tue, Jun 9 · 14:00" header for the chosen slot. */
  get slotLabel(): string {
    if (!this.slot) {
      return '';
    }
    const locale = this.i18n.language === 'he' ? 'he-IL' : 'en-GB';
    // en-GB gives day-before-month ordering for the date part. hour12 is set
    // explicitly so switching off en-US doesn't silently flip the time to 24h.
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).format(this.slot);
  }
}
