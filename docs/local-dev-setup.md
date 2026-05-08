# Setup local de Supabase (plan de migración)

Este documento describe el plan para pasar de "todo contra Supabase remoto" a un flujo **local-first**: desarrollar contra una DB local rápida, y empujar cambios a Supabase + Vercel cuando estén listos.

> **Estado:** plan acordado, **no ejecutado todavía**. Ejecutar paso a paso cuando se decida arrancar.

---

## Objetivo

```
[edit code] → supabase start (Docker)
              ↓
         desarrollo contra DB local (rápido, gratis, reset libre)
              ↓
         supabase migration new <nombre>   ← cuando un cambio queda firme
         supabase db reset                 ← valida la migración desde cero
              ↓
         git commit + push
              ↓
         Vercel deploy (auto)
         supabase db push --linked         ← aplica migración a remoto
              ↓
         npm run db:types                  ← regenera types desde remoto
```

---

## Pre-requisitos

- ✅ Supabase CLI instalada (v2.98.2)
- ✅ Docker instalado y corriendo (v29.4.2)
- ✅ Proyecto linkeado al ref remoto `yzxuqlpqhtljzbhyqbes`
- ✅ 14 migraciones ya versionadas en `supabase/migrations/`
- ✅ `supabase/seed.sql` que carga `seeds/00_users_and_tenants.sql` automáticamente con `db reset`

---

## Pasos del plan

### 1. Backup del `.env.local` actual (remoto)

El `.env.local` actual apunta al Supabase remoto. Hay que preservarlo antes de sobrescribirlo.

```bash
cp .env.local .env.remote.local
```

`.env.remote.local` queda gitignoreado (el patrón `.env*` ya lo cubre) y sirve como fuente de verdad para volver al modo remoto cuando haga falta.

### 2. Levantar Supabase local

```bash
supabase start
```

Primera vez: descarga imágenes Docker (~5 min, ~2 GB). Al terminar imprime las URLs y keys locales:

- API URL: `http://127.0.0.1:54321`
- DB URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: `http://127.0.0.1:54323`
- Inbucket (capturador de email para auth): `http://127.0.0.1:54324`
- `anon key` y `service_role key` específicas del proyecto

> Las keys locales se firman con el JWT secret del `config.toml`. Para verlas en cualquier momento: `supabase status -o env`.

### 3. Generar el nuevo `.env.local` (modo local)

Reemplazar el contenido del `.env.local` con las URLs/keys locales que imprimió `supabase start`. Las keys de Resend/Stripe se mantienen iguales al modo remoto (son cuentas externas, no dependen de la DB).

Estructura sugerida:

```bash
# === Supabase LOCAL ===
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon key impreso por supabase status>"
SUPABASE_SERVICE_ROLE_KEY="<service_role key impreso por supabase status>"
SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# === Resend (mismo en local y remoto) ===
RESEND_API_KEY="<misma key>"
EMAIL_FROM="SkinDesk <onboarding@resend.dev>"   # sandbox de Resend para dev

# === Stripe TEST (mismas keys, distinto webhook secret) ===
STRIPE_SECRET_KEY="<sk_test_xxx>"
STRIPE_WEBHOOK_SECRET="<whsec_xxx que imprime `stripe listen`>"
STRIPE_PRICE_BASICO="<price_xxx test>"
STRIPE_PRICE_PRO="<price_xxx test>"
STRIPE_PRICE_CLINICA="<price_xxx test>"

# === App ===
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

> **Nota auth/email en local:** con `enable_confirmations = false` en `config.toml`, los signups locales no requieren verificación. Si activás confirmations, los magic links / verificación caen en Inbucket (`http://127.0.0.1:54324`), no en Resend.

### 4. Scripts nuevos en `package.json`

