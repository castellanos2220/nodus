import { Module } from '@nestjs/common';
import { LookupsModule } from '../lookups/lookups.module';
import { ClassificationsController } from './classifications.controller';
import { ClassificationsService } from './classifications.service';

@Module({
  imports: [LookupsModule],
  controllers: [ClassificationsController],
  providers: [ClassificationsService],
})
export class ClassificationsModule {}
