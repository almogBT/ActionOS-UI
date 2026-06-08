import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MEETING_FORM_STYLES } from './meeting-form.styles';

export interface ParticipantPickerOption {
  /** Stable identity used for selection + chip removal. */
  key: string;
  label: string;
  /** Optional secondary text (e.g. email · phone). */
  sublabel?: string;
}

export interface ParticipantChip {
  key: string;
  label: string;
}

/**
 * Reusable searchable multi-select with selected chips.
 *
 * Replaces the two near-identical `<details>` dropdowns the meeting form used for
 * internal teammates and customer participants. It is intentionally presentational:
 * the parent owns the data and decides what selecting/removing means by handling the
 * (toggle)/(remove) outputs. Any parent-specific extras (e.g. the customer side's
 * "add a brand-new participant" row) are projected via <ng-content> into a footer at
 * the bottom of the dropdown menu, so they appear inside the open dropdown.
 */
@Component({
  selector: 'app-participant-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <details class="participant-dropdown" (click)="$event.stopPropagation()">
      <summary class="participant-dropdown-trigger">
        <span class="participant-summary-text" *ngIf="chips.length; else placeholderTpl">
          {{ summaryLabel() }}
        </span>
        <ng-template #placeholderTpl>
          <span class="participant-placeholder">{{ placeholder }}</span>
        </ng-template>
      </summary>

      <div class="participant-dropdown-menu" (click)="$event.stopPropagation()">
        <input
          type="search"
          class="participant-search"
          [name]="name + '-search'"
          [(ngModel)]="search"
          [placeholder]="searchPlaceholder"
          (click)="$event.stopPropagation()"
        />

        <label
          *ngFor="let o of filtered"
          class="participant-option"
          (click)="$event.stopPropagation()"
        >
          <input type="checkbox" [checked]="isSelected(o.key)" (change)="toggle.emit(o.key)" />
          <span>
            {{ o.label }}
            <small class="muted" *ngIf="o.sublabel"> {{ o.sublabel }}</small>
          </span>
        </label>

        <div class="participant-empty" *ngIf="!filtered.length">{{ emptyText }}</div>

        <div class="participant-menu-footer">
          <ng-content></ng-content>
        </div>
      </div>
    </details>

    <div class="selected-participants" *ngIf="chips.length">
      <span class="selected-participant" *ngFor="let c of chips">
        <span>{{ c.label }}</span>
        <button type="button" (click)="remove.emit(c.key)" title="Remove">×</button>
      </span>
    </div>
  `,
  styles: [MEETING_FORM_STYLES]
})
export class ParticipantPickerComponent {
  @Input() options: ParticipantPickerOption[] = [];
  @Input() selectedKeys: string[] = [];
  @Input() chips: ParticipantChip[] = [];
  @Input() placeholder = '';
  @Input() searchPlaceholder = '';
  @Input() emptyText = '';
  /** Used to namespace the inner search input's `name` so multiple pickers coexist. */
  @Input() name = 'participantPicker';

  @Output() toggle = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();

  search = '';

  constructor(private host: ElementRef) {}

  get filtered(): ParticipantPickerOption[] {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      return this.options;
    }
    return this.options.filter((o) =>
      o.label.toLowerCase().includes(term) ||
      (o.sublabel?.toLowerCase().includes(term) ?? false)
    );
  }

  isSelected(key: string): boolean {
    return this.selectedKeys.includes(key);
  }

  summaryLabel(): string {
    const labels = this.chips.map((c) => c.label).filter(Boolean);
    if (!labels.length) {
      return '';
    }
    if (labels.length <= 2) {
      return labels.join(', ');
    }
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
  }

  /** Close the dropdown when the user clicks anywhere outside it. */
  @HostListener('document:click')
  onDocumentClick(): void {
    (this.host.nativeElement as HTMLElement)
      .querySelectorAll<HTMLDetailsElement>('details[open]')
      .forEach((d) => d.removeAttribute('open'));
  }
}
