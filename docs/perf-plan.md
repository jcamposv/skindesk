# SkinDesk · Plan de optimización de performance

**Objetivo**: eliminar el ~1s de delay percibido al navegar entre pages, sin tocar lógica de negocio. Plan en 7 fases ordenadas por impacto/esfuerzo.

**Última actualización**: 2026-05-15 — Plan completo: Fases 1–5 + 7 aplicadas, Fase 6 saltada por análisis RLS.

## Estado actual

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Loading shells (`loading.tsx` por ruta) | ✅ Completa |
| 2 | Streaming con `<Suspense>` en cliente detail | ✅ Completa |
| 3 | Builder: defer del catálogo de productos | ✅ Completa |
| 4 | Service projections + RPC para library stats | ✅ Completa |
| 5 | `next/dynamic` para libs pesadas (charts, calendar) | ✅ Completa |
| 6 | `unstable_cache` para staff/clientes picker | ⏭️ Saltada (RLS) |
| 7 | Cleanup `force-dynamic` redundante | ✅ Completa |

## Resumen del audit

El delay ~1s tiene 3 causas estructurales:

1. **Ningún `loading.tsx` bajo `(staff)/`** → el router bloquea la transición hasta resolver el RSC.
2. **`export const dynamic = "force-dynamic"` en cada page** → desactiva el caching de RSC.
3. **Cero `<Suspense>` boundaries** → todos los `await` se serializan antes del primer paint.

Hotspots concretos:
- `/clientes/[id]` — 8 awaits en paralelo (incluye `listLibraryRutinas({pageSize:100})` para 1 sola tab)
- `/rutinas/nueva` y `/rutinas/[id]/editar` — 200 productos + bulk `createSignedUrls` (~300–800 ms)
- `/rutinas/[id]/editar` — waterfall rutina → catálogo → cliente
- `/rutinas` (library) — `getLibraryStats` trae todas las rutinas para contar 4 buckets
- `/profesional/agenda` — `react-big-calendar` + `date-fns/locale/es` montados sin `next/dynamic`
- `/productos` — `select("*")` con columnas clínicas que el grid no renderea

---

## Fase 1 — Loading shells ✅

**Resultado**: clic → render `~1s` → clic → skeleton (instante).

### Creado

- `src/components/shared/dashboard-skeleton.tsx` — 11 primitivos componibles:
  `SkeletonHero`, `SkeletonStatStrip`, `SkeletonToolbar`, `SkeletonTable`,
  `SkeletonCardGrid`, `SkeletonDetailHeader`, `SkeletonTabs`,
  `SkeletonCalendar`, `SkeletonBuilder`, `SkeletonContentCard`,
  `SkeletonChart`, `SkeletonForm`.

### `loading.tsx` por ruta (19 / 19)

```
src/app/(staff)/clientes/loading.tsx
src/app/(staff)/clientes/[id]/loading.tsx
src/app/(staff)/profesional/loading.tsx
src/app/(staff)/profesional/agenda/loading.tsx
src/app/(staff)/rutinas/loading.tsx
src/app/(staff)/rutinas/nueva/loading.tsx
src/app/(staff)/rutinas/[id]/editar/loading.tsx
src/app/(staff)/rutinas/share/[token]/loading.tsx
src/app/(staff)/productos/loading.tsx
src/app/(staff)/pagos/loading.tsx
src/app/(staff)/pagos/[id]/loading.tsx
src/app/(staff)/atlas/loading.tsx
src/app/(staff)/atlas/[section]/loading.tsx
src/app/(staff)/atlas/[section]/[slug]/loading.tsx
src/app/(staff)/settings/loading.tsx
src/app/(staff)/super-admin/loading.tsx
src/app/(staff)/super-admin/atlas/loading.tsx
src/app/(staff)/super-admin/atlas/new/loading.tsx
src/app/(staff)/super-admin/atlas/[id]/loading.tsx
```

### Regla persistida

Sección **"Loading shells — every new page needs a sibling `loading.tsx`"** agregada en `AGENTS.md`, cargada en toda sesión vía `CLAUDE.md` (`@AGENTS.md`).

---

## Fase 2 — Streaming en cliente detail ✅

**Resultado**: critical path bajó de 8 awaits a 4. Tabs pesados streamean en paralelo.

### Patrón: slots con `<Suspense>`

