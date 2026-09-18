import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES } from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const redis = config.get('redis', { infer: true });
        return {
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password,
            // BullMQ lo exige para que los bloqueos no expiren a destiempo.
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
          },
          defaultJobOptions: DEFAULT_JOB_OPTIONS,
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.SLA },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
