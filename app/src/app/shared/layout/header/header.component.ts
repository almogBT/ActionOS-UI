import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActionosI18nService, ActionosLanguage } from '../../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { QuickCaptureType, ViewId } from '../../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../../core/services/actionos-workspace.service';
import { ThemeService } from '../../../core/services/theme.service';
import { IconComponent } from '../../icons/icon.component';

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

  quickCaptureType: QuickCaptureType = 'task';
  commandText = '';

  readonly notificationsOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly settingsOpen = signal(false);

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

  readonly themeIcon = computed(() => {
    const pref = this.theme.preference();
    if (pref === 'light') return 'sun';
    if (pref === 'dark') return 'moon';
    return 'monitor';
  });

  submitCommand(): void {
    const captured = this.workspace.quickCapture(this.quickCaptureType, this.commandText);
    if (!captured) return;
    this.commandText = '';
    this.captured.emit();
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
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update(value => !value);
    this.notificationsOpen.set(false);
    this.settingsOpen.set(false);
  }

  toggleSettings(): void {
    this.settingsOpen.update(value => !value);
    this.userMenuOpen.set(false);
    this.notificationsOpen.set(false);
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
  }
}
