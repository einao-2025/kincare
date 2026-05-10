import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { buildPinoTransport } from './logging';
import { configValidationSchema } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { CsrfMiddleware } from './common/csrf.middleware';
import { FlowsModule } from './common/flows/flows.module';
import { TenantModule } from './common/tenant/tenant.module';
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { AuditModule } from './modules/audit/audit.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { RetentionModule } from './modules/retention/retention.module';
import { AuthModule } from './modules/auth/auth.module';
import { PatientsModule } from './modules/patients/patients.module';
import { FamilyModule } from './modules/family/family.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { ResultsModule } from './modules/results/results.module';
import { DicomModule } from './modules/dicom/dicom.module';
import { FhirModule } from './modules/fhir/fhir.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProgressModule } from './modules/progress/progress.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { SmartModule } from './modules/smart/smart.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: (env) => configValidationSchema.parse(env),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: buildPinoTransport({
          service: 'kincare-api',
          lokiUrl: process.env.LOKI_URL,
          lokiBasicAuth: process.env.LOKI_BASIC_AUTH,
        }) as any,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
      },
    }),
    ThrottlerModule.forRoot([{
      ttl: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
      limit: Number(process.env.RATE_LIMIT_MAX ?? 120),
    }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    FlowsModule,
    TenantModule,
    AuditModule,
    AlertsModule,
    RetentionModule,
    AuthModule,
    PatientsModule,
    FamilyModule,
    PrescriptionsModule,
    ResultsModule,
    DicomModule,
    FhirModule,
    NotificationsModule,
    ProgressModule,
    HealthModule,
    MetricsModule,
    SmartModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
