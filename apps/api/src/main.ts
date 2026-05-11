import 'reflect-metadata';
import { startTelemetry } from './telemetry';
startTelemetry();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger as NestLogger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { startInlineWorkers } from '@kincare/worker';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new NestLogger('Bootstrap');

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  // CORS_ORIGIN supports a comma-separated list. Falls back to PUBLIC_WEB_URL
  // for backwards-compat. Accept `true` (reflect origin) only when neither set.
  const corsOriginEnv = process.env.CORS_ORIGIN ?? process.env.PUBLIC_WEB_URL;
  app.enableCors({
    origin: corsOriginEnv ? corsOriginEnv.split(',').map((s) => s.trim()) : true,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'metrics', 'fhir/(.*)', '.well-known/(.*)', 'oauth/(.*)'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swagger = new DocumentBuilder()
    .setTitle('Kincare API')
    .setDescription('Hospital patient portal & healthcare interoperability platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('refresh_token')
    .build();
  const doc = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api/docs', app, doc);

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  logger.log(`🚑 Kincare API listening on port ${port}`);

  // Free-tier deployments (Render free, Fly nano) can't run a separate worker
  // dyno, so run the BullMQ workers inside this process.
  if (process.env.RUN_WORKERS_INLINE === 'true') {
    const handle = startInlineWorkers({
      enablePdf: process.env.WORKERS_ENABLE_PDF === 'true',
      skipHl7: process.env.WORKERS_SKIP_HL7 === 'true',
    });
    if (handle) {
      const shutdown = async () => {
        logger.log('Shutting down inline workers…');
        await handle.shutdown();
        await app.close();
        process.exit(0);
      };
      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    }
  }
}

bootstrap();
