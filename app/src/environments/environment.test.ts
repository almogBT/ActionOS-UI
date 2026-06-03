import { buildActionosEnvironment } from './runtime-config';

export const environment = buildActionosEnvironment({
  homePageServerUrl: 'https://servitzhome-test.fritz.co.il',
  actionosApiUrl: 'https://meetings-test-api.fritz.co.il',
  trustedHostOrigins: [
    'https://servitzhome-test.fritz.co.il'
  ]
});
