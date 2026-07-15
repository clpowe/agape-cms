import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Middlewares => {
  // Host serving R2 media (r2.dev dev URL or custom domain); the admin
  // panel's CSP must allow it or media previews are blocked.
  const r2PublicUrl = env('R2_PUBLIC_URL', '');
  const r2PublicHost = r2PublicUrl ? new URL(r2PublicUrl).host : '*.r2.dev';

  return [
    'strapi::logger',
    'strapi::errors',
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'connect-src': ["'self'", 'https:'],
            'img-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', r2PublicHost],
            'media-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', r2PublicHost],
            upgradeInsecureRequests: null,
          },
        },
      },
    },
    'strapi::cors',
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};

export default config;