```tsx
// page.tsx
const [cliente, evaluacion, staff, citas] = await Promise.all([...]);

<ClienteDetailTabs
  datosSlot={<DatosPersonalesForm ... />}
  evaluacionSlot={<EvaluacionTab ... />}
  rutinasSlot={<Suspense fallback={<TabSkeleton />}><RutinasTabServer ... /></Suspense>}
  serviciosSlot={<Suspense ...><ServiciosTabServer ... /></Suspense>}
  pagosSlot={<Suspense ...><PagosTabServer ... /></Suspense>}
  ...
/>
```

### Creado

- `src/components/clientes/tabs/tab-skeleton.tsx`
- `src/components/clientes/tabs/rutinas-tab-server.tsx`
- `src/components/clientes/tabs/servicios-tab-server.tsx`
- `src/components/clientes/tabs/pagos-tab-server.tsx`
- `listLibraryTemplatesForPickerAction` en `src/actions/rutinas.actions.ts`

### Modificado

- `src/app/(staff)/clientes/[id]/page.tsx` — solo 4 critical fetches en `Promise.all`
- `src/components/clientes/cliente-detail-tabs.tsx` — props pasan a slots `ReactNode`
- `src/components/clientes/rutinas-asignadas-tab.tsx` — `LibraryPickerDialog` carga vía SWR al abrir

### Decisiones clave

- **Always-mounted tabs** (`<div hidden>`) en vez de conditional render. Trade-off: preserva estado de forms al cambiar tabs + Suspense disparan todos en server-render. Aceptado porque los queries restantes son razonablemente livianos.
- **`listLibraryRutinas` removido del critical path**: solo se carga al abrir el dialog de "Asignar desde biblioteca" via SWR (`LIBRARY_PICKER_KEY` stable).
- **`getStaffForTenant` queda en critical path**: alimenta el botón "Nueva cita" del header (visible al primer paint).

---

## Fase 3 — Builder: defer catálogo ✅

**Resultado**: ~300–800 ms fuera del critical path. La sub-tarea de "doble photo signing" queda pendiente como nota para Fase 4.

### Patrón aplicado: `use(promise)` + drag JSON

El page kickea `listProductosForBuilder()` SIN await. Pasa el `Promise` al builder. El builder llama `use(productosPromise)` dentro de un `<Suspense fallback={<CatalogSkeleton/>}>` para que el catálogo streamee independientemente.

### Creado

- `src/components/rutinas/builder/builder-catalog-async.tsx` — wrapper client con `use(promise)`.
- `src/components/rutinas/builder/catalog-skeleton.tsx` — fallback visual.

### Modificado

- `src/components/rutinas/builder/builder-catalog.tsx` — drag emite ahora `application/json` con el producto completo en lugar de solo el ID.
- `src/components/rutinas/builder/rutina-builder.tsx`:
  - Prop `productos` reemplazado por `productosPromise: Promise<BuilderCatalogResult>`.
  - Eliminado el `productosById` Map del parent.
  - Drop handler parsea JSON del dataTransfer (no necesita `productosById`).
  - Catálogo renderea bajo `<Suspense fallback={<CatalogSkeleton/>}>` (en desktop column y mobile sheet).
- `src/app/(staff)/rutinas/nueva/page.tsx`:
  - `productosPromise` pasa sin await.
  - `getClienteById` (cuando `?cliente=<id>`) ahora paralelo a `getClientesForPicker`.
- `src/app/(staff)/rutinas/[id]/editar/page.tsx`:
  - Waterfall `getRutinaWithSteps → Promise.all([catalog, clientes]) → getClienteById` reescrito como `Promise.all([rutina, clientes])` paralelo + cliente lookup secuencial mínimo.
  - `productosPromise` pasa sin await.

### Decisiones clave

- **Drag carry JSON**: el catalog ahora pone `application/json` (full producto) en el dataTransfer, además del `text/plain` con el ID para retro-compatibilidad. Esto desacopla el catálogo del parent (ya no se necesita `productosById`).
- **`use(promise)` sobre Context**: alternativa considerada (Context para `addStep`), pero `use(promise)` mantiene props explícitas y es más idiomático React 19.
- **Catalog suspende en 2 lugares**: desktop column + mobile sheet usan la misma `productosPromise`. React dedupea el read del Promise, así que la query corre una sola vez.
- **Mapping `toBuilderProducto` movido al async wrapper**: la transformación pasa de los pages al wrapper `BuilderCatalogAsync` para no duplicar lógica.

