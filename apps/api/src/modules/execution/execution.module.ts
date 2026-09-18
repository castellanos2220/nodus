import { Module } from '@nestjs/common';
import { LookupsModule } from '../lookups/lookups.module';
import { ClosureService } from './closure.service';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';

/**
 * Ejecución y cierre.
 *
 * Reúne actividades (T8B), hitos (T8C), incidencias (T8D), reuniones (T8E),
 * entregables (T8G) y el cierre (T9A–T9H). El brief los enumera como módulos
 * separados; aquí comparten módulo Nest porque comparten exactamente las mismas
 * reglas de acceso y el mismo ciclo de vida, y separarlos sólo multiplicaría
 * ficheros de wiring. La separación que sí aporta —por archivo y por
 * controlador— se mantiene.
 */
@Module({
  imports: [LookupsModule],
  controllers: [ExecutionController],
  providers: [ExecutionService, ClosureService],
  exports: [ExecutionService, ClosureService],
})
export class ExecutionModule {}
