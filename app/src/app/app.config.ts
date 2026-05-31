import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { ActionosI18nService } from './core/i18n/actionos-i18n.service';
import { ActionosWorkspaceService } from './core/services/actionos-workspace.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { routes } from './app.routes';

function initializeI18n(i18n: ActionosI18nService): () => Promise<void> {
  return () => i18n.init();
}

function initializeWorkspace(ws: ActionosWorkspaceService): () => Promise<void> {
  return () => ws.initialize();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [ActionosI18nService],
      useFactory: initializeI18n
    },
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [ActionosWorkspaceService],
      useFactory: initializeWorkspace
    }
  ]
};
