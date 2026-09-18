import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../core/config/configuration';

/**
 * Renderizador de plantillas TCOM.
 *
 * Sintaxis deliberadamente mínima: `{{variable}}` y nada más. Las plantillas son
 * datos editables por un administrador desde la base; darles un motor con
 * lógica (condicionales, bucles, llamadas) convertiría una fila de una tabla en
 * código ejecutable editable sin revisión, que es una vía de inyección obvia.
 *
 * Los valores se escapan para HTML al renderizar el cuerpo HTML; el cuerpo de
 * texto plano no lo necesita.
 */
@Injectable()
export class TemplateRendererService {
  private readonly appUrl: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.appUrl = config.get('http', { infer: true }).appUrl;
  }

  render(
    template: string,
    variables: Record<string, unknown>,
    options?: { escapeHtml?: boolean },
  ): string {
    const context = { ...variables, appUrl: this.appUrl };

    return template.replace(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g, (_match, path: string) => {
      const value = resolvePath(context, path);
      if (value === undefined || value === null) return '';
      const text = String(value);
      return options?.escapeHtml ? escapeHtml(text) : text;
    });
  }

  /** Cuerpo HTML sencillo y legible en cualquier cliente de correo. */
  toHtml(subject: string, body: string, ctaUrl?: string, ctaLabel?: string): string {
    const paragraphs = body
      .split(/\n{2,}/)
      .map((block) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
      .join('');

    const cta = ctaUrl
      ? `<p style="margin:24px 0 0">
           <a href="${escapeHtml(ctaUrl)}"
              style="display:inline-block;padding:11px 20px;background:#0f172a;color:#fff;
                     border-radius:8px;text-decoration:none;font-weight:600">
             ${escapeHtml(ctaLabel ?? 'Abrir en NODUS')}
           </a>
         </p>`
      : '';

    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f1f5f9;padding:28px 12px;
             font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;
              border:1px solid #e2e8f0;overflow:hidden">
    <div style="padding:18px 26px;border-bottom:1px solid #e2e8f0">
      <strong style="letter-spacing:.14em;font-size:13px;color:#475569">NODUS</strong>
    </div>
    <div style="padding:26px">
      <h1 style="margin:0 0 16px;font-size:18px;line-height:1.35">${escapeHtml(subject)}</h1>
      ${paragraphs}
      ${cta}
    </div>
    <div style="padding:16px 26px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">
      Mensaje automático de la plataforma NODUS. No responda a este correo.
    </div>
  </div>
</body></html>`;
  }
}

function resolvePath(context: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (accumulator, key) =>
        accumulator && typeof accumulator === 'object'
          ? (accumulator as Record<string, unknown>)[key]
          : undefined,
      context,
    );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
