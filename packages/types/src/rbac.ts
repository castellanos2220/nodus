import { Permission, Role } from './enums';

/**
 * Matriz rol → permisos.
 *
 * Es la fuente de la que el seed llena las tablas `Role`/`Permission`/`RolePermission`,
 * y de la que el frontend deduce qué pintar. **La autorización real se resuelve
 * siempre en backend** leyendo la base de datos (`PermissionsGuard`), nunca desde
 * esta constante en el navegador: si el frontend se equivoca, el backend rechaza.
 *
 * Además del permiso, casi toda acción pasa por `CaseAccessGuard`, que comprueba la
 * relación del usuario con el recurso concreto (su empresa, su caso asignado, …).
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // Acceso total; incluye gobierno de plataforma.
  [Role.SUPER_ADMIN]: Object.values(Permission),

  // Orquestador neutral: gobierna el proceso, no ejecuta el servicio.
  [Role.ADVISORY]: [
    Permission.COMPANY_CREATE,
    Permission.COMPANY_READ,
    Permission.COMPANY_UPDATE,
    Permission.CASE_CREATE,
    Permission.CASE_READ,
    Permission.CASE_UPDATE,
    Permission.CASE_CLASSIFY,
    Permission.CASE_PUBLISH,
    Permission.CASE_ASSIGN,
    Permission.CASE_CLOSE,
    Permission.CONSULTANT_READ,
    Permission.CONSULTANT_MANAGE,
    Permission.APPLICATION_READ,
    Permission.APPLICATION_EVALUATE,
    Permission.PROPOSAL_READ,
    Permission.PROPOSAL_REVIEW,
    Permission.PROPOSAL_APPROVE,
    Permission.CONTRACT_MANAGE,
    Permission.DOCUMENT_READ,
    Permission.DOCUMENT_UPLOAD,
    Permission.AUDIT_READ,
    Permission.LOOKUP_READ,
    Permission.NOTIFICATION_READ,
    Permission.DASHBOARD_READ,
  ],

  // Responsable profesional de la solución en los casos que le son asignados.
  [Role.CONSULTOR]: [
    Permission.CASE_READ,
    Permission.CASE_EXECUTE,
    Permission.CONSULTANT_SELF,
    Permission.APPLICATION_CREATE,
    Permission.APPLICATION_READ,
    Permission.PROPOSAL_CREATE,
    Permission.PROPOSAL_READ,
    Permission.DOCUMENT_READ,
    Permission.DOCUMENT_UPLOAD,
    Permission.LOOKUP_READ,
    Permission.NOTIFICATION_READ,
  ],

  // Revisión experta independiente (peer review). No ejecuta ni propone.
  [Role.CONSULTOR_REVISOR]: [
    Permission.CASE_READ,
    Permission.CONSULTANT_SELF,
    Permission.PROPOSAL_READ,
    Permission.PROPOSAL_REVIEW,
    Permission.DOCUMENT_READ,
    Permission.LOOKUP_READ,
    Permission.NOTIFICATION_READ,
  ],

  // Cliente: sólo sus propios casos y sólo sus propias decisiones.
  [Role.CLIENTE_MIPYME]: [
    Permission.COMPANY_READ,
    Permission.CASE_CREATE,
    Permission.CASE_READ,
    Permission.CASE_UPDATE,
    Permission.CASE_DECIDE,
    Permission.PROPOSAL_READ,
    Permission.DOCUMENT_READ,
    Permission.DOCUMENT_UPLOAD,
    Permission.LOOKUP_READ,
    Permission.NOTIFICATION_READ,
  ],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Secciones de navegación visibles por rol. Puramente cosmético: ocultar un
 * enlace no protege nada, la protección está en los guards del backend.
 */
export const NAV_VISIBILITY: Record<Role, readonly string[]> = {
  [Role.SUPER_ADMIN]: [
    'dashboard',
    'cases',
    'companies',
    'consultants',
    'proposals',
    'documents',
    'sla',
    'audit',
    'settings',
  ],
  [Role.ADVISORY]: [
    'dashboard',
    'cases',
    'companies',
    'consultants',
    'proposals',
    'documents',
    'sla',
    'audit',
  ],
  [Role.CONSULTOR]: ['dashboard', 'opportunities', 'cases', 'proposals', 'documents'],
  [Role.CONSULTOR_REVISOR]: ['dashboard', 'reviews', 'proposals'],
  [Role.CLIENTE_MIPYME]: ['dashboard', 'cases', 'documents'],
};