Agregar comandos para el ciclo de vida local:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",

    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:status": "supabase status",
    "db:reset": "supabase db reset",
    "db:diff": "supabase db diff",
    "db:push": "supabase db push --linked",
    "db:pull": "supabase db pull --linked",

    "db:seed": "node scripts/db-seed.mjs",
    "db:types:local": "supabase gen types typescript --local > src/types/database.types.ts",
    "db:types": "supabase gen types typescript --linked > src/types/database.types.ts",

    "env:local": "cp .env.local.local .env.local && echo '→ .env.local now points to LOCAL supabase'",
    "env:remote": "cp .env.remote.local .env.local && echo '→ .env.local now points to REMOTE supabase'"
  }
}
```

**Para qué sirve cada uno:**

| Script | Uso |
|---|---|
| `db:start` / `db:stop` / `db:status` | Ciclo del stack local de Docker |
| `db:reset` | Borra DB local, corre **todas** las migraciones + seeds desde cero. Validación end-to-end |
| `db:diff` | Muestra el diff entre tu schema local actual y las migraciones — útil cuando iteraste con SQL crudo |
| `db:push` | Aplica las migraciones locales pendientes al **remoto** (con confirmación) |
| `db:pull` | Trae cambios hechos directo en el remoto al schema local (caso raro pero útil) |
| `db:types` | Regenera `database.types.ts` desde **remoto** (lo que ya tenías) |
| `db:types:local` | Idem pero desde local — más rápido durante iteración |
| `env:local` / `env:remote` | Switch entre modos (ver paso 5) |

### 5. Switch entre modos (local ↔ remoto)

Crear dos archivos plantilla **gitignoreados**:

- `.env.local.local` — copia con keys de Supabase **local**
- `.env.remote.local` — copia con keys de Supabase **remoto** (la del backup paso 1)

Y `.env.local` es siempre el "activo" que Next.js lee.

```bash
npm run env:local   # → desarrollar contra Docker local
npm run env:remote  # → testear contra Supabase remoto sin pushear
```

> Reiniciar el dev server después de cambiar (Next.js no recarga `.env.local` en caliente).

### 6. Stripe en local

Stripe webhook necesita `stripe listen` corriendo en otra terminal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

El comando imprime un `whsec_xxx` único por sesión — pegarlo en `STRIPE_WEBHOOK_SECRET` del `.env.local`. (Mismas `STRIPE_PRICE_*` test que ya tenés sirven en local.)

### 7. Validar el flujo end-to-end

```bash
# 1) Stack local arriba
npm run db:start

# 2) DB recreada desde migraciones + seeds
npm run db:reset

# 3) Frontend apuntando a local
npm run env:local
npm run dev

# 4) Login con un usuario seed
# super@skindesk.app / SkinDesk123!
# cosmetologa@skindesk.app / SkinDesk123!
# asistente@skindesk.app / SkinDesk123!
# clienta@skindesk.app / SkinDesk123!
```

Si todo loguea y la DB local está poblada, el setup funciona.

### 8. Probar el ciclo de cambio de schema

```bash
# 1) Iterar SQL libremente contra DB local
supabase db query "alter table profiles add column test_col text"

# 2) Cuando el cambio queda firme, generar migración
supabase migration new add_test_col
# (editar el archivo y pegar el SQL final)

# 3) Validar que la migración es reproducible desde cero
npm run db:reset

# 4) Si todo OK, push a remoto
npm run db:push

# 5) Regenerar types desde remoto
npm run db:types
```

### 9. Push a producción (Vercel + Supabase remoto)

Por ahora **manual** (1 dev solo):

```bash
git push origin main          # Vercel auto-deploya el front
npm run db:push               # aplica migraciones al Supabase remoto
```

> El orden importa: **primero** `db:push` si la migración es no-retrocompatible (agregar tabla, columna nullable, etc. son seguras antes; drop columna requiere coordinar con el deploy del front). Para migraciones simples y aditivas, el orden no importa mucho.

**Futuro (cuando el equipo crezca o duela olvidar `db:push`):** GitHub Actions que corre `supabase db push --linked` en push a `main`. Requiere guardar `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD` como secrets de GitHub.

---

## Cambios concretos a aplicar

| Archivo | Acción |
|---|---|
| `.env.local` | Backup → `.env.remote.local`, sobrescribir con keys locales |
| `.env.local.local` | **Crear** (gitignored) — plantilla modo local |
| `.env.remote.local` | **Crear** (gitignored) — plantilla modo remoto = backup actual |
| `.env.example` | Actualizar con sección "modo local" + "modo remoto" |
| `package.json` | Agregar 9 scripts (`db:*`, `env:*`) |
| `docs/local-dev-setup.md` | Este archivo (ya creado) |
| `README.md` | Sección nueva "Trabajo local" linkeando a `docs/local-dev-setup.md` |

**Lo que NO hay que tocar:**

- `supabase/config.toml` — ya está bien configurado
- `supabase/seed.sql` y `supabase/seeds/*` — ya cargan con `db reset`
- `supabase/migrations/*` — son la fuente de verdad, no se editan
- `scripts/db-seed.mjs` — sigue sirviendo para re-seedear contra la URL que esté activa

---

## Riesgos y consideraciones

1. **Olvidar `db:push` antes de un deploy** que dependa del schema nuevo → la app en Vercel se rompe contra un Supabase sin la columna. Mitigación: agregar GH Action en el futuro, o checklist mental.
2. **Iterar con SQL crudo y olvidar generar la migración** → cambios locales que no llegan al remoto. Mitigación: `supabase db diff` antes de cada commit.
3. **`db:reset` borra todo lo local** — incluyendo datos de prueba que generaste manualmente. Los seeds vuelven, pero no datos manuales. Si querés persistir datos manuales, agregalos a `seeds/`.
4. **Resend en sandbox (`onboarding@resend.dev`)** solo entrega a tu email de cuenta. Para probar emails a múltiples destinatarios localmente, verificar un dominio de prueba o usar Inbucket para auth-flows internos de Supabase.
