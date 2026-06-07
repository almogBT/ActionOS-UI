import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, HostListener, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from './core/i18n/actionos-i18n.service';
import { Customer, NavItem, QuickCaptureType, Task, ViewId } from './core/models/actionos.models';
import { ACTIONOS_NAV_ITEMS } from './core/config/actionos-ui.config';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { IconComponent, IconName } from './shared/icons/icon.component';
import { SearchableSelectComponent, SelectOption } from './shared/searchable-select/searchable-select.component';
import { CustomersSubView } from './features/customers/customers.component';
import { ActionosWorkspaceService } from './core/services/actionos-workspace.service';
import { ThemeService } from './core/services/theme.service';
import { BoardsComponent } from './features/boards/boards.component';
import { CustomersComponent } from './features/customers/customers.component';
import { InboxComponent } from './features/inbox/inbox.component';
import { MeetingsComponent } from './features/meetings/meetings.component';
import { MyWorkComponent } from './features/my-work/my-work.component';
import { TasksComponent } from './features/tasks/tasks.component';
import { MeetingDrawerComponent } from './features/meeting-drawer/meeting-drawer.component';
import { TaskDrawerComponent } from './features/task-drawer/task-drawer.component';
import { CatchUpDrawerComponent } from './features/catch-up-drawer/catch-up-drawer.component';
import { WorkspaceHomeComponent } from './features/workspace-home/workspace-home.component';
import { HeaderComponent } from './shared/layout/header/header.component';
import { SidebarComponent } from './shared/layout/sidebar/sidebar.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    WorkspaceHomeComponent,
    InboxComponent,
    MyWorkComponent,
    TasksComponent,
    BoardsComponent,
    MeetingsComponent,
    CustomersComponent,
    TaskDrawerComponent,
    MeetingDrawerComponent,
    CatchUpDrawerComponent,
    HeaderComponent,
    SidebarComponent,
    IconComponent,
    SearchableSelectComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  readonly workspace = inject(ActionosWorkspaceService);
  readonly i18n = inject(ActionosI18nService);
  readonly theme = inject(ThemeService);

  readonly navItems: NavItem[] = ACTIONOS_NAV_ITEMS;
  readonly activeView = signal<ViewId>('home');
  readonly navOpen = signal<boolean>(false);
  readonly meetingNewTick = signal(0);

  // ── Bottom action bar: quick capture ──
  readonly captureTypes: QuickCaptureType[] = ['task', 'action', 'decision', 'blocker', 'note'];
  captureType: QuickCaptureType = 'task';
  captureText = '';
  readonly captureTypeMenuOpen = signal(false);

  // ── Bottom action bar: plan meeting ──
  readonly showPlanPicker = signal(false);
  planCustomerId = '';

  // Customer the detail view should open with, handed off from the Home list.
  readonly activeCustomer = signal<Customer | null>(null);
  readonly customerEntryView = signal<CustomersSubView>('detail');

  readonly shellClass = computed(() => ({
    'nav-open': this.navOpen()
  }));

  constructor(@Inject(DOCUMENT) private readonly doc: Document) {
    // Touch the theme service at boot so its DOM side-effect runs immediately.
    this.theme.effective();
  }

  ngOnInit(): void {
    void this.i18n.init();
  }

  setView(view: ViewId): void {
    this.activeView.set(view);
    this.navOpen.set(false);
  }

  /** Home list → open a customer's 360 detail. */
  openCustomerDetail(customer: Customer): void {
    this.customerEntryView.set('detail');
    this.activeCustomer.set(customer);
    this.setView('customers');
  }

  /** Home list → jump straight into meeting prep for a customer. */
  prepareCustomerMeeting(customer: Customer): void {
    this.workspace.openCatchUpDrawer(customer.id);
  }

  /** Board preview popup → open the new-meeting form pre-filled for this customer. */
  startCustomerMeeting(customer: Customer): void {
    this.workspace.openNewMeetingModal(customer.id);
  }

  /** FAB — start a new meeting from anywhere in the app. */
  startNewMeeting(): void {
    this.setView('meetings');
    this.meetingNewTick.update(n => n + 1);
  }

  /** Detail view asked to exit — clear selection and return Home. */
  closeCustomerDetail(): void {
    this.activeCustomer.set(null);
    this.setView('home');
  }

  toggleNav(): void {
    this.navOpen.update(v => !v);
  }

  onCaptured(): void {
    // Capture lands tasks in inbox / notes go to meetings, mirror the prior behavior.
    this.activeView.set('my-work');
  }

  // ── Bottom bar: capture helpers ──

  get planCustomerOptions(): SelectOption[] {
    const sorted = [...this.workspace.customers]
      .sort((a, b) => a.name.localeCompare(b.name));
    return [
      { value: '', label: this.i18n.translate('meetingsOverview.selectCustomer') },
      ...sorted.map(c => ({ value: c.id, label: c.name }))
    ];
  }

  captureIconFor(type: QuickCaptureType): IconName {
    const map: Record<QuickCaptureType, IconName> = {
      task: 'check-square', action: 'zap', decision: 'check-circle',
      blocker: 'alert-triangle', note: 'file-text',
    };
    return map[type] ?? 'sparkles';
  }

  captureLabelFor(type: QuickCaptureType): string {
    return this.i18n.translate('quickCapture.' + type);
  }

  get currentCaptureLabel(): string {
    return this.captureLabelFor(this.captureType);
  }

  get capturePlaceholder(): string {
    return this.captureLabelFor(this.captureType) + '...';
  }

  captureShortcutFor(type: QuickCaptureType): string {
    const map: Record<QuickCaptureType, string> = {
      task: 'T', action: 'A', decision: 'D', blocker: 'B', note: 'N',
    };
    return map[type] ?? '';
  }

  selectCaptureType(type: QuickCaptureType): void {
    this.captureType = type;
    this.captureTypeMenuOpen.set(false);
  }

  toggleCaptureTypeMenu(): void {
    this.captureTypeMenuOpen.update(v => !v);
    this.showPlanPicker.set(false);
  }

  submitCapture(): void {
    if (!this.captureText.trim()) return;
    const result = this.workspace.quickCapture(this.captureType, this.captureText);
    if (!result) return;
    this.captureText = '';
    if (this.captureType === 'task') {
      this.workspace.selectTask(result as Task, true);
    } else {
      this.activeView.set('my-work');
    }
  }

  togglePlanPicker(): void {
    this.showPlanPicker.update(v => !v);
    this.captureTypeMenuOpen.set(false);
  }

  onPlanCustomerSelected(customerId: string): void {
    if (!customerId) return;
    const customer = this.workspace.customer(customerId);
    if (customer) {
      this.prepareCustomerMeeting(customer);
    }
    this.showPlanPicker.set(false);
    this.planCustomerId = '';
  }

  closeBarPopovers(): void {
    this.captureTypeMenuOpen.set(false);
    this.showPlanPicker.set(false);
  }

  @HostListener('window:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    if (event.key === '[') {
      event.preventDefault();
      this.toggleNav();
    }
  }

  iconFor(id: ViewId): IconName {
    const map: Record<ViewId, IconName> = {
      home: 'home',
      inbox: 'inbox',
      'my-work': 'check-square',
      tasks: 'check-circle',
      boards: 'columns',
      meetings: 'calendar',
      customers: 'users',
    };
    return map[id] ?? 'home';
  }

}

