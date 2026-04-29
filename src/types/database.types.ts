/**
 * Placeholder for Supabase generated types.
 * Regenerate with:
 *   npx supabase gen types typescript --project-id <your-project-id> > src/types/database.types.ts
 *
 * See https://supabase.com/docs/guides/api/rest/generating-types
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
