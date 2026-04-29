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
