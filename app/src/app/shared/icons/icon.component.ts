import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type IconName =
  | 'home'
  | 'inbox'
  | 'check-square'
  | 'columns'
  | 'calendar'
  | 'users'
  | 'user-group'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'menu'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'bell'
  | 'settings'
  | 'language'
  | 'plus'
  | 'search'
  | 'sparkles'
  | 'logout'
  | 'trash'
  | 'zap'
  | 'check-circle'
  | 'alert-triangle'
  | 'file-text';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.component.html',
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
      }
      svg {
        display: block;
      }
    `
  ]
})
export class IconComponent {
  @Input() name: IconName = 'home';
  @Input() size: number = 18;
}
