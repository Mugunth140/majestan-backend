import { registerAs } from '@nestjs/config';

export default registerAs('meilisearch', () => ({
  host: process.env.MEILI_HOST || 'http://meilisearch:7700',
  apiKey: process.env.MEILI_MASTER_KEY || process.env.MEILI_API_KEY || '',
  enabled: !!process.env.MEILI_HOST,
}));
