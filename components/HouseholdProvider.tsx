'use client';

import { createContext, useContext } from 'react';
import type { Profile } from '@/lib/types';
import { COLOR_CLASSES } from '@/lib/constants';

interface HouseholdCtx {
  me: Profile;
  householdId: string;
  members: Profile[];
}

const Ctx = createContext<HouseholdCtx | null>(null);

export function HouseholdProvider({ value, children }: { value: HouseholdCtx; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHousehold() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useHousehold fora do HouseholdProvider');

  const memberById = (id: string | null | undefined) => ctx.members.find((m) => m.id === id);
  const nameOf = (id: string | null | undefined, fallback = 'Ambos') => memberById(id)?.display_name ?? fallback;
  const colorOf = (id: string | null | undefined) => COLOR_CLASSES[memberById(id)?.color ?? 'slate'];
  const partner = ctx.members.find((m) => m.id !== ctx.me.id) ?? null;

  return { ...ctx, partner, memberById, nameOf, colorOf };
}
