import { CaseStatusCode, RoleCode } from '@prisma/client';
import { GUARDS, PAYLOAD_DEPENDENT_GUARDS } from '../../src/modules/workflow/guards/workflow.guards';
import { TRANSITION_EFFECTS } from '../../src/modules/workflow/transitions/transition.effects';
import {
  TERMINAL_STATUSES,
  TRANSITIONS,
  findTransition,
  getTransition,
  transitionsFrom,
} from '../../src/modules/workflow/transitions/transitions.registry';

/**
 * El registro de transiciones es la especificación ejecutable de la máquina de
 * estados. Estas pruebas no comprueban implementación: comprueban que el grafo
 * declarado es coherente y que no se ha roto ninguna invariante estructural.
 *
 * Espejo normativo: `docs/workflow/transitions.md`.
 */
describe('Registro de transiciones', () => {
  it('declara exactamente las 21 transiciones documentadas', () => {
    expect(TRANSITIONS).toHaveLength(21);
  });

  it('no tiene códigos de transición duplicados', () => {
    const codes = TRANSITIONS.map((transition) => transition.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('cada guard referenciado existe en el registro de guards', () => {
    const missing = TRANSITIONS.flatMap((transition) =>
      transition.guards.filter((guard) => !(guard in GUARDS)),
    );
    expect(missing).toEqual([]);
  });

  it('cada transición con autoNext apunta a una transición existente', () => {
    for (const transition of TRANSITIONS) {
      if (!transition.autoNext) continue;
      const next = getTransition(transition.autoNext);
      expect(next).toBeDefined();
      // La encadenada debe partir del estado al que llega la primera.
      expect(next!.from).toBe(transition.to);
    }
  });

  it('todo estado no terminal tiene al menos una salida', () => {
    const withoutExit = Object.values(CaseStatusCode).filter(
      (status) => !TERMINAL_STATUSES.includes(status) && transitionsFrom(status).length === 0,
    );
    expect(withoutExit).toEqual([]);
  });

  it('todo estado es alcanzable desde CREADO', () => {
    const reachable = new Set<CaseStatusCode>([CaseStatusCode.CREADO]);
    const queue: CaseStatusCode[] = [CaseStatusCode.CREADO];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const transition of transitionsFrom(current)) {
        if (!reachable.has(transition.to)) {
          reachable.add(transition.to);
          queue.push(transition.to);
        }
      }
    }

    const unreachable = Object.values(CaseStatusCode).filter((status) => !reachable.has(status));
    expect(unreachable).toEqual([]);
  });

  it('los estados terminales no tienen salida', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(transitionsFrom(status)).toHaveLength(0);
    }
  });

  it('las transiciones de sistema no declaran roles, y las de usuario sí', () => {
    for (const transition of TRANSITIONS) {
      if (transition.scope === 'SYSTEM') {
        expect(transition.roles).toHaveLength(0);
      } else {
        expect(transition.roles.length).toBeGreaterThan(0);
      }
    }
  });

  it('sólo el sistema ejecuta las transiciones automáticas encadenadas', () => {
    const chained = TRANSITIONS.filter((transition) => transition.autoNext).map(
      (transition) => transition.autoNext!,
    );
    for (const code of chained) {
      expect(getTransition(code)!.scope).toBe('SYSTEM');
    }
  });

  it('cada transición que declara payload tiene al menos un guard o un efecto', () => {
    for (const transition of TRANSITIONS.filter((item) => item.requiresPayload)) {
      const hasGuard = transition.guards.length > 0;
      const hasEffect = Boolean(TRANSITION_EFFECTS[transition.code]);
      expect(hasGuard || hasEffect).toBe(true);
    }
  });

  it('los guards dependientes de payload están todos registrados', () => {
    for (const guard of PAYLOAD_DEPENDENT_GUARDS) {
      expect(GUARDS[guard]).toBeDefined();
    }
  });

  describe('autorización declarada', () => {
    it('un consultor no puede clasificar el caso', () => {
      const classify = getTransition('CLASSIFY')!;
      expect(classify.roles).not.toContain(RoleCode.CONSULTOR);
      expect(classify.roles).toContain(RoleCode.ADVISORY);
    });

    it('sólo el cliente decide sobre la propuesta', () => {
      for (const code of ['CLIENT_ACCEPT', 'CLIENT_DECLINE', 'CLIENT_REQUEST_ADJUSTMENTS']) {
        const transition = getTransition(code)!;
        expect(transition.roles).toEqual([RoleCode.CLIENTE_MIPYME]);
        expect(transition.scope).toBe('CLIENT_OWNER');
      }
    });

    it('sólo el consultor responsable envía la propuesta a QA y declara el cierre', () => {
      for (const code of ['SUBMIT_FOR_QA', 'SUBMIT_ADJUSTED', 'TECHNICAL_CLOSURE']) {
        const transition = getTransition(code)!;
        expect(transition.scope).toBe('LEAD_CONSULTANT');
        expect(transition.roles).toContain(RoleCode.CONSULTOR);
      }
    });

    it('el cierre y la autorización de ejecución son de Advisory', () => {
      for (const code of ['AUTHORIZE_EXECUTION', 'CLOSE_CASE']) {
        const transition = getTransition(code)!;
        expect(transition.roles).toContain(RoleCode.ADVISORY);
        expect(transition.roles).not.toContain(RoleCode.CONSULTOR);
        expect(transition.roles).not.toContain(RoleCode.CLIENTE_MIPYME);
      }
    });
  });

  describe('búsqueda de aristas', () => {
    it('encuentra la transición sólo desde su estado de origen', () => {
      expect(findTransition(CaseStatusCode.EN_REVISION, 'CLASSIFY')).toBeDefined();
      expect(findTransition(CaseStatusCode.CREADO, 'CLASSIFY')).toBeUndefined();
    });

    it('no permite cerrar un caso desde cualquier estado', () => {
      const from = Object.values(CaseStatusCode).filter(
        (status) => findTransition(status, 'CLOSE_CASE') !== undefined,
      );
      expect(from).toEqual([CaseStatusCode.LISTO_PARA_CIERRE]);
    });
  });

  describe('guards mínimos por etapa crítica', () => {
    it('la autorización de ejecución exige checklist y marco operativo', () => {
      const guards = getTransition('AUTHORIZE_EXECUTION')!.guards;
      expect(guards).toContain('GUARD_CONTRACT_CHECKLIST_COMPLETE');
      expect(guards).toContain('GUARD_OPERATIONAL_FRAMEWORK_UPLOADED');
    });

    it('el cierre exige checklist, respuesta del cliente y ambas evaluaciones', () => {
      const guards = getTransition('CLOSE_CASE')!.guards;
      expect(guards).toEqual(
        expect.arrayContaining([
          'GUARD_CLOSURE_CHECKLIST_COMPLETE',
          'GUARD_CLIENT_CLOSURE_RESPONSE',
          'GUARD_CUSTOMER_EVALUATION',
          'GUARD_CONSULTANT_EVALUATION',
        ]),
      );
    });

    it('el cierre técnico exige entregables, hitos e incidencias resueltas', () => {
      const guards = getTransition('TECHNICAL_CLOSURE')!.guards;
      expect(guards).toEqual(
        expect.arrayContaining([
          'GUARD_DELIVERABLES_READY',
          'GUARD_MILESTONES_SETTLED',
          'GUARD_NO_CRITICAL_OPEN_INCIDENTS',
        ]),
      );
    });

    it('la asignación protege el responsable principal único', () => {
      const guards = getTransition('ASSIGN_CONSULTANT')!.guards;
      expect(guards).toContain('GUARD_NO_ACTIVE_PRIMARY_ASSIGNMENT');
      expect(guards).toContain('GUARD_CONSULTANT_ENABLED');
      expect(guards).toContain('GUARD_CONSULTANT_COMPLEXITY_ALLOWED');
    });
  });
});
