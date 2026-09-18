import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuditCoreModule } from './core/audit/audit.module';
import { CoreAuthModule } from './core/auth/core-auth.module';
import { JwtAuthGuard } from './core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './core/auth/guards/permissions.guard';
import { CacheModule } from './core/cache/cache.module';
import { AllExceptionsFilter } from './core/common/filters/all-exceptions.filter';
import { RequestContextInterceptor } from './core/common/interceptors/request-context.interceptor';
import { AppConfigModule } from './core/config/config.module';
import type { AppConfig } from './core/config/configuration';
import { EventsModule } from './core/events/events.module';
import { MailerModule } from './core/mailer/mailer.module';
import { PrismaModule } from './core/prisma/prisma.module';
import { QueueModule } from './core/queue/queue.module';
import { StorageModule } from './core/storage/storage.module';

import { ApplicationsModule } from './modules/applications/applications.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CasesModule } from './modules/cases/cases.module';
import { ClassificationsModule } from './modules/classifications/classifications.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ConsultantsModule } from './modules/consultants/consultants.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ExecutionModule } from './modules/execution/execution.module';
import { HealthModule } from './modules/health/health.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { SlaModule } from './modules/sla/sla.module';
import { UsersModule } from './modules/users/users.module';
import { WorkflowModule } from './modules/workflow/workflow.module';

/**
 * Composición del monolito modular.
 *
 * `core/*` es infraestructura transversal (global); `modules/*` son los módulos
 * de negocio. Las dependencias entre módulos de negocio son explícitas en cada
 * `imports`, y no hay ciclos: ésa es la frontera que permitiría extraer un
 * servicio en el futuro sin rehacer el dominio.
 */
@Module({
  imports: [
    // --- Infraestructura -----------------------------------------------------
    AppConfigModule,
    PrismaModule,
    CacheModule,
    EventsModule,
    AuditCoreModule,
    StorageModule,
    MailerModule,
    QueueModule,
    CoreAuthModule,
    ScheduleModule.forRoot(),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const throttle = config.get('throttle', { infer: true });
        return {
          throttlers: [
            { name: 'default', ttl: throttle.ttlSeconds * 1000, limit: throttle.limit },
            {
              name: 'auth',
              ttl: throttle.authTtlSeconds * 1000,
              limit: throttle.authLimit,
            },
          ],
        };
      },
    }),

    // --- Negocio -------------------------------------------------------------
    HealthModule,
    AuthModule,
    UsersModule,
    LookupsModule,
    CompaniesModule,
    ConsultantsModule,
    CasesModule,
    WorkflowModule,
    ClassificationsModule,
    ApplicationsModule,
    ProposalsModule,
    ContractsModule,
    ExecutionModule,
    DocumentsModule,
    CommunicationsModule,
    NotificationsModule,
    SlaModule,
    AuditModule,
    DashboardModule,
  ],
  providers: [
    // El orden importa: autenticar → limitar tasa → autorizar por permiso.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
})
export class AppModule {}
