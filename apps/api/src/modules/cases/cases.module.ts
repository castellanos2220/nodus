import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { LookupsModule } from '../lookups/lookups.module';
import { SlaModule } from '../sla/sla.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';

@Module({
  imports: [LookupsModule, CompaniesModule, SlaModule, WorkflowModule, AuthModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
