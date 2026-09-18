import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../core/auth/decorators';
import { CacheService } from '../../core/cache/cache.service';
import { MailerService } from '../../core/mailer/mailer.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly storage: StorageService,
    private readonly mailer: MailerService,
  ) {}

  /**
   * Comprobación de vida del proceso. Devuelve 200 aunque una dependencia esté
   * caída: sirve para que el orquestador sepa que el contenedor responde.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Estado del servicio' })
  health() {
    return { status: 'ok', service: 'nodus-api', timestamp: new Date().toISOString() };
  }

  /**
   * Comprobación profunda: consulta cada dependencia. Es la que usa el script de
   * smoke test para saber si el entorno de evaluación está completo.
   */
  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Estado detallado de las dependencias' })
  async ready() {
    const [database, redis, storage, smtp] = await Promise.all([
      this.checkDatabase(),
      this.cache.healthCheck(),
      this.storage.healthCheck(),
      this.mailer.healthCheck(),
    ]);

    const checks = { database, redis, storage, smtp };
    const allOk = Object.values(checks).every(Boolean);

    return {
      status: allOk ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
