import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AppConfig } from './core/config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });

  const config = app.get(ConfigService<AppConfig, true>);
  const http = config.get('http', { infer: true });
  const isProduction = config.get('isProduction', { infer: true });

  app.setGlobalPrefix(http.globalPrefix);

  // --- Seguridad -------------------------------------------------------------
  app.use(
    helmet({
      // Swagger UI necesita inline styles/scripts; fuera de producción se relaja.
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());

  app.enableCors({
    origin: http.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });

  // Límite de payload: un JSON de 2 MB es más que suficiente para cualquier
  // formulario del producto. Los archivos van por multipart con su propio límite.
  app.useBodyParser('json', { limit: `${http.maxRequestBodyMb}mb` });
  app.useBodyParser('urlencoded', { limit: `${http.maxRequestBodyMb}mb`, extended: true });

  // IP real del cliente (límite de tasa y auditoría). Por defecto sólo se confía
  // en saltos de red privada —el proxy de Next, un balanceador interno—: una
  // petición directa desde internet no puede falsear su IP con X-Forwarded-For.
  // En producción, el proxy de borde debe sobrescribir esa cabecera (ADR-009).
  app.set('trust proxy', http.trustProxy);

  // --- Validación ------------------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      // `whitelist` + `forbidNonWhitelisted`: un campo que el DTO no declara es
      // un error, no algo que se ignora en silencio. Cierra la puerta al
      // mass-assignment.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );

  app.enableShutdownHooks();

  // --- Swagger ---------------------------------------------------------------
  const swagger = new DocumentBuilder()
    .setTitle('NODUS API')
    .setDescription(
      'Plataforma de orquestación empresarial NODUS.\n\n' +
        '**Workflow**: el estado de un caso sólo cambia mediante ' +
        '`POST /cases/:id/transitions`. No existe ningún endpoint que escriba el estado ' +
        'directamente.\n\n' +
        '**Autorización**: cada endpoint declara los permisos que exige; además, los ' +
        'recursos de caso comprueban la relación del usuario con ese caso concreto.\n\n' +
        '**Auditoría**: toda escritura relevante deja registro en la bitácora, que es ' +
        'append-only a nivel de base de datos.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Token obtenido en POST /auth/login',
    })
    .addTag('Auth', 'Autenticación y sesión')
    .addTag('Casos', 'Ciclo de vida del caso')
    .addTag('Workflow', 'Máquina de estados y transiciones')
    .addTag('Empresas', 'Empresa única — casos múltiples')
    .addTag('Consultores', 'Ecosistema curado de consultores')
    .addTag('Postulaciones', 'Bolsa interna, postulación y asignación')
    .addTag('Propuestas', 'Diseño, versionamiento y QA')
    .addTag('Contratación', 'Checklist T7A y marco operativo T7B')
    .addTag('Ejecución', 'Agenda, actividades, hitos, incidencias y entregables')
    .addTag('Documentos', 'Repositorio documental versionado')
    .addTag('SLA', 'Reglas, instancias y alertas')
    .addTag('Auditoría', 'Bitácora inmutable')
    .addTag('Dashboard', 'Indicadores PMO')
    .build();

  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup(`${http.globalPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
    customSiteTitle: 'NODUS API',
  });

  await app.listen(http.port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`NODUS API escuchando en http://localhost:${http.port}/${http.globalPrefix}`);
  logger.log(`Swagger disponible en http://localhost:${http.port}/${http.globalPrefix}/docs`);
}

void bootstrap();
