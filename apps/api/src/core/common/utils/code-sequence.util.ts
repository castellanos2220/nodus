import type { TxClient } from '../../prisma/prisma.service';

/**
 * Genera los identificadores legibles del sistema: `EMP-000001`, `CAS-000145`,
 * `CON-000023`, `SPO-000004`.
 *
 * Se usa `UPDATE ... RETURNING` sobre una fila de `code_sequences` dentro de la
 * misma transacción que crea la entidad. Eso da dos garantías que un `COUNT(*)+1`
 * no da:
 *
 *  1. **Sin carreras**: el UPDATE toma un lock de fila; dos peticiones
 *     simultáneas se serializan y obtienen números distintos.
 *  2. **Sin huecos por rollback**: si la transacción falla, el contador vuelve
 *     atrás con ella.
 */
export async function nextCode(
  tx: TxClient,
  prefix: 'EMP' | 'CAS' | 'CON' | 'SPO',
  padding = 6,
): Promise<string> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "code_sequences" ("prefix", "value", "updatedAt")
    VALUES (${prefix}, 1, NOW())
    ON CONFLICT ("prefix") DO UPDATE
      SET "value" = "code_sequences"."value" + 1, "updatedAt" = NOW()
    RETURNING "value"
  `;

  const value = rows[0]?.value ?? 1;
  return `${prefix}-${String(value).padStart(padding, '0')}`;
}
