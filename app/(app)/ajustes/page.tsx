'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Copy, LogOut, RefreshCw, Share2, Smartphone, UserMinus, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useHousehold } from '@/components/HouseholdProvider';
import { PageHeader } from '@/components/ui';
import { COLOR_CLASSES, MEMBER_COLORS } from '@/lib/constants';
import { errorMessage } from '@/lib/format';
import type { Household, MemberColor } from '@/lib/types';

export default function AjustesPage() {
  return (
    <Suspense>
      <Ajustes />
    </Suspense>
  );
}

function Ajustes() {
  const supabase = createClient();
  const router = useRouter();
  const isNew = useSearchParams().get('novo') === '1';
  const { me, members, partner } = useHousehold();
  const [household, setHousehold] = useState<Household | null>(null);
  const [name, setName] = useState(me.display_name);
  const [color, setColor] = useState<MemberColor>(me.color);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');

  const loadHousehold = useCallback(async () => {
    const { data } = await supabase.from('households').select('id, name, invite_code, invite_expires_at').single();
    setHousehold(data as Household);
  }, [supabase]);
  useEffect(() => { loadHousehold(); }, [loadHousehold]);

  async function saveProfile() {
    setErr('');
    const { error } = await supabase.from('profiles').update({ display_name: name.trim(), color }).eq('id', me.id);
    if (error) return setErr(errorMessage(error));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    router.refresh();
  }

  async function regenerate() {
    const { error } = await supabase.rpc('regenerate_invite_code');
    if (error) return setErr(errorMessage(error));
    loadHousehold();
  }

  const code = household?.invite_code;
  const expired = household?.invite_expires_at ? new Date(household.invite_expires_at) < new Date() : true;

  async function share() {
    if (!code) return;
    const text = `Entre no nosso app de casal! Crie sua conta em ${window.location.origin} e use o código: ${code}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Nós Dois', text }); } catch { /* cancelado */ }
    } else {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  async function leave() {
    const warn = partner
      ? 'Sair do casal? Você perde acesso aos dados compartilhados (eles continuam com seu par).'
      : 'Sair e APAGAR este espaço e todos os dados? Esta ação não pode ser desfeita.';
    if (!confirm(warn)) return;
    const { error } = await supabase.rpc('leave_household');
    if (error) return setErr(errorMessage(error));
    router.replace('/onboarding');
    router.refresh();
  }

  return (
    <>
      <PageHeader title="Ajustes" />
      <div className="space-y-4 px-4">
        {/* Convite */}
        {!partner && (
          <section className={`card space-y-3 ${isNew ? 'ring-2 ring-brand-500' : ''}`}>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-600" />
              <h2 className="font-semibold">Convide seu par</h2>
            </div>
            <p className="text-sm text-stone-500">
              Peça para ele(a) criar uma conta e escolher <b>“Tenho um código”</b>. O código vale por 7 dias e só pode ser usado uma vez.
            </p>
            {code && !expired ? (
              <>
                <div className="rounded-xl bg-stone-100 py-4 text-center font-mono text-3xl font-bold tracking-[0.3em]">{code}</div>
                <div className="flex gap-2">
                  <button onClick={copy} className="btn-ghost flex-1">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copiado' : 'Copiar'}
                  </button>
                  <button onClick={share} className="btn-primary flex-1"><Share2 className="h-4 w-4" /> Compartilhar</button>
                </div>
              </>
            ) : (
              <button onClick={regenerate} className="btn-primary w-full"><RefreshCw className="h-4 w-4" /> Gerar novo código</button>
            )}
          </section>
        )}

        {/* Perfil */}
        <section className="card space-y-3">
          <h2 className="font-semibold">Meu perfil</h2>
          <div>
            <label className="label">Nome</label>
            <input className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Minha cor</label>
            <div className="flex gap-2">
              {MEMBER_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-label={c}
                  className={`h-9 w-9 rounded-full ${COLOR_CLASSES[c].dot} ${color === c ? 'ring-4 ring-offset-2 ring-stone-300' : ''}`} />
              ))}
            </div>
          </div>
          <button onClick={saveProfile} className="btn-primary w-full" disabled={!name.trim()}>
            {saved ? <><Check className="h-4 w-4" /> Salvo</> : 'Salvar perfil'}
          </button>
        </section>

        {/* Casal */}
        <section className="card space-y-2">
          <h2 className="font-semibold">{household?.name ?? 'Nosso espaço'}</h2>
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-sm">
              <span className={`h-3 w-3 rounded-full ${COLOR_CLASSES[m.color].dot}`} />
              {m.display_name} {m.id === me.id && <span className="text-stone-400">(você)</span>}
            </div>
          ))}
        </section>

        {/* Instalar */}
        <section className="card space-y-1 text-sm text-stone-600">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-stone-900"><Smartphone className="h-4 w-4" /> Instalar no celular</h2>
          <p><b>iPhone (Safari):</b> Compartilhar → “Adicionar à Tela de Início”.</p>
          <p><b>Android (Chrome):</b> menu ⋮ → “Instalar app” ou “Adicionar à tela inicial”.</p>
        </section>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <div className="flex gap-2 pb-4">
          <button onClick={signOut} className="btn-ghost flex-1"><LogOut className="h-4 w-4" /> Sair da conta</button>
          <button onClick={leave} className="btn-danger"><UserMinus className="h-4 w-4" /> Deixar casal</button>
        </div>
      </div>
    </>
  );
}
