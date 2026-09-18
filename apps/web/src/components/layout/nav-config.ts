import type { Role } from '@nodus/types';
import {
  Building2,
  ClipboardList,
  FileStack,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  ScrollText,
  Settings2,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Roles que ven el enlace. Ocultar no protege: el backend decide. */
  roles: Role[];
  description: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL: Role[] = [
  'SUPER_ADMIN',
  'ADVISORY',
  'CONSULTOR',
  'CONSULTOR_REVISOR',
  'CLIENTE_MIPYME',
];

/**
 * Navegación por rol.
 *
 * Es **presentación**: mostrar sólo lo que cada rol usa evita una interfaz
 * confusa. No es seguridad — cualquiera puede escribir la URL a mano, y ahí es
 * el backend quien responde 403. Ese es el reparto correcto.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operación',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        roles: ALL,
        description: 'Indicadores y casos que requieren atención',
      },
      {
        href: '/cases',
        label: 'Casos',
        icon: FolderKanban,
        roles: ALL,
        description: 'Ciclo de vida completo de los casos',
      },
      {
        href: '/opportunities',
        label: 'Oportunidades',
        icon: ClipboardList,
        roles: ['CONSULTOR'],
        description: 'Bolsa interna de casos elegibles',
      },
      {
        href: '/proposals',
        label: 'QA de propuestas',
        icon: FileStack,
        roles: ['SUPER_ADMIN', 'ADVISORY', 'CONSULTOR_REVISOR'],
        description: 'Propuestas pendientes de revisión metodológica',
      },
    ],
  },
  {
    label: 'Ecosistema',
    items: [
      {
        href: '/companies',
        label: 'Empresas',
        icon: Building2,
        roles: ['SUPER_ADMIN', 'ADVISORY'],
        description: 'Empresa única — casos múltiples',
      },
      {
        href: '/consultants',
        label: 'Consultores',
        icon: Users,
        roles: ['SUPER_ADMIN', 'ADVISORY'],
        description: 'Ecosistema curado de consultores',
      },
    ],
  },
  {
    label: 'Gobierno',
    items: [
      {
        href: '/sla',
        label: 'SLA',
        icon: Timer,
        roles: ['SUPER_ADMIN', 'ADVISORY'],
        description: 'Relojes, alertas y reglas parametrizadas',
      },
      {
        href: '/audit',
        label: 'Auditoría',
        icon: ShieldCheck,
        roles: ['SUPER_ADMIN', 'ADVISORY'],
        description: 'Bitácora inmutable de la plataforma',
      },
      {
        href: '/settings',
        label: 'Configuración',
        icon: Settings2,
        roles: ['SUPER_ADMIN'],
        description: 'Listas de valores, roles y plantillas',
      },
    ],
  },
];

export function navForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

export { Gauge, ScrollText };
