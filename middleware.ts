import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Ignora assets estáticos, ícones, manifest e service worker
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|offline.html|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)',
  ],
};