### Pendiente (futuro)

- **Doble photo signing**: `getRutinaWithSteps` firma photos de productos referenciados en la rutina; `listProductosForBuilder` re-firma los mismos para el catálogo. Unificar con un helper compartido cacheado por `React.cache()` — bajaría latencia adicional en editar. No bloquea Fase 3.

---

## Fase 4 — Service projections + RPC ✅

### 4.1 — `listProductos` projection ✅

`src/services/productos.service.ts` — `select("*")` reemplazado por `PRODUCTO_LIST_COLS` (10 columnas: identity + visible facets). Tipo nuevo `ProductoListItem` exportado.

**Edit flow**: el card pasa un `ProductoListItem` al handler; éste llama a `getProductoForEditAction(id)` (nueva server action en `src/actions/productos.actions.ts`) que devuelve el `Producto` completo para el sheet de edición. Una sola roundtrip extra solo cuando el usuario hace clic en "Editar".

**Archivos modificados**:
- `src/services/productos.service.ts` — `PRODUCTO_LIST_COLS`, `ProductoListItem` exportado, `listProductos` retorna `ProductoListItem[]`.
- `src/actions/productos.actions.ts` — `getProductoForEditAction(id)` agregada.
- `src/components/productos/producto-card.tsx` — acepta `ProductoListItem`.
- `src/components/productos/productos-list-table.tsx` — acepta `ProductoListItem`.
- `src/components/productos/productos-page-client.tsx` — `handleEdit` lazy-fetch + `pendingAction` cubre el loading.

### 4.2 — `getServiciosForCliente` projection ✅

`src/services/servicios.service.ts` — los dos `select("*")` reemplazados por proyecciones explícitas: `SERVICIO_LIST_COLS` (18 columnas) y `SESION_LIST_COLS` (14 columnas). Excluye bookkeeping (`tenant_id`, `created_by`, `last_editor_id`, `updated_at`, `version` para sesiones).

**Tipos**: `ServicioProjectedRow` y `SesionProjectedRow` introducidos. Mappers `rowToServicio` y `rowToSession` ajustados a esos tipos.

**Gotcha resuelto**: supabase-js requiere que el string de `select()` sea un literal estático para inferir el tipo de retorno. Strings con concatenación `+` widenan a `string` y el builder cae en `GenericStringError`. Solución: literal de una sola línea.

### 4.3 — RPC para `getLibraryStats` ✅

**Migration**: `supabase/migrations/20260515144152_rutinas_library_stats_rpc.sql`

```sql
create or replace function public.rutinas_library_stats()
returns table (total integer, am integer, pm integer, ambos integer)
language sql stable security invoker set search_path = '' as $$
  select
    count(*)::integer as total,
    count(*) filter (where momento = 'am')::integer as am,
    count(*) filter (where momento = 'pm')::integer as pm,
    count(*) filter (where momento = 'both' or momento is null)::integer as ambos
  from public.rutinas
  where kind = 'template' and archived_at is null
$$;
```

**Gotcha resuelto**: `both` es palabra reservada de Postgres en posición de columna. La función la nombra `ambos` y el service re-mapea a `both` para no tocar callers.

**Service** (`src/services/rutinas.service.ts:371`) ahora hace un `supabase.rpc("rutinas_library_stats").single()` en lugar del row-scan.

**Push + types regen**: ya aplicados.

---

## Fase 5 — `next/dynamic` ✅

**Resultado**: `react-big-calendar` (~150 KB) + `recharts` (~120 KB) salen del bundle inicial de las rutas que los usan.

### Patrón aplicado: thin client wrapper con `ssr: false`

`next/dynamic` con `ssr: false` requiere ser invocado desde un Client Component. Solución: cada componente pesado tiene un `*-lazy.tsx` (también `"use client"`) que hace la dynamic import y re-expone el mismo `Props` typing. La page (server component) importa el lazy wrapper.

`ssr: false` es necesario en ambos casos porque tanto `react-big-calendar` como `recharts` miden el DOM al montar (ResponsiveContainer, etc.) y crashearían en SSR.

### 5.1 — Agenda calendar ✅

**Creado**: `src/components/citas/agenda-calendar-lazy.tsx`
- `import("./agenda-calendar")` con fallback `<SkeletonCalendar />` (de `dashboard-skeleton`).
- `AgendaCalendarProps` exportada desde `agenda-calendar.tsx`.

