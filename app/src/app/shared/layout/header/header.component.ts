import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, Output, computed, inject, signal
} from '@angular/core';
import { ActionosI18nService, ActionosLanguage } from '../../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { MailNotificationPrefs, QuickCaptureType, Task, ViewId } from '../../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../../core/services/actionos-workspace.service';
import { ThemeService } from '../../../core/services/theme.service';
import { IconComponent, IconName } from '../../icons/icon.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  @Input() activeView: ViewId = 'home';
  @Input() sidebarCollapsed = false;
  @Output() readonly toggleSidebar = new EventEmitter<void>();
  @Output() readonly mobileMenu = new EventEmitter<void>();
  @Output() readonly captured = new EventEmitter<void>();
  @Output() readonly navigate = new EventEmitter<ViewId>();

  readonly i18n = inject(ActionosI18nService);
  readonly workspace = inject(ActionosWorkspaceService);
  readonly theme = inject(ThemeService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly quickCaptureTypes: QuickCaptureType[] = ['task', 'action', 'decision', 'blocker', 'note'];
  readonly mailNotifKeys: (keyof MailNotificationPrefs)[] = ['newTasks', 'overdueTasks', 'dueTodayTasks', 'meetingSummaries'];
  quickCaptureType: QuickCaptureType = 'task';
  commandText = '';

  readonly notificationsOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly settingsOpen = signal(false);
  readonly typeMenuOpen = signal(false);

  readonly currentMember = computed(() =>
    this.workspace.members.find(member => member.id === this.workspace.currentUserId)
  );

  readonly initials = computed(() => {
    const name = this.currentMember()?.name ?? 'User';
    return name
      .split(' ')
      .map(part => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  readonly dueTodayTasks = computed(() => {
    const today = this.workspace.todayIso;
    return this.workspace.myTasks.filter(task => task.dueDate <= today);
  });

  readonly overdueTasks = computed(() => {
    const today = this.workspace.todayIso;
    return this.workspace.myTasks.filter(task => task.dueDate < today);
  });

  readonly dueTodayOnlyTasks = computed(() => {
    const today = this.workspace.todayIso;
    return this.workspace.myTasks.filter(task => task.dueDate === today);
  });

  readonly notificationCount = computed(() => this.dueTodayTasks().length);

  readonly themeIcon = computed(() => {
    const pref = this.theme.preference();
    if (pref === 'light') return 'sun' as IconName;
    if (pref === 'dark') return 'moon' as IconName;
    return 'monitor' as IconName;
  });

  get breadcrumb(): string {
    const map: Partial<Record<ViewId, string>> = {
      'my-work': 'Work',
      'boards': 'Work',
    };
    return map[this.activeView] ?? '';
  }

  get capturePlaceholder(): string {
    const map: Record<QuickCaptureType, string> = {
      task: 'Add a task...',
      action: 'Assign an action...',
      decision: 'Log a decision...',
      blocker: 'Flag a blocker...',
      note: 'Capture a note...',
    };
    return map[this.quickCaptureType] ?? 'Capture...';
  }

  captureIconFor(type: QuickCaptureType): IconName {
    const map: Record<QuickCaptureType, IconName> = {
      task: 'check-square',
      action: 'zap',
      decision: 'check-circle',
      blocker: 'alert-triangle',
      note: 'file-text',
    };
    return map[type] ?? 'sparkles';
  }

  captureLabel(type: QuickCaptureType): string {
    return this.i18n.translate('quickCapture.' + type);
  }

  quickCaptureLabel(): string {
    return this.captureLabel(this.quickCaptureType);
  }

  captureShortcutKey(type: QuickCaptureType): string {
    const map: Record<QuickCaptureType, string> = {
      task: 'T', action: 'A', decision: 'D', blocker: 'B', note: 'N',
    };
    return map[type] ?? '';
  }

  selectCaptureType(type: QuickCaptureType): void {
    this.quickCaptureType = type;
    this.typeMenuOpen.set(false);
  }

  submitCommand(): void {
    const result = this.workspace.quickCapture(this.quickCaptureType, this.commandText);
    if (!result) return;
    this.commandText = '';

    if (this.quickCaptureType === 'task') {
      // Open the task drawer so the user can fill in missing details immediately
      this.workspace.selectTask(result as Task, true);
    } else {
      this.captured.emit();
    }
  }

  cycleTheme(): void {
    this.theme.cycle();
  }

  setLanguage(language: ActionosLanguage): void {
    void this.i18n.setLanguage(language);
  }

  toggleNotifications(): void {
    this.notificationsOpen.update(value => !value);
    this.userMenuOpen.set(false);
    this.settingsOpen.set(false);
    this.typeMenuOpen.set(false);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update(value => !value);
    this.notificationsOpen.set(false);
    this.settingsOpen.set(false);
    this.typeMenuOpen.set(false);
  }

  toggleSettings(): void {
    this.settingsOpen.update(value => !value);
    this.userMenuOpen.set(false);
    this.notificationsOpen.set(false);
    this.typeMenuOpen.set(false);
  }

  toggleTypeMenu(): void {
    this.typeMenuOpen.update(value => !value);
    this.notificationsOpen.set(false);
    this.userMenuOpen.set(false);
    this.settingsOpen.set(false);
  }

  jumpToTask(taskId: string): void {
    const task = this.workspace.tasks.find(t => t.id === taskId);
    if (task) {
      this.workspace.selectBoardTask(task);
      this.notificationsOpen.set(false);
    }
  }

  go(view: ViewId): void {
    this.navigate.emit(view);
    this.userMenuOpen.set(false);
    this.settingsOpen.set(false);
  }

  resetDemo(): void {
    this.workspace.resetDemoData();
    this.userMenuOpen.set(false);
  }

  clearAll(): void {
    this.workspace.clearAllData();
    this.userMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event.target'])
  onDocClick(target: EventTarget | null): void {
    if (!(target instanceof Node)) return;
    if (this.host.nativeElement.contains(target)) return;
    this.notificationsOpen.set(false);
    this.userMenuOpen.set(false);
    this.settingsOpen.set(false);
    this.typeMenuOpen.set(false);
  }
}
