export interface ActionosEnvironment {
  homePageServerUrl: string;
  actionosApiUrl: string;
  trustedHostOrigins: string[];
}

declare global {
  interface Window {
    __ACTIONOS_CONFIG__?: Partial<ActionosEnvironment>;
  }
}

export function buildActionosEnvironment(defaults: ActionosEnvironment): ActionosEnvironment {
  const runtime = typeof window === 'undefined' ? undefined : window.__ACTIONOS_CONFIG__;

  return {
    homePageServerUrl: runtime?.homePageServerUrl ?? defaults.homePageServerUrl,
    actionosApiUrl: runtime?.actionosApiUrl ?? defaults.actionosApiUrl,
    trustedHostOrigins: runtime?.trustedHostOrigins ?? defaults.trustedHostOrigins
  };
}
