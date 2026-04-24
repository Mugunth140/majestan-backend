import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  app.use(helmet());
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
    const expressApp = app.getHttpAdapter().getInstance();
    if (typeof expressApp.set === 'function') {
      expressApp.set('trust proxy', 1);
    }
  }

  const apiPrefix = configService.getOrThrow<string>('app.apiPrefix');
  app.setGlobalPrefix(apiPrefix);

  const enableDocs = configService.get<boolean>('app.enableDocs', false);
  if (enableDocs) {
    const docsPath = configService.getOrThrow<string>('app.docsPath');
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

bootstrap();
