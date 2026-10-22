'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HeartHandshake, Home, KeyRound, Loader2, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/format';

export default function OnboardingForm({ defaultName }: { defaultName: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [step, setStep] = useState<'choose' | 'create' | 'join'>('choose');
  const [displayName, setDisplayName] = useState(defaultName);
  const [householdName, setHouseholdName] = useState('Nosso lar');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function saveName() {
    const name = displayName.trim();
    if (!name) throw new Error('Informe como você quer ser chamado(a).');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', user!.id);
    if (error) throw error;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await saveName();
      const { error } =
        step === 'create'
          ? await supabase.rpc('create_household', { p_name: householdName })
          : await supabase.rpc('join_household', { p_code: code });
      if (error) throw error;
      router.replace(step === 'create' ? '/ajustes?novo=1' : '/agenda');
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <main className="safe-top mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <HeartHandshake className="mb-4 h-10 w-10 text-brand-600" />
      <h1 className="text-2xl font-bold">Vamos conectar vocês dois</h1>
      <p className="mb-6 text-sm text-stone-500">
        Um de vocês cria o casal e compartilha o código. O outro entra com esse código.
      </p>

      {step === 'choose' ? (
        <div className="space-y-3">
          <button onClick={() => setStep('create')} className="card flex w-full items-center gap-4 text-left hover:ring-brand-500">
            <Home className="h-6 w-6 text-brand-600" />
            <div>
              <p className="font-semibold">Criar nosso espaço</p>
              <p className="text-sm text-stone-500">Gera um código para convidar seu par</p>
            </div>
          </button>
          <button onClick={() => setStep('join')} className="card flex w-full items-center gap-4 text-left hover:ring-brand-500">
            <KeyRound className="h-6 w-6 text-brand-600" />
            <div>
              <p className="font-semibold">Tenho um código</p>
              <p className="text-sm text-stone-500">Entrar no espaço que meu par criou</p>
            </div>
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label">Seu nome no app</label>
            <input className="input" value={displayName} maxLength={40} required
              onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex.: Édipo" />
          </div>

          {step === 'create' ? (
            <div>
              <label className="label">Nome do espaço</label>
              <input className="input" value={householdName} maxLength={80}
                onChange={(e) => setHouseholdName(e.target.value)} />
            </div>
          ) : (
            <div>
              <label className="label">Código de convite</label>
              <input className="input text-center font-mono text-lg uppercase tracking-[0.3em]"
                value={code} maxLength={8} required autoCapitalize="characters" autoComplete="off"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ABCD2345" />
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => { setStep('choose'); setError(''); }}>
              Voltar
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === 'create' ? 'Criar e gerar código' : 'Entrar no casal'}
            </button>
          </div>
        </form>
      )}

      <button onClick={signOut} className="mx-auto mt-8 flex items-center gap-1 text-sm text-stone-400 hover:text-stone-700">
        <LogOut className="h-4 w-4" /> Sair
      </button>
    </main>
  );
}
