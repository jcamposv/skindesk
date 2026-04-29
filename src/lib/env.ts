import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.success) {
  // Log without crashing the build so static generation does not blow up while
  // the project is still being wired up. Runtime usages will still throw via `env`.
  console.warn(
    "[env] Invalid or missing environment variables:",
    parsed.error.flatten().fieldErrors,
  );
}

/**
 * Validated, type-safe environment variables.
 * Throws at access time if validation failed.
 */
export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(_target, prop: string) {
    if (!parsed.success) {
      throw new Error(
        `[env] Cannot read "${prop}": environment validation failed. Check .env.local`,
      );
    }
    return parsed.data[prop as keyof typeof parsed.data];
  },
});