**Modificado**: `src/app/(staff)/profesional/agenda/page.tsx` importa `AgendaCalendarLazy`.

### 5.2 — Dashboard charts ✅

**Creado**:
- `src/components/dashboard/revenue-chart-lazy.tsx` — fallback `<Skeleton h-[220px]>`.
- `src/components/dashboard/treatments-donut-lazy.tsx` — fallback skeleton circular.

**Modificado**:
- `RevenueChartProps` y `TreatmentsDonutProps` exportadas.
- `src/app/(staff)/profesional/page.tsx` usa `RevenueChartLazy` y `TreatmentsDonutLazy`.

### Verificación de bundle (opcional)

Para confirmar el ahorro real correr `next build` antes/después y comparar el "First Load JS" en las rutas `/profesional` y `/profesional/agenda`.

---

## Fase 6 — `unstable_cache` ⏭️ Saltada

**Decisión**: skipear esta fase. El audit de RLS revela que las dos queries candidatas dependen del **rol y permisos** del usuario, no solo del tenant — y un cache cross-request keyado por `tenant_id` filtraría datos entre roles.

### Análisis RLS

**`profiles` (consumida por `getStaffForTenant`)**:
- `profesional`: policy le da todas las filas del tenant ✓
- `asistente`: la policy `profiles_asistente_read_clientas` solo le da `role = 'clienta'` — para una query `where role in ('profesional','asistente')` recibe **0 filas**.
- Si cachémos por `tenantId` la primera vez que un profesional consulta, un asistente leería desde el cache la lista completa de staff. Bypass de RLS.

**`clientes` (consumida por `getClientesForPicker`)**:
- `profesional`: todas las clientas del tenant ✓
- `asistente` con `clientas:view`: todas ✓
- `asistente` sin permiso: **0 filas**
- Mismo problema: el cache leakea entre permisos distintos dentro del tenant.

### Mitigaciones consideradas

1. **Gate-then-cache + admin client + filtro manual por tenant_id**. Funciona, pero:
   - Es complejo (auditoría de seguridad por cada cambio del archivo).
   - Si un dev futuro toca la función y olvida el filtro, queda fuga multi-tenant.
   - El gain real es ~50 ms × N pages — marginal (LOW priority en el audit).
2. **Cache keyado por `(tenant_id, role, permissions)`**: granular pero el cache hit ratio cae al piso.

### Veredicto

Mantener `React.cache()` (in-request dedup, ya en el código) y NO agregar `unstable_cache` cross-request acá. La ganancia perceptual real para el usuario final es invisible; el riesgo arquitectónico es real.

### Si en el futuro hace falta

El patrón seguro sería:
```ts
// Permission gate OUTSIDE the cache
export async function getStaffForTenant(tenantId: string) {
  const session = await getCurrentSession();
  if (!session) return [];
  if (session.profile.role !== "profesional" && session.profile.role !== "super_admin") {
    return []; // asistente nunca llega al cache
  }
  return unstable_cache(
    () => fetchStaffWithAdminClient(tenantId),  // admin + manual .eq("tenant_id", tenantId)
    ["staff-for-tenant", tenantId],
    { revalidate: 300, tags: [`staff:${tenantId}`] }
  )();
}
```

Wire `revalidateTag` en futuras acciones de staff CRUD (no existen aún).

---

## Fase 7 — Cleanup `force-dynamic` ✅

**Resultado**: 15 declaraciones redundantes eliminadas de pages staff. Los 3 route handlers (`*/pdf/route.tsx`, `pagos/export.csv/route.ts`, API webhooks) mantienen el opt-in explícito por claridad.

### Justificación

Todos los staff pages llaman a `getCurrentSession()` que internamente hace `await cookies()` (ver `src/lib/supabase/server.ts:13`). Por contrato de Next 16, leer `cookies()` en un Server Component opta-out de static rendering automáticamente. El `export const dynamic = "force-dynamic"` era pura redundancia.

### Archivos limpiados (15)

```
src/app/(staff)/profesional/page.tsx
src/app/(staff)/profesional/agenda/page.tsx
src/app/(staff)/clientes/page.tsx
src/app/(staff)/clientes/[id]/page.tsx
src/app/(staff)/rutinas/page.tsx
src/app/(staff)/rutinas/nueva/page.tsx
src/app/(staff)/rutinas/[id]/editar/page.tsx
src/app/(staff)/rutinas/share/[token]/page.tsx
src/app/(staff)/productos/page.tsx
src/app/(staff)/pagos/page.tsx
src/app/(staff)/pagos/[id]/page.tsx
src/app/(staff)/atlas/[section]/[slug]/page.tsx
src/app/(staff)/super-admin/atlas/page.tsx
src/app/(staff)/super-admin/atlas/new/page.tsx
src/app/(staff)/super-admin/atlas/[id]/page.tsx
```

