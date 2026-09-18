import { Injectable } from '@nestjs/common';
import { ConsultantStatus, RoleCode, UserStatus } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';

export interface Recipient {
  userId: string;
  email: string;
  fullName: string;
  role: RoleCode;
}

/** Audiencias que una plantilla TCOM puede declarar. */
export type Audience =
  | 'CLIENTE'
  | 'CONSULTOR_ASIGNADO'
  | 'CONSULTORES_ELEGIBLES'
  | 'CONSULTORES_POSTULANTES'
  | 'ADVISORY'
  | 'REVISORES';

/**
 * Resuelve quién debe recibir una notificación.
 *
 * El blueprint define destinatarios **por evento y por rol**, no por usuario:
 * "cliente", "consultor asignado", "advisory". Este servicio traduce esa
 * audiencia a personas concretas en el momento del envío, que es cuando se sabe
 * quién ocupa cada papel en ese caso.
 */
@Injectable()
export class RecipientResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(audiences: Audience[], caseId: string | null): Promise<Recipient[]> {
    const found = new Map<string, Recipient>();

    for (const audience of audiences) {
      const recipients = await this.resolveOne(audience, caseId);
      for (const recipient of recipients) {
        found.set(recipient.userId, recipient);
      }
    }

    return [...found.values()];
  }

  private async resolveOne(audience: Audience, caseId: string | null): Promise<Recipient[]> {
    switch (audience) {
      case 'ADVISORY':
        return this.usersByRole([RoleCode.ADVISORY]);

      case 'CLIENTE': {
        if (!caseId) return [];
        const kase = await this.prisma.case.findUnique({
          where: { id: caseId },
          select: {
            contact: { select: { user: { select: USER_SELECT } } },
            company: {
              select: {
                users: {
                  where: { status: UserStatus.ACTIVO },
                  select: USER_SELECT,
                },
              },
            },
          },
        });
        if (!kase) return [];

        // El contacto del caso primero; si no tiene usuario, los de la empresa.
        const contactUser = kase.contact?.user;
        if (contactUser) return [toRecipient(contactUser)];
        return kase.company.users.map(toRecipient);
      }

      case 'CONSULTOR_ASIGNADO': {
        if (!caseId) return [];
        const assignment = await this.prisma.caseAssignment.findFirst({
          where: { caseId, isActive: true, isPrimary: true },
          select: { consultant: { select: { user: { select: USER_SELECT } } } },
        });
        return assignment ? [toRecipient(assignment.consultant.user)] : [];
      }

      case 'CONSULTORES_POSTULANTES': {
        if (!caseId) return [];
        const applications = await this.prisma.application.findMany({
          where: { caseId, status: { not: 'RETIRADA' } },
          select: { consultant: { select: { user: { select: USER_SELECT } } } },
        });
        return applications.map((application) => toRecipient(application.consultant.user));
      }

      case 'CONSULTORES_ELEGIBLES': {
        if (!caseId) return [];
        return this.eligibleConsultants(caseId);
      }

      case 'REVISORES':
        return this.usersByRole([RoleCode.CONSULTOR_REVISOR]);

      default:
        return [];
    }
  }

  /**
   * Consultores elegibles para un caso publicado.
   *
   * Aplica los mismos criterios que la bolsa interna: habilitado, complejidad
   * permitida, especialidad coincidente y alcance compatible. Es deliberadamente
   * la misma regla — notificar una oportunidad a quien no puede postularse sería
   * ruido, y peor, una filtración de información del caso.
   */
  private async eligibleConsultants(caseId: string): Promise<Recipient[]> {
    const kase = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: { areaCode: true, complexityCode: true, interventionTypeCode: true },
    });
    if (!kase) return [];

    const consultants = await this.prisma.consultant.findMany({
      where: {
        status: ConsultantStatus.HABILITADO,
        user: { status: UserStatus.ACTIVO },
        ...(kase.areaCode
          ? { specialties: { some: { specialtyCode: kase.areaCode } } }
          : {}),
      },
      select: {
        maxComplexityCode: true,
        scope: { select: { interventionTypeCodes: true } },
        user: { select: USER_SELECT },
      },
      take: 200,
    });

    const { COMPLEXITY_RANK } = await import('@nodus/types');
    const caseRank = kase.complexityCode ? (COMPLEXITY_RANK[kase.complexityCode] ?? 0) : 0;

    return consultants
      .filter((consultant) => {
        const allowedRank = consultant.maxComplexityCode
          ? (COMPLEXITY_RANK[consultant.maxComplexityCode] ?? 99)
          : 99;
        if (allowedRank < caseRank) return false;

        const types = consultant.scope?.interventionTypeCodes ?? [];
        if (kase.interventionTypeCode && types.length > 0) {
          return types.includes(kase.interventionTypeCode);
        }
        return true;
      })
      .map((consultant) => toRecipient(consultant.user));
  }

  private async usersByRole(roles: RoleCode[]): Promise<Recipient[]> {
    const users = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIVO, role: { code: { in: roles } } },
      select: USER_SELECT,
    });
    return users.map(toRecipient);
  }
}

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  status: true,
  role: { select: { code: true } },
} as const;

function toRecipient(user: {
  id: string;
  email: string;
  fullName: string;
  role: { code: RoleCode };
}): Recipient {
  return { userId: user.id, email: user.email, fullName: user.fullName, role: user.role.code };
}
