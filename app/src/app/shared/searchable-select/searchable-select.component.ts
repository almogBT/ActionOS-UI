import { CommonModule } from '@angular/common';
import {
  Component, ElementRef, EventEmitter, Input, OnDestroy, Output, forwardRef
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { customerNameMatchesSearch } from '../../core/utils/customer-name-match';

export interface SelectOption {
  value: any;
  label: string;
}

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchableSelectComponent), multi: true }
  ],
  template: `
    <div class="ss-root" [class.ss-open]="isOpen" [class.ss-up]="openUp">
      <button
        type="button"
        class="ss-trigger"
        [disabled]="isDisabled"
        (click)="toggle($event)"
      >
        <span [class.ss-placeholder]="isPlaceholder">{{ displayLabel() }}</span>
      </button>
      <div class="ss-menu" *ngIf="isOpen" (click)="$event.stopPropagation()">
        <input
          type="search"
          class="ss-search"
          [(ngModel)]="searchText"
          placeholder="Search…"
          (click)="$event.stopPropagation()"
          autocomplete="off"
        />
        <button
          *ngIf="createNewLabel"
          type="button"
          class="ss-option ss-create"
          (click)="triggerCreate()"
        >{{ createNewLabel }}</button>
        <button
          *ngFor="let opt of filteredOptions; trackBy: trackOption"
          type="button"
          class="ss-option"
          [class.ss-selected]="isSelected(opt.value)"
          (click)="pick(opt)"
        >{{ opt.label }}</button>
        <span *ngIf="!filteredOptions.length && !createNewLabel" class="ss-empty">No results</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .ss-root { position: relative; width: 100%; }

    .ss-trigger {
      display: flex;
      align-items: center;
      width: 100%;
      min-height: 36px;
      padding: 6px 36px 6px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background-color: var(--bg-elevated);
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23718096' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
      background-repeat: no-repeat;
      background-position: right 10px center;
      background-size: 14px 14px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      color: var(--text-primary);
      text-align: left;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    .ss-trigger:hover:not(:disabled) { border-color: var(--accent); }

    .ss-open .ss-trigger {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }

    .ss-trigger:disabled { opacity: 0.55; cursor: not-allowed; }

    .ss-placeholder { color: var(--muted); font-weight: 400; }

    .ss-menu {
      position: absolute;
      z-index: 200;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      min-width: 180px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 260px;
      overflow-y: auto;
    }

    .ss-up .ss-menu {
      top: auto;
      bottom: calc(100% + 4px);
    }

    .ss-search {
      width: 100%;
      min-height: 32px;
      padding: 4px 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg-elevated);
      color: var(--ink);
      font-size: 13px;
      margin-bottom: 4px;
      outline: none;
      flex-shrink: 0;
    }

    .ss-search:focus { border-color: var(--accent); }

    .ss-option {
      text-align: left;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      background: transparent;
      border: none;
      color: var(--text-primary);
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 400;
      flex-shrink: 0;
    }

    .ss-option:hover { background: var(--accent-soft); }

    .ss-selected { background: var(--accent-soft); font-weight: 600; }

    .ss-empty { padding: 6px 10px; color: var(--muted); font-size: 12px; }

    .ss-create {
      margin-bottom: 4px;
      border-bottom: 1px solid var(--border-subtle);
      border-radius: 6px 6px 0 0;
      padding-bottom: 8px;
      color: var(--accent);
      font-weight: 600;
    }

    .ss-create:hover { background: var(--accent-soft); }

    [data-theme="dark"] .ss-trigger {
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a958f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
    }

    [dir="rtl"] .ss-trigger {
      padding: 6px 12px 6px 36px;
      background-position: left 10px center;
      text-align: right;
    }
  `]
})
export class SearchableSelectComponent implements ControlValueAccessor, OnDestroy {
  @Input() options: SelectOption[] = [];
  @Input() placeholder = 'Select…';
  @Input() createNewLabel: string | null = null;
  @Input() openUp = false;
  /**
   * When true, option labels are matched with the language-aware customer
   * matcher so a Hebrew-stored name surfaces for an English query (and vice-versa).
   * Opt-in so non-customer selects keep plain substring matching.
   */
  @Input() crossLanguageMatch = false;
  @Output() createNew = new EventEmitter<void>();

  value: any = null;
  searchText = '';
  isOpen = false;
  isDisabled = false;

  private onChange: (v: any) => void = () => {};
  private onTouched: () => void = () => {};
  private outsideClickListenerAttached = false;
  private readonly filteredOptionsCache: {
    crossLanguageMatch: boolean;
    options: SelectOption[] | null;
    searchText: string;
    value: SelectOption[];
  } = {
    crossLanguageMatch: false,
    options: null,
    searchText: '',
    value: []
  };

  private readonly outsideClickListener = (event: MouseEvent): void => {
    if (!this.el.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  };

  constructor(private readonly el: ElementRef) {}

  ngOnDestroy(): void {
    this.detachOutsideClickListener();
  }

  writeValue(v: any): void { this.value = v; }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.isDisabled = d; }

  get isPlaceholder(): boolean {
    return !this.options.some(o => o.value === this.value);
  }

  displayLabel(): string {
    const opt = this.options.find(o => o.value === this.value);
    return opt?.label ?? this.placeholder;
  }

  get filteredOptions(): SelectOption[] {
    if (
      this.filteredOptionsCache.options === this.options &&
      this.filteredOptionsCache.searchText === this.searchText &&
      this.filteredOptionsCache.crossLanguageMatch === this.crossLanguageMatch
    ) {
      return this.filteredOptionsCache.value;
    }

    let value: SelectOption[];
    if (!this.searchText) {
      value = this.options;
    } else {
      const q = this.searchText.toLowerCase();
      value = this.crossLanguageMatch
        ? this.options.filter(o =>
            o.label.toLowerCase().includes(q) || customerNameMatchesSearch(o.label, this.searchText)
          )
        : this.options.filter(o => o.label.toLowerCase().includes(q));
    }

    this.filteredOptionsCache.options = this.options;
    this.filteredOptionsCache.searchText = this.searchText;
    this.filteredOptionsCache.crossLanguageMatch = this.crossLanguageMatch;
    this.filteredOptionsCache.value = value;
    return value;
  }

  trackOption(_index: number, option: SelectOption): string {
    return String(option.value);
  }

  isSelected(v: any): boolean { return this.value === v; }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isDisabled) return;
    if (this.isOpen) {
      this.close();
    } else {
      this.isOpen = true;
      this.attachOutsideClickListener();
    }
    this.onTouched();
  }

  pick(opt: SelectOption): void {
    this.value = opt.value;
    this.onChange(opt.value);
    this.close();
  }

  triggerCreate(): void {
    this.close();
    this.createNew.emit();
  }

  private close(): void {
    this.isOpen = false;
    this.searchText = '';
    this.detachOutsideClickListener();
  }

  private attachOutsideClickListener(): void {
    if (this.outsideClickListenerAttached) {
      return;
    }
    document.addEventListener('click', this.outsideClickListener, true);
    this.outsideClickListenerAttached = true;
  }

  private detachOutsideClickListener(): void {
    if (!this.outsideClickListenerAttached) {
      return;
    }
    document.removeEventListener('click', this.outsideClickListener, true);
    this.outsideClickListenerAttached = false;
  }
}
