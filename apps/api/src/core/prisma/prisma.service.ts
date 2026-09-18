import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Tipo del cliente dentro de una transacción. Los servicios que participan en una
 * transacción reciben esto, no el `PrismaService` completo: así es imposible
 * "escaparse" de la transacción por accidente llamando al cliente global.
 */
export type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

const SLOW_QUERY_MS = 300;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit(): Promise<void> {
    // Registra sólo consultas lentas: el log completo de queries en desarrollo
    // es ruido que oculta justamente lo que importa.
    (this as unknown as { $on: (e: string, cb: (ev: Prisma.QueryEvent) => void) => void }).$on(
      'query',
      (event) => {
        if (event.duration >= SLOW_QUERY_MS) {
          this.logger.warn(
            `Consulta lenta (${event.duration} ms): ${event.query.slice(0, 500)}`,
          );
        }
      },
    );

    await this.$connect();
    this.logger.log('Conectado a PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Vacía todas las tablas de negocio. Sólo disponible fuera de producción; la
   * usan las pruebas de integración y E2E entre casos.
   *
   * Usa TRUNCATE ... CASCADE en lugar de DELETE porque los triggers de
   * inmutabilidad (audit_logs, document_versions) bloquean DELETE por fila —
   * que es justo lo que queremos en tiempo de ejecución.
   */
  async truncateAll(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('truncateAll() no está permitido en producción');
    }

    const rows = await this.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
    `;

    if (rows.length === 0) return;

    const tables = rows.map((row) => `"public"."${row.tablename}"`).join(', ');
    await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
  }
}
