'use client';

import * as React from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { intakeSchema, type IntakeInput } from '@nodus/types';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
} from '@/components/ui/primitives';

interface LookupOption {
  code: string;
  label: string;
}

interface IntakeResult {
  case: { id: string; code: string; title: string; createdAt: string };
  company: { code: string; name: string; wasCreated: boolean };
  user: { email: string; wasCreated: boolean; temporaryPassword: string | null };
}

/**
 * T1 — onboarding en dos bloques.
 *
 * La validación con Zod ocurre por bloque: el usuario no avanza al bloque 2 con
 * el 1 incompleto, y no descubre los errores del principio al final. Las mismas
 * reglas se revalidan en el backend, que es donde cuentan.
 */
export function IntakeForm() {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [options, setOptions] = React.useState<Record<string, LookupOption[]>>({});
  const [result, setResult] = React.useState<IntakeResult | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<IntakeInput>({
    resolver: zodResolver(intakeSchema),
    mode: 'onBlur',
  });

  // Las listas del formulario vienen del gobierno de LOV, no están escritas aquí.
  React.useEffect(() => {
    void fetch('/api/intake')
      .then((response) => response.json())
      .then((data: Record<string, LookupOption[]>) => setOptions(data))
      .catch(() => setOptions({}));
  }, []);

  const goToStep2 = async (): Promise<void> => {
    const valid = await trigger([
      'companyName',
      'contactFullName',
      'contactJobTitle',
      'contactEmail',
      'contactPhone',
      'country',
      'city',
      'acceptedTerms',
    ]);
    if (valid) setStep(2);
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const response = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as IntakeResult & { message?: string };

    if (!response.ok) {
      setServerError(payload.message ?? 'No fue posible registrar el caso.');
      return;
    }

    setResult(payload);
  });

  if (result) return <IntakeSuccess result={result} />;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <StepIndicator step={step} />

      {/* ------------------------------------------- Bloque 1: identificación */}
      <Card className={step === 1 ? '' : 'hidden'}>
        <CardHeader>
          <CardTitle>Bloque 1 · Identificación</CardTitle>
          <CardDescription>
            Sólo lo mínimo para identificar a su organización. Nada de estructura organizacional ni
            documentación legal en este punto.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nombre de la empresa"
            htmlFor="companyName"
            required
            error={errors.companyName?.message}
            className="sm:col-span-2"
          >
            <Input
              id="companyName"
              placeholder="Aceros del Norte S.A.S."
              {...register('companyName')}
            />
          </Field>

          <Field
            label="NIT o identificación"
            htmlFor="taxId"
            error={errors.taxId?.message}
            hint="Opcional, pero evita que se dupliquen registros de su empresa."
          >
            <Input id="taxId" placeholder="900123456-7" {...register('taxId')} />
          </Field>

          <Field label="País" htmlFor="country" required error={errors.country?.message}>
            <Input id="country" placeholder="Colombia" {...register('country')} />
          </Field>

          <Field label="Ciudad" htmlFor="city" required error={errors.city?.message}>
            <Input id="city" placeholder="Bogotá" {...register('city')} />
          </Field>

          <Field
            label="Nombre del contacto"
            htmlFor="contactFullName"
            required
            error={errors.contactFullName?.message}
          >
            <Input
              id="contactFullName"
              placeholder="María Restrepo"
              {...register('contactFullName')}
            />
          </Field>

          <Field
            label="Cargo"
            htmlFor="contactJobTitle"
            required
            error={errors.contactJobTitle?.message}
          >
            <Input
              id="contactJobTitle"
              placeholder="Gerente de Operaciones"
              {...register('contactJobTitle')}
            />
          </Field>

          <Field
            label="Correo corporativo"
            htmlFor="contactEmail"
            required
            error={errors.contactEmail?.message}
          >
            <Input
              id="contactEmail"
              type="email"
              placeholder="maria@empresa.com"
              {...register('contactEmail')}
            />
          </Field>

          <Field
            label="Teléfono o WhatsApp"
            htmlFor="contactPhone"
            required
            error={errors.contactPhone?.message}
          >
            <Input id="contactPhone" placeholder="+57 320 123 4567" {...register('contactPhone')} />
          </Field>

          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-4">
              <Checkbox className="mt-0.5" {...register('acceptedTerms')} />
              <span className="text-xs leading-relaxed text-ink-2">
                Acepto los términos de uso y la política de tratamiento de datos personales de la
                plataforma.
              </span>
            </label>
            {errors.acceptedTerms && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-danger" role="alert">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                {errors.acceptedTerms.message}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Button type="button" onClick={goToStep2} className="w-full sm:w-auto">
              Continuar <ArrowRight />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* --------------------------------------- Bloque 2: necesidad (T1) */}
      <Card className={step === 2 ? '' : 'hidden'}>
        <CardHeader>
          <CardTitle>Bloque 2 · Su necesidad</CardTitle>
          <CardDescription>
            Describa el problema con sus palabras. La plataforma añadirá etiquetas de clasificación,
            pero no modificará su relato.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Título del caso"
            htmlFor="title"
            required
            error={errors.title?.message}
            hint="Una frase que resuma el problema."
          >
            <Input
              id="title"
              placeholder="Pérdida de trazabilidad de inventario en planta"
              {...register('title')}
            />
          </Field>

          <Field
            label="Descripción del problema o necesidad"
            htmlFor="description"
            required
            error={errors.description?.message}
            hint="Qué ocurre, desde cuándo, a qué afecta y qué ha intentado. Mínimo 40 caracteres."
          >
            <Textarea
              id="description"
              rows={7}
              placeholder="Describa la situación con el detalle que considere necesario…"
              {...register('description')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Área del negocio"
              htmlFor="areaCode"
              required
              error={errors.areaCode?.message}
            >
              <Select id="areaCode" defaultValue="" {...register('areaCode')}>
                <option value="" disabled>
                  Seleccione…
                </option>
                {(options.AREA_PROBLEMA ?? []).map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Urgencia"
              htmlFor="urgencyCode"
              required
              error={errors.urgencyCode?.message}
            >
              <Select id="urgencyCode" defaultValue="" {...register('urgencyCode')}>
                <option value="" disabled>
                  Seleccione…
                </option>
                {(options.URGENCIA ?? []).map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Impacto estimado"
              htmlFor="impactCode"
              required
              error={errors.impactCode?.message}
            >
              <Select id="impactCode" defaultValue="" {...register('impactCode')}>
                <option value="" disabled>
                  Seleccione…
                </option>
                {(options.IMPACTO ?? []).map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {serverError && <FormError>{serverError}</FormError>}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>
              <ArrowLeft /> Volver
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1 sm:flex-none">
              {isSubmitting ? 'Registrando…' : 'Registrar el caso'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <ol className="flex items-center gap-3 text-sm">
      {([1, 2] as const).map((value) => {
        const done = step > value;
        const current = step === value;
        return (
          <li key={value} className="flex items-center gap-3">
            <span
              className={`tabular flex size-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                done
                  ? 'border-foreground bg-foreground text-card'
                  : current
                    ? 'border-brand bg-card text-foreground shadow-focus'
                    : 'border-border-strong bg-card text-muted-foreground'
              }`}
            >
              {done ? <Check className="size-3.5" strokeWidth={2.75} aria-hidden /> : value}
            </span>
            <span
              className={current || done ? 'font-medium text-foreground' : 'text-muted-foreground'}
            >
              {value === 1 ? 'Identificación' : 'Necesidad'}
            </span>
            {value === 1 && (
              <span
                className={`h-px w-12 ${step > 1 ? 'bg-brand' : 'bg-border-strong'}`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function IntakeSuccess({ result }: { result: IntakeResult }) {
  const [copied, setCopied] = React.useState(false);

  return (
    <Card>
      <CardContent className="space-y-6 py-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Su caso quedó registrado</h2>
            <p className="text-sm text-muted-foreground">
              Identificador del caso:{' '}
              <span className="font-mono font-semibold text-foreground">{result.case.code}</span>
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-border bg-background p-5">
          <p className="text-sm font-medium">Qué ocurre ahora</p>
          <ol className="space-y-2 text-sm leading-relaxed text-ink-2">
            <li>1. El equipo advisory revisa la información y hace la debida diligencia.</li>
            <li>2. El caso se clasifica con taxonomías gobernadas y se valida su elegibilidad.</li>
            <li>3. Se publica en la bolsa interna de consultores habilitados y elegibles.</li>
            <li>4. Advisory evalúa las postulaciones y designa un consultor responsable.</li>
            <li>5. Recibirá una propuesta estructurada para aceptar, ajustar o declinar.</li>
          </ol>
        </div>

        {result.user.temporaryPassword && (
          <div className="space-y-3 rounded-md border border-brand/30 bg-brand-soft/60 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <KeyRound className="size-4 text-brand-strong" aria-hidden /> Acceso a la plataforma
            </p>
            <p className="text-xs leading-relaxed text-ink-2">
              Hemos creado su cuenta para que pueda seguir el caso. Guarde esta contraseña temporal:
              se le pedirá cambiarla al entrar.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-sm">
                {result.user.temporaryPassword}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(result.user.temporaryPassword ?? '');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                <Copy /> {copied ? 'Copiada' : 'Copiar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Usuario: <span className="font-mono">{result.user.email}</span>
            </p>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/login">Entrar a la plataforma</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/intake">Registrar otro caso</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
