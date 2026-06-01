import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, EventEmitter, HostBinding, Input, Output, inject
} from '@angular/core';
import { ActionosI18nService } from '../../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ACTIONOS_NAV_ITEMS } from '../../../core/config/actionos-ui.config';
import { NavItem, NavSection, ViewId } from '../../../core/models/actionos.models';
import { ActionosWorkspaceService } from '../../../core/services/actionos-workspace.service';
import { IconComponent, IconName } from '../../icons/icon.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, TranslatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Input() activeView: ViewId = 'home';
  @Input() collapsed = false;
  @Input() mobileOpen = false;
  @Output() readonly viewSelected = new EventEmitter<ViewId>();
  @Output() readonly toggleCollapsed = new EventEmitter<void>();
  @Output() readonly closeMobile = new EventEmitter<void>();

  readonly i18n = inject(ActionosI18nService);
  readonly workspace = inject(ActionosWorkspaceService);
  readonly navSections: Array<{ id: NavSection; label: string; items: NavItem[] }> = [
    { id: 'main', label: 'Main', items: ACTIONOS_NAV_ITEMS.filter(i => i.section === 'main') },
    { id: 'work', label: 'Work', items: ACTIONOS_NAV_ITEMS.filter(i => i.section === 'work') },
  ];

  @HostBinding('class.collapsed') get isCollapsed(): boolean {
    return this.collapsed;
  }

  @HostBinding('class.mobile-open') get isMobileOpen(): boolean {
    return this.mobileOpen;
  }

  @HostBinding('class.rtl') get isRtl(): boolean {
    return this.i18n.direction === 'rtl';
  }

  /** True when the sidebar should visually appear collapsed (icon-strip mode).
   *  On mobile, mobileOpen overrides the collapsed input so the full sidebar
   *  can render as an overlay even when the desktop state is collapsed. */
  get showCollapsedState(): boolean {
    return this.collapsed && !this.mobileOpen;
  }

  iconFor(id: ViewId): IconName {
    const map: Record<ViewId, IconName> = {
      home: 'home',
      inbox: 'inbox',
      'my-work': 'check-square',
      tasks: 'check-circle',
      boards: 'columns',
      meetings: 'calendar',
      customers: 'users'
    };
    return map[id] ?? 'home';
  }

  selectView(id: ViewId): void {
    this.viewSelected.emit(id);
  }
}
