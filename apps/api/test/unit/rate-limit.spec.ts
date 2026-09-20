import {
  Body,
  Controller,
  Get,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  Injectable,
  Post,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { Public } from '../../src/core/auth/decorators';
import {
  ALL_RATE_LIMIT_POLICIES,
  RateLimitGuard,
  RatePolicy,
  RateLimitPolicy,
} from '../../src/core/rate-limit';

/**
 * Política de límite de tasa (ADR-009).
 *
 * El fallo que motivó el rediseño: dos throttlers con nombre se aplicaban a
 * todas las rutas, y el cupo de login (10 cada 5 min) acababa limitando cada GET
 * de la navegación. Estas pruebas levantan una app mínima con el guard real y
 * límites pequeños para comprobar que cada ruta consume sólo su política.
 */

/** Sustituye a JwtAuthGuard: `x-user` hace las veces de usuario autenticado. */
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const id = req.headers['x-user'];
    if (id) req.user = { id };
    return true;
  }
}

@Controller()
class ProbeController {
  @Get('items')
  list() {
    return { ok: true };
  }

  @Post('items')
  create() {
    return { ok: true };
  }

  @Post('login')
  @Public()
  @RatePolicy(RateLimitPolicy.AUTH)
  login(@Body() _body: { email: string }) {
    return { ok: true };
  }

  @Get('public-list')
  @Public()
  publicList() {
    return { ok: true };
  }

  @Get('health')
  @Public()
  @RatePolicy(RateLimitPolicy.INTERNAL)
  health() {
    return { ok: true };
  }
}

const LIMITS: Record<RateLimitPolicy, number> = {
  auth: 3,
  public: 3,
  write: 4,
  read: 20,
  internal: 5,
};

describe('RateLimitGuard', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: ALL_RATE_LIMIT_POLICIES.map((policy) => ({
            name: policy,
            ttl: 60_000,
            limit: LIMITS[policy],
          })),
        }),
      ],
      controllers: [ProbeController],
      providers: [
        // Mismo orden que AppModule: autenticar → limitar.
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RateLimitGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('la navegación (GET) no consume el cupo del login', async () => {
    for (let i = 0; i < 15; i++) {
      await request(server()).get('/items').set('x-user', 'ana').expect(200);
    }
    // El cupo AUTH (3) sigue intacto.
    for (let i = 0; i < 3; i++) {
      await request(server()).post('/login').send({ email: 'ana@nodus.local' }).expect(201);
    }
  });

  it('las lecturas autenticadas cuentan por usuario, no por IP', async () => {
    for (let i = 0; i < LIMITS.read; i++) {
      await request(server()).get('/items').set('x-user', 'ana').expect(200);
    }
    await request(server()).get('/items').set('x-user', 'ana').expect(429);

    // Misma IP (todo llega por el proxy de Next), otro usuario: cupo propio.
    await request(server()).get('/items').set('x-user', 'bruno').expect(200);
  });

  it('escrituras y lecturas tienen cupos independientes', async () => {
    for (let i = 0; i < LIMITS.write; i++) {
      await request(server()).post('/items').set('x-user', 'ana').expect(201);
    }
    await request(server()).post('/items').set('x-user', 'ana').expect(429);
    await request(server()).get('/items').set('x-user', 'ana').expect(200);
  });

  it('el login es estricto y cuenta por IP y cuenta', async () => {
    for (let i = 0; i < LIMITS.auth; i++) {
      await request(server()).post('/login').send({ email: 'ana@nodus.local' }).expect(201);
    }
    await request(server()).post('/login').send({ email: 'ANA@nodus.local ' }).expect(429);

    // Otra cuenta desde la misma IP no queda bloqueada por los intentos de Ana.
    await request(server()).post('/login').send({ email: 'bruno@nodus.local' }).expect(201);
  });

  it('las rutas públicas sin política explícita usan el cupo PUBLIC', async () => {
    for (let i = 0; i < LIMITS.public; i++) {
      await request(server()).get('/public-list').expect(200);
    }
    await request(server()).get('/public-list').expect(429);
  });

  it('las sondas de salud tienen su propia política', async () => {
    // Agotar el cupo público no afecta al healthcheck, ni al revés.
    for (let i = 0; i < LIMITS.public; i++) {
      await request(server()).get('/public-list').expect(200);
    }
    for (let i = 0; i < LIMITS.internal; i++) {
      await request(server()).get('/health').expect(200);
    }
    await request(server()).get('/health').expect(429);
  });
});
