import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from './core/i18n/actionos-i18n.service';
import { Customer, NavItem, Task, ViewId } from './core/models/actionos.models';
import { ACTIONOS_FEATURES, DEFAULT_VIEW, VISIBLE_NAV_ITEMS, isViewEnabled } from './core/config/actionos-ui.config';
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
import { HeaderComponent } from './shared/layout/header/header.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
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

  readonly navItems: NavItem[] = VISIBLE_NAV_ITEMS;
  readonly features = ACTIONOS_FEATURES;
  // Landing view is the first feature-enabled nav item (My Work when enabled).
  readonly activeView = signal<ViewId>(DEFAULT_VIEW);
  readonly meetingNewTick = signal(0);

  // ── Bottom action bar: quick capture ──
  captureText = '';

  // ── Bottom action bar: plan meeting ──
  readonly showPlanPicker = signal(false);
  planCustomerId = '';

  // Customer the detail view should open with, handed off from the Home list.
  readonly activeCustomer = signal<Customer | null>(null);
  readonly customerEntryView = signal<CustomersSubView>('detail');

  constructor(@Inject(DOCUMENT) private readonly doc: Document) {
    // Touch the theme service at boot so its DOM side-effect runs immediately.
    this.theme.effective();
  }

  ngOnInit(): void {
    void this.i18n.init();
  }

  setView(view: ViewId): void {
    // Never strand the user on a feature-hidden view: redirect to the landing view.
    // This one chokepoint covers every child `viewChange` emit too.
    this.activeView.set(isViewEnabled(view) ? view : DEFAULT_VIEW);
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
    // Open the new-meeting drawer in place; do NOT navigate to the Meetings page.
    this.workspace.openNewMeetingModal();
  }

  /** Detail view asked to exit — clear selection and return to the landing view. */
  closeCustomerDetail(): void {
    this.activeCustomer.set(null);
    this.setView('my-work');
  }

  onCaptured(): void {
    // Header capture returns to the work view after saving (or the landing
    // view when My Work is hidden — setView guards the redirect).
    this.setView('my-work');
  }

  // ── Bottom bar: capture helpers ──

  get planCustomerOptions(): SelectOption[] {
    return [
      { value: '', label: this.i18n.translate('meetingsOverview.selectCustomer') },
      ...this.workspace.clientOptions.map(c => ({ value: c.id, label: c.name }))
    ];
  }

  get currentCaptureLabel(): string {
    return this.i18n.translate('quickCapture.task');
  }

  get capturePlaceholder(): string {
    return this.currentCaptureLabel + '...';
  }

  submitCapture(): void {
    const taskTitle = this.captureText.trim();
    if (!taskTitle) return;
    const result = this.workspace.quickCapture('task', taskTitle);
    if (!result) return;
    this.captureText = '';
    this.workspace.selectTask(result as Task, true);
  }

  togglePlanPicker(): void {
    this.showPlanPicker.update(v => !v);
  }

  onPlanCustomerSelected(customerId: string): void {
    if (!customerId) return;
    this.workspace.openCatchUpDrawer(customerId);
    this.showPlanPicker.set(false);
    this.planCustomerId = '';
  }

  closeBarPopovers(): void {
    this.showPlanPicker.set(false);
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

