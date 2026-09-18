import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Proceso worker.
 *
 * Mismo árbol de módulos que la API, sin servidor HTTP. Es deliberado: el worker
 * y la API comparten servicios, entidades y reglas, y separarlos en dos bases de
 * código sería la forma más rápida de que diverjan.
 *
 * Aquí se procesan: notificaciones, envío de correo, evaluación de SLA y barrido
 * de hitos. Nada de eso ocurre dentro del ciclo de una petición HTTP.
 */
async function bootstrapWorker(): Promise<void> {
  process.env.WORKER_MODE = 'true';

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: false,
  });

  app.enableShutdownHooks();

  const logger = new Logger('Worker');
  logger.log('NODUS worker iniciado: notificaciones, correo, SLA e hitos');

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Señal ${signal} recibida; cerrando el worker…`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrapWorker();
