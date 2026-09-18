'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { LookupList } from '@/features/cases/types';

/**
 * Catálogo de listas de valores.
 *
 * Se carga una sola vez por sesión de navegación (`staleTime` largo) porque
 * alimenta todos los selectores de la aplicación y cambia muy poco. El backend
 * también la cachea; aquí evitamos además la ida y vuelta.
 */
export function useLookups() {
  return useQuery({
    queryKey: ['lookups'],
    queryFn: () => api.get<LookupList[]>('/lookups'),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}

/** Valores de una lista concreta, listos para un `<select>`. */
export function useLookupValues(listCode: string) {
  const { data, isLoading } = useLookups();
  const list = data?.find((item) => item.code === listCode);
  return { values: list?.values ?? [], isLoading };
}

/**
 * Traductor de código a etiqueta.
 *
 * La API devuelve códigos (`OPERACIONES`); la interfaz muestra etiquetas
 * («Operaciones»). La traducción vive aquí y no en el backend porque la etiqueta
 * es presentación: el dato gobernado es el código.
 */
export function useLookupLabel() {
  const { data } = useLookups();

  return (listCode: string, code: string | null | undefined): string => {
    if (!code) return '—';
    const value = data
      ?.find((list) => list.code === listCode)
      ?.values.find((item) => item.code === code);
    if (value) return value.label;

    // Sin catálogo cargado todavía: se muestra el código legible en vez de vacío.
    const text = code.replace(/_/g, ' ').toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
}
