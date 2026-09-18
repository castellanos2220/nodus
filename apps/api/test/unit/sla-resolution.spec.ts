import { CaseStatusCode } from '@prisma/client';
import { SlaService, percentOf } from '../../src/modules/sla/sla.service';

/**
 * Resolución de reglas de SLA por especificidad.
 *
 * Es la pieza que hace real el requisito «no quemar horas en código» (§30): la
 * regla aplicable se elige en tiempo de ejecución según las dimensiones del caso.
 * Si esta lógica se rompiera, todos los casos usarían el SLA genérico y el
 * sistema mentiría sobre sus propios compromisos.
 */
describe('SlaService.resolveRule', () => {
  const service = new SlaService(
    {} as never, // no se usa: resolveRule recibe el cliente por parámetro
    {} as never,
  );

  const rule = (overrides: Record<string, unknown>) => ({
    id: overrides.id ?? 'rule',
    code: overrides.code ?? 'CODE',
    name: 'regla',
    stage: CaseStatusCode.PROPUESTA_EN_DISENO,
    durationHours: 120,
    warningThresholdPercent: 75,
    escalationAfterHours: null,
    complexityCode: null,
    interventionTypeCode: null,
    consultantLevelCode: null,
    clientSegmentCode: null,
    priorityCode: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const txWith = (rules: unknown[]) =>
    ({ slaRule: { findMany: async () => rules } }) as never;

  it('elige la regla general cuando no hay ninguna específica', async () => {
    const general = rule({ id: 'general', code: 'GENERAL', durationHours: 120 });

    const result = await service.resolveRule(txWith([general]), {
      stage: CaseStatusCode.PROPUESTA_EN_DISENO,
      complexityCode: 'MEDIO',
    });

    expect(result?.code).toBe('GENERAL');
  });

  it('prefiere la regla con más dimensiones coincidentes', async () => {
    const general = rule({ id: 'g', code: 'GENERAL', durationHours: 120 });
    const specific = rule({
      id: 's',
      code: 'ESTRATEGICO',
      durationHours: 240,
      complexityCode: 'ESTRATEGICO',
    });

    const result = await service.resolveRule(txWith([general, specific]), {
      stage: CaseStatusCode.PROPUESTA_EN_DISENO,
      complexityCode: 'ESTRATEGICO',
    });

    expect(result?.code).toBe('ESTRATEGICO');
    expect(result?.durationHours).toBe(240);
  });

  it('descarta una regla cuya dimensión no coincide', async () => {
    const general = rule({ id: 'g', code: 'GENERAL', durationHours: 120 });
    const forLowComplexity = rule({
      id: 's',
      code: 'BAJO',
      durationHours: 72,
      complexityCode: 'BAJO',
    });

    const result = await service.resolveRule(txWith([general, forLowComplexity]), {
      stage: CaseStatusCode.PROPUESTA_EN_DISENO,
      complexityCode: 'ALTO',
    });

    expect(result?.code).toBe('GENERAL');
  });

  it('a igual especificidad, gana la regla más exigente', async () => {
    const relaxed = rule({ id: 'a', code: 'RELAJADA', durationHours: 200, complexityCode: 'ALTO' });
    const strict = rule({ id: 'b', code: 'ESTRICTA', durationHours: 100, complexityCode: 'ALTO' });

    const result = await service.resolveRule(txWith([relaxed, strict]), {
      stage: CaseStatusCode.PROPUESTA_EN_DISENO,
      complexityCode: 'ALTO',
    });

    expect(result?.code).toBe('ESTRICTA');
  });

  it('combina varias dimensiones y elige la más específica de todas', async () => {
    const general = rule({ id: 'g', code: 'GENERAL' });
    const byComplexity = rule({ id: 'c', code: 'POR_COMPLEJIDAD', complexityCode: 'ALTO' });
    const byBoth = rule({
      id: 'b',
      code: 'POR_AMBAS',
      complexityCode: 'ALTO',
      priorityCode: 'ALTA',
    });

    const result = await service.resolveRule(txWith([general, byComplexity, byBoth]), {
      stage: CaseStatusCode.PROPUESTA_EN_DISENO,
      complexityCode: 'ALTO',
      priorityCode: 'ALTA',
    });

    expect(result?.code).toBe('POR_AMBAS');
  });

  it('devuelve null si la etapa no tiene ninguna regla', async () => {
    const result = await service.resolveRule(txWith([]), {
      stage: CaseStatusCode.CERRADO,
    });
    expect(result).toBeNull();
  });
});

describe('percentOf', () => {
  const start = new Date('2026-01-01T00:00:00Z');
  const deadline = new Date('2026-01-02T00:00:00Z'); // 24 h

  it('marca 0 % al inicio', () => {
    expect(percentOf(start, deadline, start)).toBe(0);
  });

  it('calcula la mitad del tiempo consumido', () => {
    expect(percentOf(start, deadline, new Date('2026-01-01T12:00:00Z'))).toBe(50);
  });

  it('supera el 100 % cuando está vencido', () => {
    expect(percentOf(start, deadline, new Date('2026-01-03T00:00:00Z'))).toBe(200);
  });

  it('devuelve 100 si el plazo es degenerado', () => {
    expect(percentOf(start, start, new Date())).toBe(100);
  });
});
