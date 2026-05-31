import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ActionosAuthService } from '../services/auth.service';

/**
 * Attaches the B2C ID token to requests bound for HomePage_Server or ActionOS API.
 * Requests to other origins (e.g. asset bundles) pass through untouched.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isHomePageRequest = req.url.startsWith(environment.homePageServerUrl);
  const isActionosApiRequest = req.url.startsWith(environment.actionosApiUrl);
  if (!isHomePageRequest && !isActionosApiRequest) {
    return next(req);
  }

  const token = inject(ActionosAuthService).getToken();
  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    })
  );
};
