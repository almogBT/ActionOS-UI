import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, HostListener, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionosI18nService } from './core/i18n/actionos-i18n.service';
import { ViewId } from './core/models/actionos.models';
import { ActionosWorkspaceService } from './core/services/actionos-workspace.service';
import { ThemeService } from './core/services/theme.service';
import { BoardsComponent } from './features/boards/boards.component';
import { CustomersComponent } from './features/customers/customers.component';
import { InboxComponent } from './features/inbox/inbox.component';
import { MeetingsComponent } from './features/meetings/meetings.component';
import { MembersComponent } from './features/members/members.component';
import { MyWorkComponent } from './features/my-work/my-work.component';
import { TaskDrawerComponent } from './features/task-drawer/task-drawer.component';
import { WorkspaceHomeComponent } from './features/workspace-home/workspace-home.component';
import { HeaderComponent } from './shared/layout/header/header.component';
import { SidebarComponent } from './shared/layout/sidebar/sidebar.component';

const SIDEBAR_STORAGE_KEY = 'actionos.sidebar.collapsed';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    WorkspaceHomeComponent,
    InboxComponent,
    MyWorkComponent,
    BoardsComponent,
    MeetingsComponent,
    CustomersComponent,
    MembersComponent,
    TaskDrawerComponent,
    HeaderComponent,
    SidebarComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  readonly workspace = inject(ActionosWorkspaceService);
  readonly i18n = inject(ActionosI18nService);
  readonly theme = inject(ThemeService);

  readonly activeView = signal<ViewId>('home');
  readonly sidebarCollapsed = signal<boolean>(this.loadCollapsed());
  readonly mobileNavOpen = signal<boolean>(false);

  readonly shellClass = computed(() => ({
    'shell-collapsed': this.sidebarCollapsed(),
    'shell-mobile-open': this.mobileNavOpen()
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
    this.mobileNavOpen.set(false);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(value => !value);
    this.persistCollapsed();
  }

  openMobileNav(): void {
    this.mobileNavOpen.set(true);
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  onCaptured(): void {
    // Capture lands tasks in inbox / notes go to meetings, mirror the prior behavior.
    this.activeView.set('inbox');
  }

  @HostListener('window:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    if (event.key === '[') {
      event.preventDefault();
      this.toggleSidebar();
    }
  }

  private loadCollapsed(): boolean {
    try {
      return this.doc?.defaultView?.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private persistCollapsed(): void {
    try {
      this.doc?.defaultView?.localStorage.setItem(SIDEBAR_STORAGE_KEY, this.sidebarCollapsed() ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
}
