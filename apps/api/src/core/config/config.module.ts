import path from 'node:path';
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { configuration } from './configuration';
import { validateEnv } from './env.validation';

/**
 * El monorepo mantiene un único `.env` en la raíz; se carga primero el de la raíz
 * y, si existe, un `.env` local de la app lo sobrescribe (útil para pruebas).
 */
const ROOT_ENV = path.resolve(process.cwd(), '../../.env');
const LOCAL_ENV = path.resolve(process.cwd(), '.env');

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: [LOCAL_ENV, ROOT_ENV],
      load: [configuration],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
