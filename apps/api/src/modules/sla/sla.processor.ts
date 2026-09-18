import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MilestoneStatus } from '@prisma/client';
import { Queue, type Job } from 'bullmq';
import type { AppConfig } from '../../core/config/configuration';
import { domainEvent } from '../../core/events/domain-events';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { JOB_NAMES, QUEUE_NAMES } from '../../core/queue/queue.constants';
import { SlaService } from './sla.service';

/**
 * Programador de los barridos periódicos.
 *
 * Usa un *repeatable job* de BullMQ y no `@Cron` de Nest a propósito: con varias
 * réplicas del worker, `@Cron` dispararía en todas a la vez. BullMQ garantiza
 * que cada ocurrencia la procese un solo consumidor.
 */
@Injectable()
export class SlaScheduler implements OnModuleInit {
  private readonly logger = new Logger(SlaScheduler.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.SLA) private readonly queue: Queue,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    // Sólo el worker programa; la API no debe crear trabajos repetibles.
    if (!this.config.get('workerMode', { infer: true })) return;

    const cron = this.config.get('sla', { infer: true }).evaluationCron;

    await this.queue.add(
      JOB_NAMES.EVALUATE_SLA,
      {},
      { repeat: { pattern: cron }, jobId: 'sla-evaluation' },
    );
    await this.queue.add(
      JOB_NAMES.EVALUATE_MILESTONES,
      {},
      { repeat: { pattern: cron }, jobId: 'milestone-evaluation' },
    );

    this.logger.log(`Barridos de SLA e hitos programados con cron "${cron}"`);
  }
}

/**
 * Evaluación periódica de SLA e hitos.
 *
 * Este es el motivo de que exista un worker separado: recalcular consumos,
 * promover estados y emitir alertas no puede colgarse de una petición HTTP, y
 * tampoco debe competir con ella por el event loop.
 */
@Processor(QUEUE_NAMES.SLA, { concurrency: 1 })
export class SlaProcessor extends WorkerHost {
  private readonly logger = new Logger(SlaProcessor.name);

  constructor(
    private readonly sla: SlaService,
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {
    super();
  }

  async process(job: Job): Promise<{ handled: number }> {
    switch (job.name) {
      case JOB_NAMES.EVALUATE_SLA: {
        const events = await this.sla.evaluateOpenInstances();
        return { handled: events.length };
      }
      case JOB_NAMES.EVALUATE_MILESTONES:
        return { handled: await this.evaluateMilestones() };
      default:
        return { handled: 0 };
    }
  }

  /**
   * Hitos próximos a vencer y vencidos.
   *
   * Las marcas `atRiskNotifiedAt` / `overdueNotifiedAt` hacen el barrido
   * idempotente: un hito vencido genera **una** alerta, no una cada cinco
   * minutos hasta que alguien lo atienda.
   */
  private async evaluateMilestones(): Promise<number> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 48 * 3_600_000);
    const open: MilestoneStatus[] = [
      MilestoneStatus.PENDIENTE,
      MilestoneStatus.EN_CURSO,
      MilestoneStatus.REPROGRAMADO,
    ];

    const [atRisk, overdue] = await Promise.all([
      this.prisma.milestone.findMany({
        where: {
          status: { in: open },
          targetDate: { gt: now, lte: horizon },
          atRiskNotifiedAt: null,
        },
        take: 200,
        select: MILESTONE_SELECT,
      }),
      this.prisma.milestone.findMany({
        where: {
          status: { in: open },
          targetDate: { lte: now },
          overdueNotifiedAt: null,
        },
        take: 200,
        select: MILESTONE_SELECT,
      }),
    ]);

    for (const milestone of atRisk) {
      await this.prisma.milestone.update({
        where: { id: milestone.id },
        data: { atRiskNotifiedAt: now },
      });
      await this.events.publish(
        domainEvent('MilestoneAtRisk', {
          actorId: null,
          caseId: milestone.caseId,
          companyId: milestone.case.companyId,
          payload: {
            caseCode: milestone.case.code,
            caseTitle: milestone.case.title,
            milestoneName: milestone.name,
            targetDate: milestone.targetDate.toISOString(),
            criticality: milestone.criticality,
          },
        }),
      );
    }

    for (const milestone of overdue) {
      await this.prisma.milestone.update({
        where: { id: milestone.id },
        data: { overdueNotifiedAt: now },
      });
      await this.events.publish(
        domainEvent('MilestoneOverdue', {
          actorId: null,
          caseId: milestone.caseId,
          companyId: milestone.case.companyId,
          payload: {
            caseCode: milestone.case.code,
            caseTitle: milestone.case.title,
            milestoneName: milestone.name,
            targetDate: milestone.targetDate.toISOString(),
            criticality: milestone.criticality,
          },
        }),
      );
    }

    const handled = atRisk.length + overdue.length;
    if (handled > 0) {
      this.logger.log(`Hitos: ${atRisk.length} en riesgo, ${overdue.length} vencidos`);
    }
    return handled;
  }
}

const MILESTONE_SELECT = {
  id: true,
  caseId: true,
  name: true,
  targetDate: true,
  criticality: true,
  case: { select: { code: true, title: true, companyId: true } },
} as const;
