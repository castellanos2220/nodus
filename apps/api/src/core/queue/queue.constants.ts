/**
 * Colas BullMQ.
 *
 * Todo lo que no tiene que ocurrir dentro del ciclo de vida de una petición HTTP
 * vive aquí: envío de correo, materialización de notificaciones, evaluación
 * periódica de SLA y emisión de alertas. El brief lo pide explícitamente
 * (§5, §28, §51: "No mandar emails dentro de requests lentos").
 */
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'nodus.notifications',
  EMAIL: 'nodus.email',
  SLA: 'nodus.sla',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  /** Resuelve destinatarios + plantilla y crea filas `Notification`. */
  DISPATCH_NOTIFICATION: 'dispatch-notification',
  /** Envía una `Notification` concreta por SMTP. */
  SEND_EMAIL: 'send-email',
  /** Barrido periódico: recalcula consumo, marca AT_RISK/OVERDUE, alerta. */
  EVALUATE_SLA: 'evaluate-sla',
  /** Barrido periódico de hitos próximos a vencer / vencidos. */
  EVALUATE_MILESTONES: 'evaluate-milestones',
} as const;

/**
 * Política de reintentos por defecto.
 *
 * Backoff exponencial desde 5 s: un SMTP caído se recupera solo sin martillear.
 * `removeOnComplete` acotado evita que Redis crezca sin fin; se conservan los
 * últimos fallos para poder diagnosticar.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 86_400 * 7, count: 5_000 },
} as const;
