import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { ActionosI18nService } from './core/i18n/actionos-i18n.service';
import { routes } from './app.routes';

function initializeI18n(i18n: ActionosI18nService): () => Promise<void> {
  return () => i18n.init();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [ActionosI18nService],
      useFactory: initializeI18n
    }
  ]
};
