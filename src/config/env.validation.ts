import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  APP_NAME: Joi.string().default('Majestan API'),
  PORT: Joi.number().integer().min(1).max(65535).default(5000),
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
  JWT_ACCESS_TTL: Joi.string().default('7d'),
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),
  AUTH_ALLOW_LEGACY_PLAIN_PASSWORD: Joi.boolean()
    .truthy('true', '1')
    .falsy('false', '0')
    .default(false),

  PAY4SMS_API_URL: Joi.string().uri().default('http://pay4sms.in/sendsms/'),
  PAY4SMS_TOKEN: Joi.string().allow('').default(''),
  PAY4SMS_SENDER_ID: Joi.string().default('PRSMRK'),
  // 2 = transactional route (current vendor instruction), 4 = OTP route.
  PAY4SMS_CREDIT: Joi.string().valid('2', '4').default('2'),
  PAY4SMS_REGISTER_TEMPLATE_ID: Joi.string().default('1777179023885095379'),
  PAY4SMS_LOGIN_TEMPLATE_ID: Joi.string().default('1777179016683380342'),

  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(120),

  MEILI_HOST: Joi.string().uri().allow('').default('http://meilisearch:7700'),
  MEILI_MASTER_KEY: Joi.string().allow('').default(''),
  MEILI_API_KEY: Joi.string().allow('').default(''),

  STORAGE_DRIVER: Joi.string().valid('r2', 'local').default('r2'),
  LOCAL_UPLOAD_DIR: Joi.string().default('./uploads'),
  LOCAL_UPLOAD_BASE_URL: Joi.string().uri().allow('').default(''),
  R2_PUBLIC_URL: Joi.string().uri().allow('').default(''),
});
