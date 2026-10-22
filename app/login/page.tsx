'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Mail, KeyRound, Loader2, Wand2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/format';

type Mode = 'password' | 'magic';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const redirectTo = () => `${window.location.origin}/auth/callback`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo() },
        });
        if (error) throw error;
        setMsg({ type: 'ok', text: 'Enviamos um link de acesso para o seu e-mail. 💌' });
      } else if (isSignUp) {
        if (password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo() },
        });
        if (error) throw error;
        if (data.session) {
          router.replace('/onboarding');
          router.refresh();
        } else {
          setMsg({ type: 'ok', text: 'Conta criada! Confirme pelo link enviado ao seu e-mail.' });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error('E-mail ou senha incorretos.');
        router.replace('/agenda');
        router.refresh();
      }
    } catch (err) {
      setMsg({ type: 'err', text: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="safe-top flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-stone-50 px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30">
            <Heart className="h-8 w-8 fill-white text-white" />
          </div>
          <h1 className="text-2xl font-bold">Nós Dois</h1>
          <p className="text-sm text-stone-500">Agenda, notas e finanças do casal</p>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-xl bg-stone-200/60 p-1 text-sm font-medium">
          {(['password', 'magic'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setMsg(null); }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${
                mode === m ? 'bg-white shadow-sm' : 'text-stone-500'
              }`}
            >
              {m === 'password' ? <KeyRound className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
              {m === 'password' ? 'Senha' : 'Link mágico'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="input pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {mode === 'password' && (
            <div>
              <label className="label" htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                required
                minLength={isSignUp ? 8 : undefined}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {msg && (
            <p className={`rounded-lg px-3 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {msg.text}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'magic' ? 'Enviar link de acesso' : isSignUp ? 'Criar conta' : 'Entrar'}
          </button>

          {mode === 'password' && (
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setMsg(null); }}
              className="w-full text-center text-sm text-stone-500 hover:text-stone-800"
            >
              {isSignUp ? 'Já tenho conta — entrar' : 'Primeira vez? Criar conta'}
            </button>
          )}
        </form>
      </div>
    </main>
  );
}
