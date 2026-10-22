'use client';

import { useEffect, useRef } from 'react';
import { createClient } from './supabase/client';

/**
 * Escuta INSERT/UPDATE/DELETE das tabelas informadas (filtradas pelo household)
 * e chama `onChange`. O RLS também é aplicado pelo Supabase Realtime.
 * Estratégia simples e robusta: a cada mudança, a tela recarrega seus dados.
 */
export function useRealtime(householdId: string, tables: string[], onChange: () => void) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const key = tables.join(',');

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      // agrupa rajadas de eventos (ex.: série de 12 parcelas) em uma recarga só
      clearTimeout(timer);
      timer = setTimeout(() => cb.current(), 250);
    };

    const channel = supabase.channel(`hh-${householdId}-${key}`);
    for (const table of key.split(',')) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` },
        fire,
      );
      // DELETE com RLS só traz a PK, então o filtro por household não casa; escuta à parte
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, fire);
    }
    channel.subscribe();

    // ao voltar para o app (celular desbloqueado), sincroniza
    const onVisible = () => document.visibilityState === 'visible' && fire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [householdId, key]);
}