### Mantenidos (3, son route handlers)

```
src/app/(staff)/rutinas/[id]/pdf/route.tsx
src/app/(staff)/rutinas/share/[token]/pdf/route.tsx
src/app/(staff)/pagos/export.csv/route.ts
src/app/api/atlas/files/[fileId]/html/route.ts
src/app/api/webhooks/stripe/route.ts
```

Route handlers tienen reglas distintas de inferencia dinámica — la directiva explícita es legítima.

### Impacto

Marginal en runtime. El framework ahora puede aplicar partial pre-rendering (PPR) o cache-de-segmento donde tenga sentido sin tener que respetar el opt-in manual.

---

## Cómo continuar / resumir sesión

### Para retomar Fase 3

1. Leer `docs/perf-plan.md` (este archivo).
2. Leer `AGENTS.md` (la regla de `loading.tsx` está ahí).
3. Inspeccionar el builder actual:
   ```
   src/components/rutinas/builder/rutina-builder.tsx
   src/components/rutinas/builder/builder-catalog.tsx
   src/app/(staff)/rutinas/nueva/page.tsx
   src/app/(staff)/rutinas/[id]/editar/page.tsx
   ```
4. Crear server component wrapper + Suspense fallback.
5. Paralelizar el waterfall en `editar/page.tsx`.
6. Verificar: `npx tsc --noEmit && npx eslint src`.

### Verificación end-to-end por fase

```bash
npx tsc --noEmit                      # typecheck
npx eslint src                         # lint
npm run dev                            # smoke test en browser
# Para Phase 4 que toca DB:
supabase migration list --local
supabase db push
npm run db:types
```

### Test de regresión visual sugerido

1. `/clientes` → click en una clienta → debe mostrar shell skeleton, luego header + datos tab.
2. Click "Servicios" tab → si es la primera vez, breve loader; después instantáneo.
3. Click "Rutinas" tab → click "Asignar desde biblioteca" → ver spinner, luego lista de templates.
4. Click "Pagos" tab → mismo patrón.

---

## Decisiones arquitectónicas registradas

| Decisión | Razón |
|----------|-------|
| `loading.tsx` por ruta, no parallel route | Más simple, mismo win de perceived perf. Las parallel routes (`@modal`, etc.) sirven para layouts más complejos. |
| Slot pattern en cliente detail (no parallel routes) | El componente de tabs es client (estado local + URL sync); los parallel routes funcionan mejor con server components puros. |
| `<div hidden>` en lugar de conditional render por tab | Preserva estado de forms al cambiar tabs + Suspense fires todos en server-render. |
| SWR para library picker (no server action en `useEffect`) | SWR cachea per-session; el dialog reopen es instantáneo. |
| `listLibraryRutinas({pageSize: 200})` cap en el picker action | Un picker no debería paginar. Si pasamos 200, agregar search + pagination en el dialog mismo. |
| Mantener `getStaffForTenant` en critical path | Lo usa el botón "Nueva cita" del header, visible al primer paint. |
| ISR (`revalidate=60`) sobre `force-dynamic` cuando posible | Solo Atlas lo usa actualmente — modelo a seguir donde la data es tenant-stable. |

---

## Anti-patrones a evitar (referencia rápida)

Estos vienen de los skills cargados (`react-best-practices`, `supabase-postgres-best-practices`):

- ❌ `select("*")` en queries que alimentan listados con 5–6 columnas visibles.
- ❌ `count: 'exact'` en tablas grandes — usar `count: 'estimated'` cuando el número exacto no es crítico.
- ❌ Datos no-críticos en `Promise.all` del page — defer con `<Suspense>`.
- ❌ Charts/calendar pesados sin `next/dynamic` — sumar al critical bundle innecesariamente.
- ❌ `export const dynamic = "force-dynamic"` redundante cuando `searchParams` ya fuerza dynamic.
- ❌ Page que fetchea data de tabs/dialogs que el usuario quizá nunca abre.
- ❌ Photo signing en bulk antes del primer paint — diferir o paralelizar.
