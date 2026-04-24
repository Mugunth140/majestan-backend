import { registerAs } from '@nestjs/config';

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

export default registerAs('app', () => ({
  name: process.env.APP_NAME ?? 'Majestan API',
  env: process.env.NODE_ENV ?? 'development',
  port: Number.parseInt(process.env.PORT ?? '4000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  docsPath: process.env.DOCS_PATH ?? 'docs',
  docsTitle: process.env.DOCS_TITLE ?? 'Majestan API',
  docsDescription:
    process.env.DOCS_DESCRIPTION ??
    'API documentation for Majestan backend services.',
  docsVersion: process.env.DOCS_VERSION ?? '1.0.0',
  corsOrigins: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: parseBoolean(process.env.TRUST_PROXY, false),
  enableDocs: parseBoolean(process.env.ENABLE_DOCS, false),
}));
