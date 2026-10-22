import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HouseholdProvider } from '@/components/HouseholdProvider';
import BottomNav from '@/components/BottomNav';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('profiles')
    .select('id, display_name, color, household_id')
    .eq('id', user.id)
    .single<Profile>();

  if (!me?.household_id) redirect('/onboarding');

  // RLS devolve apenas eu + meu par
  const { data: members } = await supabase
    .from('profiles')
    .select('id, display_name, color, household_id')
    .eq('household_id', me.household_id)
    .order('created_at');

  return (
    <HouseholdProvider value={{ me, householdId: me.household_id, members: (members ?? [me]) as Profile[] }}>
      <div className="mx-auto min-h-dvh max-w-2xl pb-24">{children}</div>
      <BottomNav />
    </HouseholdProvider>
  );
}
