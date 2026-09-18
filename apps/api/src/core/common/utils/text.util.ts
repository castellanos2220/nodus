/** Sufijos societarios que no distinguen a una organización de otra. */
const LEGAL_SUFFIXES = [
  'sas',
  's a s',
  'sa',
  's a',
  'ltda',
  'limitada',
  'srl',
  's r l',
  'spa',
  'eirl',
  'sl',
  's l',
  'inc',
  'llc',
  'corp',
  'co',
  'cia',
  'compania',
  'y cia',
  'e u',
  'eu',
  'bic',
];

/** Dominios de correo personales: no identifican a una empresa. */
export const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.es',
  'outlook.com',
  'outlook.es',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.es',
  'icloud.com',
  'me.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'aol.com',
  'gmx.com',
  'mail.com',
  'yandex.com',
  'tutanota.com',
]);

/** Quita tildes y diacríticos. */
export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza una razón social para compararla: sin tildes, sin puntuación, sin
 * sufijos societarios, en minúsculas y con espacios colapsados.
 *
 *   "Aceros del Norte S.A.S."  →  "aceros del norte"
 *   "ACEROS DEL NORTE SAS"     →  "aceros del norte"
 */
export function normalizeCompanyName(value: string): string {
  let result = stripAccents(value.toLowerCase());
  result = result.replace(/[^a-z0-9\s]/g, ' ');
  result = result.replace(/\s+/g, ' ').trim();

  // Elimina el sufijo societario sólo si está al final: "co" en medio del nombre
  // ("co creacion") no es un sufijo.
  for (const suffix of LEGAL_SUFFIXES) {
    const pattern = new RegExp(`\\s+${suffix.replace(/\s/g, '\\s*')}$`);
    if (pattern.test(result)) {
      result = result.replace(pattern, '');
      break;
    }
  }

  return result.replace(/\s+/g, ' ').trim();
}

/** Normaliza un NIT/RUT para comparación: sólo alfanuméricos, en mayúsculas. */
export function normalizeTaxId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Extrae el dominio corporativo de un correo. Devuelve `null` para dominios
 * genéricos: "juan@gmail.com" no dice nada sobre a qué empresa pertenece.
 */
export function extractCorporateDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}

/** Recorta un texto en un límite de palabras sin cortar a mitad. */
export function truncateWords(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const cut = value.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
