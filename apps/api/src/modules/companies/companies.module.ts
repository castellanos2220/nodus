import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyMatchingService } from './company-matching.service';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyMatchingService],
  exports: [CompaniesService, CompanyMatchingService],
})
export class CompaniesModule {}
