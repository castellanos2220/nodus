import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService, type AuditActor } from '../../core/audit/audit.service';
import { CACHE_KEYS, CacheService } from '../../core/cache/cache.service';
import {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from '../../core/common/errors/domain.errors';
import { PrismaService, type TxClient } from '../../core/prisma/prisma.service';

export interface LookupValueView {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  metadata: Prisma.JsonValue | null;
}

export interface UpsertLookupValueInput {
  code: string;
  label: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Gobierno de listas de valores (RT-015 .. RT-017).
 *
 * Toda clasificación crítica del sistema —área, tipo de intervención,
 * complejidad, urgencia, impacto, especialidad, sector…— apunta al `code` de un
 * `LookupValue`. Ningún formulario acepta texto libre en esos campos, y el
 * backend lo verifica: `assertValidCode` se llama antes de persistir cualquier
 * clasificación.
 *
 * Las listas se cachean porque se leen en casi todas las pantallas y cambian muy
 * poco; toda escritura invalida el prefijo, así que nadie ve un valor obsoleto.
 */
@Injectable()
export class LookupsService {
  private static readonly CACHE_TTL_SECONDS = 600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
  ) {}

  /** Todas las listas con sus valores activos. Una sola consulta, cacheada. */
  async findAll(includeInactive = false) {
    if (includeInactive) return this.loadAll(true);

    return this.cache.remember(CACHE_KEYS.lookupAll(), LookupsService.CACHE_TTL_SECONDS, () =>
      this.loadAll(false),
    );
  }

  async findByCode(listCode: string, includeInactive = false): Promise<LookupValueView[]> {
    const load = async (): Promise<LookupValueView[]> => {
      const list = await this.prisma.lookupList.findUnique({
        where: { code: listCode },
        select: {
          values: {
            where: includeInactive ? {} : { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
            select: {
              id: true,
              code: true,
              label: true,
              description: true,
              sortOrder: true,
              isActive: true,
              metadata: true,
            },
          },
        },
      });

      if (!list) throw new NotFoundError(`la lista de valores ${listCode}`);
      return list.values;
    };

    if (includeInactive) return load();
    return this.cache.remember(
      CACHE_KEYS.lookupList(listCode),
      LookupsService.CACHE_TTL_SECONDS,
      load,
    );
  }

  /**
   * Verifica que un código pertenece a la lista y está activo.
   *
   * Es el punto que hace real el principio "sin texto libre en clasificaciones
   * críticas": si alguien envía `areaCode: "lo que sea"`, aquí se rechaza.
   */
  async assertValidCode(
    tx: TxClient,
    listCode: string,
    value: string | null | undefined,
    fieldLabel: string,
  ): Promise<void> {
    if (!value) return;

    const exists = await tx.lookupValue.findFirst({
      where: { code: value, isActive: true, list: { code: listCode } },
      select: { id: true },
    });

    if (!exists) {
      throw new ValidationError(
        `El valor "${value}" no es válido para ${fieldLabel}.`,
        { field: fieldLabel, listCode, received: value },
        'INVALID_LOOKUP_VALUE',
      );
    }
  }

  /** Verifica varios códigos de una vez, agrupando los errores. */
  async assertValidCodes(
    tx: TxClient,
    checks: Array<{ listCode: string; value: string | null | undefined; fieldLabel: string }>,
  ): Promise<void> {
    const invalid: Array<{ field: string; listCode: string; received: string }> = [];

    for (const check of checks) {
      if (!check.value) continue;
      const exists = await tx.lookupValue.findFirst({
        where: { code: check.value, isActive: true, list: { code: check.listCode } },
        select: { id: true },
      });
      if (!exists) {
        invalid.push({
          field: check.fieldLabel,
          listCode: check.listCode,
          received: check.value,
        });
      }
    }

    if (invalid.length > 0) {
      throw new ValidationError(
        `Hay ${invalid.length} clasificación(es) con valores no permitidos: ` +
          invalid.map((item) => `${item.field}="${item.received}"`).join(', '),
        invalid,
        'INVALID_LOOKUP_VALUE',
      );
    }
  }

  async upsertValue(
    listCode: string,
    input: UpsertLookupValueInput,
    actor: AuditActor,
  ): Promise<LookupValueView> {
    const list = await this.prisma.lookupList.findUnique({
      where: { code: listCode },
      select: { id: true },
    });
    if (!list) throw new NotFoundError(`la lista de valores ${listCode}`);

    const existing = await this.prisma.lookupValue.findUnique({
      where: { listId_code: { listId: list.id, code: input.code } },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const value = await tx.lookupValue.upsert({
        where: { listId_code: { listId: list.id, code: input.code } },
        create: {
          listId: list.id,
          code: input.code,
          label: input.label,
          description: input.description ?? null,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
        update: {
          label: input.label,
          description: input.description ?? null,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
        select: {
          id: true,
          code: true,
          label: true,
          description: true,
          sortOrder: true,
          isActive: true,
          metadata: true,
        },
      });

      await this.audit.record(tx, actor, {
        action: existing ? 'LOOKUP_VALUE_UPDATED' : 'LOOKUP_VALUE_CREATED',
        entity: 'LookupValue',
        entityId: value.id,
        previousValue: existing
          ? { label: existing.label, isActive: existing.isActive, sortOrder: existing.sortOrder }
          : null,
        newValue: { listCode, code: value.code, label: value.label, isActive: value.isActive },
      });

      return value;
    });

    await this.invalidate(listCode);
    return result;
  }

  /**
   * Desactiva un valor. **No se borra**: hay casos históricos clasificados con
   * él, y perder esa etiqueta rompería la analítica y la trazabilidad.
   */
  async deactivateValue(listCode: string, code: string, actor: AuditActor): Promise<void> {
    const value = await this.prisma.lookupValue.findFirst({
      where: { code, list: { code: listCode } },
      select: { id: true, isActive: true },
    });
    if (!value) throw new NotFoundError(`el valor ${code} de la lista ${listCode}`);
    if (!value.isActive) {
      throw new BusinessRuleError('LOOKUP_ALREADY_INACTIVE', 'El valor ya está inactivo');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.lookupValue.update({ where: { id: value.id }, data: { isActive: false } });
      await this.audit.record(tx, actor, {
        action: 'LOOKUP_VALUE_DEACTIVATED',
        entity: 'LookupValue',
        entityId: value.id,
        previousValue: { isActive: true },
        newValue: { isActive: false },
        metadata: { listCode, code },
      });
    });

    await this.invalidate(listCode);
  }

  private async loadAll(includeInactive: boolean) {
    const lists = await this.prisma.lookupList.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        values: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
          select: {
            id: true,
            code: true,
            label: true,
            description: true,
            sortOrder: true,
            isActive: true,
            metadata: true,
          },
        },
      },
    });

    return lists;
  }

  private async invalidate(listCode: string): Promise<void> {
    await this.cache.del(CACHE_KEYS.lookupList(listCode), CACHE_KEYS.lookupAll());
  }
}
