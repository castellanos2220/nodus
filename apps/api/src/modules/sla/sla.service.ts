import { Injectable, Logger } from '@nestjs/common';
import {
  CaseStatusCode,
  Prisma,
  SlaAlertKind,
  SlaStatus,
  type SlaRule,
} from '@prisma/client';
import { PrismaService, type TxClient } from '../../core/prisma/prisma.service';
import { domainEvent, type DomainEvent } from '../../core/events/domain-events';
import { EventBusService } from '../../core/events/event-bus.service';

export interface SlaResolutionContext {
  stage: string;
  complexityCode?: string | null;
  interventionTypeCode?: string | null;
  consultantLevelCode?: string | null;
  clientSegmentCode?: string | null;
  priorityCode?: string | null;
}

/**
 * Motor de SLA.
 *
 * Principio no negociable del brief (§30): **ninguna hora está escrita en
 * código**. Las duraciones, umbrales y escalamientos son filas de `SlaRule`, y
 * se resuelven por especificidad en tiempo de ejecución. Cambiar el SLA de una
 * etapa para casos de complejidad ALTA es insertar una fila, no desplegar.
 */
@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  /**
   * Elige la regla **más específica** que aplica.
   *
   * Se traen las reglas activas de la etapa y se puntúa cada una: +1 por cada
   * dimensión que la regla fija y que coincide con el contexto; descartada si
   * fija una dimensión que **no** coincide. Gana la de mayor puntuación, y a
   * igualdad, la de menor duración (la más exigente).
   */
  async resolveRule(tx: TxClient, context: SlaResolutionContext): Promise<SlaRule | null> {
    const candidates = await tx.slaRule.findMany({
      where: { stage: context.stage, isActive: true },
    });

    const dimensions: Array<[keyof SlaRule, string | null | undefined]> = [
      ['complexityCode', context.complexityCode],
      ['interventionTypeCode', context.interventionTypeCode],
      ['consultantLevelCode', context.consultantLevelCode],
      ['clientSegmentCode', context.clientSegmentCode],
      ['priorityCode', context.priorityCode],
    ];

    let best: { rule: SlaRule; score: number } | null = null;

    for (const rule of candidates) {
      let score = 0;
      let compatible = true;

      for (const [field, value] of dimensions) {
        const ruleValue = rule[field] as string | null;
        if (ruleValue === null || ruleValue === undefined) continue; // comodín
        if (ruleValue === value) {
          score += 1;
        } else {
          compatible = false;
          break;
        }
      }

      if (!compatible) continue;
      if (
        !best ||
        score > best.score ||
        (score === best.score && rule.durationHours < best.rule.durationHours)
      ) {
        best = { rule, score };
      }
    }

    return best?.rule ?? null;
  }

  /**
   * Reacciona a una transición de caso: cierra el reloj de la etapa que termina
   * y abre el de la que empieza. Se ejecuta dentro de la transacción de la
   * transición, por lo que un rollback deja los relojes intactos.
   */
  async onTransition(
    tx: TxClient,
    input: {
      caseId: string;
      companyId: string;
      from: CaseStatusCode | null;
      to: CaseStatusCode;
      complexityCode?: string | null;
      interventionTypeCode?: string | null;
      clientSegmentCode?: string | null;
      urgencyCode?: string | null;
      consultantLevelCode?: string | null;
    },
  ): Promise<void> {
    if (input.from) {
      await this.completeOpenInstances(tx, input.caseId, input.from);
    }

    // Los estados terminales no abren reloj nuevo.
    if (
      input.to === CaseStatusCode.CERRADO ||
      input.to === CaseStatusCode.CERRADO_SIN_CONTRATACION
    ) {
      await this.cancelOpenInstances(tx, input.caseId);
      return;
    }

    const rule = await this.resolveRule(tx, {
      stage: input.to,
      complexityCode: input.complexityCode,
      interventionTypeCode: input.interventionTypeCode,
      clientSegmentCode: input.clientSegmentCode,
      priorityCode: input.urgencyCode,
      consultantLevelCode: input.consultantLevelCode,
    });

    if (!rule) return; // No toda etapa tiene SLA definido; es válido.

    const startedAt = new Date();
    const deadline = new Date(startedAt.getTime() + rule.durationHours * 3_600_000);

    await tx.slaInstance.create({
      data: {
        caseId: input.caseId,
        ruleId: rule.id,
        stage: input.to,
        startedAt,
        deadline,
        status: SlaStatus.ON_TRACK,
        percentConsumed: new Prisma.Decimal(0),
      },
    });
  }

  /** Marca como cumplidas las instancias abiertas de una etapa. */
  async completeOpenInstances(
    tx: TxClient,
    caseId: string,
    stage: CaseStatusCode,
  ): Promise<void> {
    const open = await tx.slaInstance.findMany({
      where: {
        caseId,
        stage,
        status: { in: [SlaStatus.ON_TRACK, SlaStatus.AT_RISK, SlaStatus.OVERDUE] },
      },
      select: { id: true, startedAt: true, deadline: true },
    });

    const now = new Date();
    for (const instance of open) {
      await tx.slaInstance.update({
        where: { id: instance.id },
        data: {
          status: SlaStatus.COMPLETED,
          completedAt: now,
          percentConsumed: new Prisma.Decimal(
            percentOf(instance.startedAt, instance.deadline, now).toFixed(2),
          ),
        },
      });
    }
  }

  private async cancelOpenInstances(tx: TxClient, caseId: string): Promise<void> {
    await tx.slaInstance.updateMany({
      where: {
        caseId,
        status: { in: [SlaStatus.ON_TRACK, SlaStatus.AT_RISK, SlaStatus.OVERDUE] },
      },
      data: { status: SlaStatus.CANCELLED, completedAt: new Date() },
    });
  }

  /**
   * Barrido periódico (worker). Recalcula el consumo de cada instancia abierta,
   * promueve su estado y emite las alertas que falten.
   *
   * Está escrito para no cargar toda la tabla: se filtra por estado abierto y se
   * ordena por `deadline`, que es exactamente el índice `(status, deadline)`.
   * Las alertas son idempotentes gracias al único `(instanceId, kind)`: si el
   * worker corre dos veces, no duplica avisos.
   */
  async evaluateOpenInstances(batchSize = 500): Promise<DomainEvent[]> {
    const now = new Date();
    const open = await this.prisma.slaInstance.findMany({
      where: { status: { in: [SlaStatus.ON_TRACK, SlaStatus.AT_RISK, SlaStatus.OVERDUE] } },
      orderBy: { deadline: 'asc' },
      take: batchSize,
      select: {
        id: true,
        caseId: true,
        stage: true,
        startedAt: true,
        deadline: true,
        status: true,
        case: { select: { code: true, companyId: true, title: true } },
        rule: {
          select: {
            code: true,
            name: true,
            warningThresholdPercent: true,
            escalationAfterHours: true,
          },
        },
      },
    });

    const events: DomainEvent[] = [];

    for (const instance of open) {
      const percent = percentOf(instance.startedAt, instance.deadline, now);
      const nextStatus =
        now > instance.deadline
          ? SlaStatus.OVERDUE
          : percent >= instance.rule.warningThresholdPercent
            ? SlaStatus.AT_RISK
            : SlaStatus.ON_TRACK;

      // Siempre se actualiza: el porcentaje consumido cambia en cada pasada
      // aunque el estado no lo haga, y es lo que ordena el tablero por riesgo.
      await this.prisma.slaInstance.update({
        where: { id: instance.id },
        data: {
          status: nextStatus,
          percentConsumed: new Prisma.Decimal(Math.min(percent, 999).toFixed(2)),
        },
      });

      if (nextStatus === SlaStatus.AT_RISK && instance.status === SlaStatus.ON_TRACK) {
        const created = await this.createAlertOnce(
          instance.id,
          SlaAlertKind.PREVENTIVA,
          `El SLA "${instance.rule.name}" del caso ${instance.case.code} ha consumido el ${percent.toFixed(0)} % de su tiempo.`,
          percent,
        );
        if (created) {
          events.push(
            domainEvent('SlaAtRisk', {
              actorId: null,
              caseId: instance.caseId,
              companyId: instance.case.companyId,
              payload: {
                caseCode: instance.case.code,
                caseTitle: instance.case.title,
                stage: instance.stage,
                ruleName: instance.rule.name,
                percentConsumed: Number(percent.toFixed(2)),
                deadline: instance.deadline.toISOString(),
              },
            }),
          );
        }
      }

      if (nextStatus === SlaStatus.OVERDUE && instance.status !== SlaStatus.OVERDUE) {
        const created = await this.createAlertOnce(
          instance.id,
          SlaAlertKind.VENCIMIENTO,
          `El SLA "${instance.rule.name}" del caso ${instance.case.code} está vencido.`,
          percent,
        );
        if (created) {
          events.push(
            domainEvent('SlaOverdue', {
              actorId: null,
              caseId: instance.caseId,
              companyId: instance.case.companyId,
              payload: {
                caseCode: instance.case.code,
                caseTitle: instance.case.title,
                stage: instance.stage,
                ruleName: instance.rule.name,
                deadline: instance.deadline.toISOString(),
              },
            }),
          );
        }
      }

      // Escalamiento: sólo si la regla lo define y se superó el margen extra.
      const escalationHours = instance.rule.escalationAfterHours;
      if (
        nextStatus === SlaStatus.OVERDUE &&
        escalationHours !== null &&
        now.getTime() - instance.deadline.getTime() >= escalationHours * 3_600_000
      ) {
        const escalated = await this.escalateOnce(
          instance.id,
          `Vencido hace más de ${escalationHours} h sin resolución.`,
        );
        if (escalated) {
          events.push(
            domainEvent('SlaEscalated', {
              actorId: null,
              caseId: instance.caseId,
              companyId: instance.case.companyId,
              payload: {
                caseCode: instance.case.code,
                stage: instance.stage,
                ruleName: instance.rule.name,
                hoursOverdue: Math.round(
                  (now.getTime() - instance.deadline.getTime()) / 3_600_000,
                ),
              },
            }),
          );
        }
      }
    }

    // Los eventos se publican aquí y no dentro del bucle: el barrido no está en
    // ninguna transacción, así que no hay nada que esperar, pero publicarlos
    // juntos mantiene el mismo contrato que el resto del sistema (nada sale
    // hasta que el trabajo está hecho).
    for (const event of events) {
      await this.events.publish(event);
    }

    if (events.length > 0) {
      this.logger.log(`Evaluación de SLA: ${events.length} evento(s) publicado(s)`);
    }

    return events;
  }

  /** Crea la alerta si no existía. El único `(instanceId, kind)` la hace idempotente. */
  private async createAlertOnce(
    instanceId: string,
    kind: SlaAlertKind,
    message: string,
    percent: number,
  ): Promise<boolean> {
    try {
      await this.prisma.slaAlert.create({
        data: {
          instanceId,
          kind,
          message,
          percentAtAlert: new Prisma.Decimal(Math.min(percent, 999).toFixed(2)),
        },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false; // ya existía: el worker corrió antes
      }
      throw error;
    }
  }

  private async escalateOnce(instanceId: string, reason: string): Promise<boolean> {
    const existing = await this.prisma.slaEscalation.findFirst({
      where: { instanceId, resolvedAt: null },
      select: { id: true },
    });
    if (existing) return false;

    await this.prisma.slaEscalation.create({ data: { instanceId, level: 1, reason } });
    await this.createAlertOnce(instanceId, SlaAlertKind.ESCALAMIENTO, reason, 100);
    return true;
  }
}

/** Porcentaje de tiempo consumido entre inicio y deadline. */
export function percentOf(startedAt: Date, deadline: Date, now: Date): number {
  const total = deadline.getTime() - startedAt.getTime();
  if (total <= 0) return 100;
  return ((now.getTime() - startedAt.getTime()) / total) * 100;
}
