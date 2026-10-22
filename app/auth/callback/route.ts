import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Recebe o retorno dos e-mails do Supabase (link mágico / confirmação de cadastro).
 * Suporta os dois formatos: ?code=... (PKCE) e ?token_hash=...&type=...
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }

  // Redireciona sempre para um caminho interno fixo (evita open redirect)
  return NextResponse.redirect(new URL(ok ? '/agenda' : '/login?erro=link', origin));
}
