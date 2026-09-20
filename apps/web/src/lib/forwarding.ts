/**
 * Cabeceras de origen que el servidor de Next reenvía a la API.
 *
 * Todas las llamadas del navegador pasan por los route handlers de Next, así
 * que la API ve siempre la IP del contenedor web. Sin reenviar la IP real, el
 * límite de tasa de login y del registro público metería a todos los usuarios
 * en el mismo cupo, y la auditoría registraría la misma IP para todos.
 *
 * Next ya rellena `x-forwarded-for` con la dirección del socket cuando la
 * petición no la trae; aquí sólo se propaga. La API decide si confía en ella
 * (`TRUST_PROXY`, ver ADR-009).
 */
export function forwardedHeaders(source: Headers): Record<string, string> {
  const headers: Record<string, string> = {};
  const forwardedFor = source.get('x-forwarded-for');
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  const userAgent = source.get('user-agent');
  if (userAgent) headers['user-agent'] = userAgent;
  return headers;
}
