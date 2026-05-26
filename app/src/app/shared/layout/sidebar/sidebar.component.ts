import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  inject
} from '@angular/core';
import { ActionosI18nService } from '../../../core/i18n/actionos-i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ACTIONOS_NAV_ITEMS } from '../../../core/mock-data/actionos.mock-data';
import { NavItem, ViewId } from '../../../core/models/actionos.models';
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
  readonly navItems: NavItem[] = ACTIONOS_NAV_ITEMS;

  @HostBinding('class.collapsed') get isCollapsed(): boolean {
    return this.collapsed;
  }

  @HostBinding('class.mobile-open') get isMobileOpen(): boolean {
    return this.mobileOpen;
  }

  iconFor(id: ViewId): IconName {
    const map: Record<ViewId, IconName> = {
      home: 'home',
      inbox: 'inbox',
      'my-work': 'check-square',
      boards: 'columns',
      meetings: 'calendar',
      customers: 'users',
      members: 'user-group'
    };
    return map[id] ?? 'home';
  }

  selectView(id: ViewId): void {
    this.viewSelected.emit(id);
  }
}
