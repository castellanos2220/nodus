import { Module } from '@nestjs/common';
import { SlaModule } from '../sla/sla.module';
import { WorkflowCatalogController, WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [SlaModule],
  controllers: [WorkflowController, WorkflowCatalogController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
