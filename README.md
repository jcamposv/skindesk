# SkinDesk

Plataforma de cuidado de la piel: combina tecnología y dermatología para ofrecer recomendaciones personalizadas, análisis de productos y rutinas adaptadas a cada tipo de piel.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · shadcn/ui (`base-nova`) · Supabase (Auth SSR + Postgres + Realtime) · React Hook Form + Zod · SWR · Server Actions · Resend · Sonner

## Setup

1. Copia `.env.example` → `.env.local` y rellena las claves:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` desde el dashboard de Supabase.
   - `RESEND_API_KEY` desde Resend.
   - `NEXT_PUBLIC_APP_URL` (ej. `http://localhost:3000`).
2. Instala dependencias: `npm install`
3. Genera tipos de Supabase cuando definas tablas:
   ```sh
   npx supabase gen types typescript --project-id <id> > src/types/database.types.ts
   ```
4. Activa RLS en cada tabla y define las policies estándar (`auth.uid() = user_id` en SELECT/INSERT/UPDATE/DELETE).

## Dev

```sh
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

## Auth

Habilitado: **Email + Password** y **Magic Link** (configurado en `src/types/supabase.ts → AUTH_CONFIG`). El callback de OAuth/Magic Link vive en `src/app/(auth)/auth/callback/route.ts`.

### Roles & multi-tenant

| Rol | Tenant | Resumen |
|-----|--------|---------|
| `super_admin` | none | Staff de SkinDesk. Acceso global. |
| `profesional` | owner | Cosmetóloga (paga la suscripción). Crea su tenant al firmar up. |
| `asistente` | member | Equipo de la cosmetóloga. Permisos granulares en `profiles.permissions` (jsonb). |
| `clienta` | member | Cliente final. Solo ve su propia info. |

Helpers SQL (SECURITY DEFINER, callables desde RLS):
`current_role()`, `current_tenant_id()`, `is_super_admin()`, `has_asistente_permission(key, level)`.

Trigger `handle_new_user()` mirror-ea `auth.users → public.profiles` y crea el tenant si el usuario hace self-signup como `profesional`. Para invitar a `asistente`/`clienta`, el profesional manda `tenant_id`, `role` y `full_name` en `raw_user_meta_data` al `auth.admin.createUser()`.

### Migrations & seeds

```sh
# Migrations al remoto (sin tocar data)
supabase db push

# Seeds al remoto (no destructivo, idempotente — corre todo supabase/seeds/*.sql)
npm run db:seed

# Regenerar tipos después de cada migración
npm run db:types

# Local (Docker): stack completo + reset destructivo + seeds + types
supabase start
supabase db reset           # corre migrations + supabase/seed.sql (que incluye seeds/*)
```

**Estructura de seeds:**
- `supabase/seeds/*.sql` — archivos numerados (`00_users_and_tenants.sql`, `10_clientas.sql`, …). Se corren en orden alfabético.
- `supabase/seed.sql` — wrapper con `\ir` para que `supabase db reset` los incluya. Cuando agregues un seed nuevo, sumá una línea `\ir seeds/<archivo>.sql`.
- Los seeds deben ser **idempotentes** (`on conflict do nothing`, `update ... where id = ...`) para que `npm run db:seed` se pueda re-correr sin romper.

**Pre-requisitos para `npm run db:seed`:**
- `psql` instalado (`brew install libpq && brew link --force libpq`).
- Variable `SUPABASE_DB_URL` en `.env.local` (Dashboard → Project Settings → Database → Connection string URI).

Seed inicial crea **1 usuario por rol** + 1 tenant. Credenciales en `supabase/seeds/00_users_and_tenants.sql` (todas con password `SkinDesk123!`).

## Estructura

```
src/
  app/
    (auth)/{login,register,auth/callback}
    (dashboard)/{dashboard,settings} + layout.tsx
    {layout,page,error,loading,not-found}.tsx
  actions/{auth,email}.actions.ts
  components/{forms,shared,providers,emails,ui}/
  hooks/{use-auth,use-realtime}.ts
  lib/{env,constants,utils,resend}.ts
  lib/supabase/{client,server,admin,middleware}.ts
  schemas/auth.schema.ts
  types/{supabase,database.types}.ts
  middleware.ts
```

## Branding

Paleta SkinDesk en `src/app/globals.css` (oklch):
- `primary` `#5D6F68` (sage)
- `secondary` `#D29482` (peach)
- `accent` `#D2A56A` (warm honey)
- `destructive` `#B66E55` (terracotta)
- `muted` `#A5B3A8` (sage light)

El sidebar usa `--sidebar = primary`. Foreground se calcula por contraste (blanco sobre sage oscuro).

Logo en `public/logo.svg`. El componente `<Logo />` (`src/components/shared/logo.tsx`) maneja `size` y `variant`.
