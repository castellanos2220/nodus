import { Module } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { ReviewsService } from './reviews.service';

/**
 * Propuestas y su QA.
 *
 * El brief lista `proposals` y `reviews` como módulos separados. Aquí viven
 * juntos porque una revisión no existe sin una versión de propuesta y ambas
 * comparten invariantes (qué versión está en QA, cuál está congelada);
 * separarlos crearía dos módulos que se importan mutuamente —un ciclo— sin
 * ganar ninguna frontera real. Los archivos sí están separados, que es donde
 * la separación aporta legibilidad.
 */
@Module({
  controllers: [ProposalsController],
  providers: [ProposalsService, ReviewsService],
  exports: [ProposalsService, ReviewsService],
})
export class ProposalsModule {}
