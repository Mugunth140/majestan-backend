import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const normalizeSegment = (value: string): string =>
    value.replace(/^\/+|\/+$/g, '');

  const apiPrefix = normalizeSegment(
    configService.getOrThrow<string>('app.apiPrefix'),
  );
  const enableDocs = configService.get<boolean>('app.enableDocs', false);
  const docsPath = enableDocs
    ? normalizeSegment(configService.getOrThrow<string>('app.docsPath'))
    : '';
  const docsRoutePrefix = enableDocs
    ? `/${apiPrefix}/${docsPath}`
    : '';
  const helmetDefault = helmet();
  const helmetNoCsp = helmet({ contentSecurityPolicy: false });

  app.use((req, res, next) => {
    // Swagger UI assets can be blocked by strict CSP headers in production.
    if (
      enableDocs &&
      docsRoutePrefix &&
      req.originalUrl.startsWith(docsRoutePrefix)
    ) {
      return helmetNoCsp(req, res, next);
    }

    return helmetDefault(req, res, next);
  });
  app.use(compression());
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);
  app.enableCors({
    origin: corsOrigins.length === 0 ? true : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  if (configService.get<boolean>('app.trustProxy', false)) {
    const adapterInstance: unknown = app.getHttpAdapter().getInstance();

    if (
      typeof adapterInstance === 'object' &&
      adapterInstance !== null &&
      'set' in adapterInstance
    ) {
      const expressLike = adapterInstance as {
        set?: (name: string, value: number) => unknown;
      };

      if (typeof expressLike.set === 'function') {
        expressLike.set('trust proxy', 1);
      }
    }
  }

  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });

  if (enableDocs) {
    const docsTitle = configService.getOrThrow<string>('app.docsTitle');
    const docsDescription = configService.getOrThrow<string>(
      'app.docsDescription',
    );
    const docsVersion = configService.getOrThrow<string>('app.docsVersion');

    const swaggerConfig = new DocumentBuilder()
      .setTitle(docsTitle)
      .setDescription(docsDescription)
      .setVersion(docsVersion)
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          in: 'header',
        },
        'access-token',
      )
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/${docsPath}`, app, swaggerDocument, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
      },
      customSiteTitle: `${docsTitle} Docs`,
    });
  }

  app.enableShutdownHooks();

  const port = configService.getOrThrow<number>('app.port');
  await app.listen(port);
}

void bootstrap();
