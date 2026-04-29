import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

// Singleton: createBrowserClient does NOT dedupe internally, so calling it on
// every render (e.g. inside a hook with useEffect deps) detaches and reattaches
// the auth listener. One client per browser tab is what we want.
let _client: SupabaseClient<Database> | null = null;

/** Returns the (singleton) Supabase client for Client Components. */
export function createClient(): SupabaseClient<Database> {
  if (!_client) {
    _client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _client;
}
