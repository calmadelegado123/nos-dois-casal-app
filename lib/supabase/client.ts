'use client';

import { createBrowserClient } from '@supabase/ssr';

function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

let client: ReturnType<typeof makeClient> | undefined;

/** Cliente Supabase para Client Components (singleton no navegador). */
export function createClient() {
  if (!client) client = makeClient();
  return client;
}
