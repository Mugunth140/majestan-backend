import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  APP_NAME: Joi.string().default('Majestan API'),
  PORT: Joi.number().integer().min(1).max(65535).default(4000),
  API_PREFIX: Joi.string().default('api/v1'),
  DOCS_PATH: Joi.string().default('docs'),
  DOCS_TITLE: Joi.string().default('Majestan API'),
  DOCS_DESCRIPTION: Joi.string()
    .allow('')
    .default('API documentation for Majestan backend services.'),
  DOCS_VERSION: Joi.string().default('1.0.0'),
  CORS_ORIGIN: Joi.string().allow('').default(''),
  TRUST_PROXY: Joi.boolean()
    .truthy('true', '1')
    .falsy('false', '0')
    .default(false),
  ENABLE_DOCS: Joi.boolean()
    .truthy('true', '1')
    .falsy('false', '0')
    .default(false),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().integer().min(1).max(65535).default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_NAME: Joi.string().required(),
  DB_POOL_SIZE: Joi.number().integer().min(1).max(100).default(10),
  DB_SSL: Joi.boolean().truthy('true', '1').falsy('false', '0').default(false),

  JWT_ACCESS_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string()
      .min(1)
      .default('dev-only-change-this-secret-at-least-32-chars'),
  }),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),
  AUTH_ALLOW_LEGACY_PLAIN_PASSWORD: Joi.boolean()
    .truthy('true', '1')
    .falsy('false', '0')
    .default(false),

  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(120),
});
