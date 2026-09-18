import {
  extractCorporateDomain,
  normalizeCompanyName,
  normalizeTaxId,
  stripAccents,
  truncateWords,
} from '../../src/core/common/utils/text.util';

/**
 * La normalización de nombres de empresa es lo que hace funcionar el principio
 * de Empresa Única. Si falla, se duplican empresas y se rompe el historial
 * empresarial consolidado — el efecto exacto que el principio existe para evitar.
 */
describe('normalizeCompanyName', () => {
  it('elimina tildes, puntuación y colapsa espacios', () => {
    expect(normalizeCompanyName('  Aceros  del   Nórte  ')).toBe('aceros del norte');
  });

  it('reconoce la misma empresa escrita de formas distintas', () => {
    const variants = [
      'Aceros del Norte S.A.S.',
      'ACEROS DEL NORTE SAS',
      'aceros del norte s a s',
      'Aceros del Norte',
    ];
    const normalized = variants.map(normalizeCompanyName);
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe('aceros del norte');
  });

  it('quita los sufijos societarios más comunes', () => {
    expect(normalizeCompanyName('Vitalis Salud Ltda.')).toBe('vitalis salud');
    expect(normalizeCompanyName('Industrias Cobre LIMITADA')).toBe('industrias cobre');
    expect(normalizeCompanyName('Tech Partners Inc')).toBe('tech partners');
  });

  it('no confunde un sufijo con una palabra que forma parte del nombre', () => {
    // "co" es sufijo sólo al final; aquí es parte del nombre.
    expect(normalizeCompanyName('Co Creacion Digital')).toBe('co creacion digital');
  });

  it('distingue empresas realmente distintas', () => {
    expect(normalizeCompanyName('Aceros del Norte')).not.toBe(
      normalizeCompanyName('Aceros del Sur'),
    );
  });
});

describe('normalizeTaxId', () => {
  it('ignora guiones, puntos y espacios', () => {
    expect(normalizeTaxId('900.123.456-7')).toBe('9001234567');
    expect(normalizeTaxId('900 123 456 7')).toBe('9001234567');
    expect(normalizeTaxId('900123456-7')).toBe('9001234567');
  });

  it('devuelve null cuando no hay valor útil', () => {
    expect(normalizeTaxId(null)).toBeNull();
    expect(normalizeTaxId('')).toBeNull();
    expect(normalizeTaxId('---')).toBeNull();
  });
});

describe('extractCorporateDomain', () => {
  it('extrae el dominio de un correo corporativo', () => {
    expect(extractCorporateDomain('maria@acerosdelnorte.com')).toBe('acerosdelnorte.com');
  });

  it('descarta los dominios genéricos: no identifican a una empresa', () => {
    for (const email of [
      'juan@gmail.com',
      'ana@hotmail.com',
      'luis@outlook.es',
      'sara@yahoo.com',
      'pepe@icloud.com',
    ]) {
      expect(extractCorporateDomain(email)).toBeNull();
    }
  });

  it('devuelve null si el valor no es un correo', () => {
    expect(extractCorporateDomain('no-es-un-correo')).toBeNull();
  });
});

describe('stripAccents', () => {
  it('elimina diacríticos conservando las letras', () => {
    expect(stripAccents('Medellín Bogotá Ñuñoa')).toBe('Medellin Bogota Nunoa');
  });
});

describe('truncateWords', () => {
  it('no toca los textos que caben', () => {
    expect(truncateWords('texto corto', 50)).toBe('texto corto');
  });

  it('recorta sin partir una palabra por la mitad', () => {
    const original = 'la trazabilidad del inventario es deficiente';
    const result = truncateWords(original, 20);

    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(21);

    // El texto conservado debe ser un prefijo del original que termina justo
    // antes de un espacio: ninguna palabra queda cortada por la mitad.
    const kept = result.slice(0, -1);
    expect(original.startsWith(kept)).toBe(true);
    expect(original[kept.length]).toBe(' ');
  });
});
