import { type PrismaClient, RoleCode } from '@prisma/client';
import { ROLE_PERMISSIONS, type Permission } from '@nodus/types';

const ROLE_METADATA: Record<RoleCode, { name: string; description: string }> = {
  SUPER_ADMIN: {
    name: 'Super administrador',
    description: 'Gobierno total de la plataforma, incluidas LOV, SLA y usuarios',
  },
  ADVISORY: {
    name: 'Advisory / PMO',
    description:
      'Orquestador neutral: debida diligencia, clasificación, asignación, QA, veeduría y cierre',
  },
  CONSULTOR: {
    name: 'Consultor',
    description: 'Responsable profesional de la solución en los casos que le son asignados',
  },
  CONSULTOR_REVISOR: {
    name: 'Consultor revisor',
    description: 'Revisión experta independiente de propuestas (peer review)',
  },
  CLIENTE_MIPYME: {
    name: 'Cliente Mipyme',
    description: 'Registra necesidades, decide sobre propuestas y acepta el cierre',
  },
};

/** Módulo al que pertenece cada permiso, para agrupar la administración. */
function moduleOf(permission: string): string {
  const prefix = permission.split('_')[0] ?? 'GENERAL';
  const map: Record<string, string> = {
    COMPANY: 'companies',
    CASE: 'cases',
    CONSULTANT: 'consultants',
    APPLICATION: 'applications',
    PROPOSAL: 'proposals',
    CONTRACT: 'contracts',
    DOCUMENT: 'documents',
    AUDIT: 'audit',
    SLA: 'sla',
    LOOKUP: 'lookups',
    NOTIFICATION: 'notifications',
    DASHBOARD: 'dashboard',
    USER: 'users',
  };
  return map[prefix] ?? 'general';
}

/**
 * Siembra roles, permisos y su relación desde la matriz declarada en
 * `@nodus/types`.
 *
 * Que la matriz viva en el paquete compartido y la base se derive de ella evita
 * la divergencia clásica: el frontend cree que un rol puede algo que la base no
 * le concede. `GET /roles` expone ambas para poder detectar cualquier deriva.
 */
export async function seedRbac(prisma: PrismaClient): Promise<void> {
  const allPermissions = [
    ...new Set(Object.values(ROLE_PERMISSIONS).flatMap((list) => [...list])),
  ] as Permission[];

  for (const code of allPermissions) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, module: moduleOf(code), description: describePermission(code) },
      update: { module: moduleOf(code), description: describePermission(code) },
    });
  }

  for (const roleCode of Object.values(RoleCode)) {
    const metadata = ROLE_METADATA[roleCode];

    const role = await prisma.role.upsert({
      where: { code: roleCode },
      create: { code: roleCode, name: metadata.name, description: metadata.description },
      update: { name: metadata.name, description: metadata.description },
      select: { id: true },
    });

    const permissions = ROLE_PERMISSIONS[roleCode] ?? [];
    const permissionRows = await prisma.permission.findMany({
      where: { code: { in: [...permissions] } },
      select: { id: true },
    });

    // Se reemplaza el conjunto completo: la matriz del código es la verdad.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissionRows.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }
}

function describePermission(code: string): string {
  const descriptions: Record<string, string> = {
    COMPANY_CREATE: 'Crear empresas',
    COMPANY_READ: 'Consultar empresas',
    COMPANY_UPDATE: 'Actualizar empresas y contactos',
    CASE_CREATE: 'Crear casos',
    CASE_READ: 'Consultar casos',
    CASE_UPDATE: 'Editar un caso en estado CREADO',
    CASE_CLASSIFY: 'Registrar la clasificación T2',
    CASE_PUBLISH: 'Publicar el caso en la bolsa interna',
    CASE_ASSIGN: 'Asignar el consultor responsable',
    CASE_EXECUTE: 'Gestionar la ejecución del caso',
    CASE_CLOSE: 'Ejecutar el cierre formal',
    CASE_DECIDE: 'Decidir sobre la propuesta y el cierre como cliente',
    CONSULTANT_READ: 'Consultar el ecosistema de consultores',
    CONSULTANT_MANAGE: 'Registrar, clasificar y habilitar consultores',
    CONSULTANT_SELF: 'Gestionar el propio perfil de consultor',
    APPLICATION_CREATE: 'Postularse a oportunidades',
    APPLICATION_READ: 'Consultar postulaciones',
    APPLICATION_EVALUATE: 'Evaluar postulaciones (T3D)',
    PROPOSAL_CREATE: 'Construir y editar propuestas',
    PROPOSAL_READ: 'Consultar propuestas',
    PROPOSAL_REVIEW: 'Registrar revisiones de propuesta',
    PROPOSAL_APPROVE: 'Aprobar y autorizar el envío de propuestas',
    CONTRACT_MANAGE: 'Gestionar el checklist y las evidencias de contratación',
    DOCUMENT_READ: 'Consultar y descargar documentos',
    DOCUMENT_UPLOAD: 'Cargar documentos',
    AUDIT_READ: 'Consultar la bitácora de auditoría',
    SLA_MANAGE: 'Administrar reglas de SLA',
    LOOKUP_MANAGE: 'Administrar listas de valores',
    LOOKUP_READ: 'Consultar listas de valores',
    NOTIFICATION_READ: 'Consultar las propias notificaciones',
    DASHBOARD_READ: 'Consultar indicadores',
    USER_MANAGE: 'Administrar usuarios y roles',
  };
  return descriptions[code] ?? code;
}
