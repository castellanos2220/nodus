import { Injectable } from '@nestjs/common';
import { CaseStatusCode, RoleCode } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../common/errors/domain.errors';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from './auth.types';

/**
 * Nivel de acceso de un usuario a un caso concreto.
 *
 *  · `FULL`      — ve el expediente completo (advisory, admin, consultor asignado,
 *                  y el cliente dueño del caso).
 *  · `REDACTED`  — ve una versión controlada, sin información sensible del
 *                  cliente. Es lo que ve un consultor postulante en la bolsa
 *                  interna (Punto 3: "los consultores solo acceden a una versión
 *                  controlada del caso").
 *  · `NONE`      — no debe saber siquiera que el caso existe.
 */
export type CaseAccessLevel = 'FULL' | 'REDACTED' | 'NONE';

export interface CaseAccessContext {
  caseId: string;
  status: CaseStatusCode;
  companyId: string;
  level: CaseAccessLevel;
  /** `true` si el usuario es el consultor responsable principal activo. */
  isLeadConsultant: boolean;
  /** `true` si el usuario es un contacto de la empresa del caso. */
  isClientOwner: boolean;
}

@Injectable()
export class CaseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resuelve el nivel de acceso. Una sola consulta con `select` acotado: no se
   * cargan las relaciones completas del caso sólo para decidir un permiso.
   */
  async resolve(user: AuthenticatedUser, caseId: string): Promise<CaseAccessContext> {
    const record = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        status: true,
        companyId: true,
        assignments: {
          where: { isActive: true },
          select: { consultantId: true, isPrimary: true },
        },
        applications: user.consultantId
          ? { where: { consultantId: user.consultantId }, select: { id: true } }
          : false,
      },
    });

    if (!record) {
      throw new NotFoundError('el caso', caseId);
    }

    const isLeadConsultant = Boolean(
      user.consultantId &&
        record.assignments.some(
          (assignment) => assignment.isPrimary && assignment.consultantId === user.consultantId,
        ),
    );
    const isSupportConsultant = Boolean(
      user.consultantId &&
        record.assignments.some((assignment) => assignment.consultantId === user.consultantId),
    );
    const isClientOwner = Boolean(user.companyId && user.companyId === record.companyId);

    const base = {
      caseId: record.id,
      status: record.status,
      companyId: record.companyId,
      isLeadConsultant,
      isClientOwner,
    };

    switch (user.role) {
      case RoleCode.SUPER_ADMIN:
      case RoleCode.ADVISORY:
        return { ...base, level: 'FULL' };

      case RoleCode.CLIENTE_MIPYME:
        // El cliente ve sus casos y sólo sus casos.
        return { ...base, level: isClientOwner ? 'FULL' : 'NONE' };

      case RoleCode.CONSULTOR: {
        if (isSupportConsultant) return { ...base, level: 'FULL' };
        // Postulante o consultor elegible mirando la bolsa: versión controlada.
        const hasApplied = Array.isArray(record.applications) && record.applications.length > 0;
        if (record.status === CaseStatusCode.EN_POSTULACION || hasApplied) {
          return { ...base, level: 'REDACTED' };
        }
        return { ...base, level: 'NONE' };
      }

      case RoleCode.CONSULTOR_REVISOR: {
        // El revisor experto ve el caso mientras la propuesta está en QA, y sólo
        // en versión controlada: su objeto de revisión es el documento, no el
        // expediente comercial del cliente.
        const qaStates: CaseStatusCode[] = [
          CaseStatusCode.PROPUESTA_LISTA_PARA_QA,
          CaseStatusCode.AJUSTES_DE_PROPUESTA,
        ];
        return { ...base, level: qaStates.includes(record.status) ? 'REDACTED' : 'NONE' };
      }

      default:
        return { ...base, level: 'NONE' };
    }
  }

  /** Exige al menos acceso de lectura (completo o controlado). */
  async assertCanRead(user: AuthenticatedUser, caseId: string): Promise<CaseAccessContext> {
    const context = await this.resolve(user, caseId);
    if (context.level === 'NONE') {
      // 404 y no 403: revelar que el caso existe ya es una filtración.
      throw new NotFoundError('el caso', caseId);
    }
    return context;
  }

  /** Exige acceso completo al expediente. */
  async assertFullAccess(user: AuthenticatedUser, caseId: string): Promise<CaseAccessContext> {
    const context = await this.assertCanRead(user, caseId);
    if (context.level !== 'FULL') {
      throw new ForbiddenError(
        'No tiene acceso completo a este caso',
        'CASE_ACCESS_REDACTED_ONLY',
      );
    }
    return context;
  }

  /** Exige ser el consultor responsable principal del caso. */
  async assertIsLeadConsultant(
    user: AuthenticatedUser,
    caseId: string,
  ): Promise<CaseAccessContext> {
    const context = await this.assertCanRead(user, caseId);
    if (!context.isLeadConsultant) {
      throw new ForbiddenError(
        'Sólo el consultor responsable principal del caso puede realizar esta acción',
        'NOT_LEAD_CONSULTANT',
      );
    }
    return context;
  }

  /** Exige ser el cliente dueño del caso. */
  async assertIsClientOwner(
    user: AuthenticatedUser,
    caseId: string,
  ): Promise<CaseAccessContext> {
    const context = await this.assertCanRead(user, caseId);
    if (!context.isClientOwner) {
      throw new ForbiddenError(
        'Sólo el cliente propietario del caso puede realizar esta acción',
        'NOT_CASE_OWNER',
      );
    }
    return context;
  }
}
