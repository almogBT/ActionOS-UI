import { Pipe, PipeTransform } from '@angular/core';
import { ActionosI18nService } from './actionos-i18n.service';

@Pipe({
  name: 't',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform {
  constructor(private readonly i18n: ActionosI18nService) {}

  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.translate(key, params);
  }
}
