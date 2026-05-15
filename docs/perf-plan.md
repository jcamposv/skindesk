# SkinDesk · Plan de optimización de performance

**Objetivo**: eliminar el ~1s de delay percibido al navegar entre pages, sin tocar lógica de negocio. Plan en 7 fases ordenadas por impacto/esfuerzo.

**Última actualización**: 2026-05-15 (Fase 4 completa)

## Estado actual

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Loading shells (`loading.tsx` por ruta) | ✅ Completa |
| 2 | Streaming con `<Suspense>` en cliente detail | ✅ Completa |
| 3 | Builder: defer del catálogo de productos | ✅ Completa |
| 4 | Service projections + RPC para library stats | ✅ Completa |
| 5 | `next/dynamic` para libs pesadas (charts, calendar) | ⏳ Pendiente |
| 6 | `unstable_cache` para staff/clientes picker | ⏳ Pendiente |
| 7 | Cleanup `force-dynamic` redundante | ⏳ Pendiente |

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

## Fase 5 — `next/dynamic` ⏳

**Impacto esperado**: bundle inicial baja ~200KB combinado. TTI más rápido.

### 5.1 — Agenda calendar

`src/components/citas/agenda-calendar.tsx`:
```tsx
import dynamic from "next/dynamic";

const Calendar = dynamic(
  () => import("react-big-calendar").then((m) => m.Calendar),
  { ssr: false, loading: () => <CalendarSkeleton /> }
);
```

### 5.2 — Dashboard charts

- `src/components/dashboard/revenue-chart.tsx` (recharts)
- `src/components/dashboard/treatments-donut.tsx` (recharts)

Mismo patrón. Skip si están above-the-fold y la métrica empeora.

**Verificación**: `next build` antes/después; comparar el "First Load JS" por ruta.

---

## Fase 6 — `unstable_cache` ⏳

**Impacto esperado**: ~50 ms × N páginas que comparten staff/clientes-picker.

### 6.1 — `getStaffForTenant`

`src/services/staff.service.ts`:
```ts
import { unstable_cache } from "next/cache";

export const getStaffForTenant = unstable_cache(
  async (tenantId: string) => { ... },
  ["staff-for-tenant"],
  { tags: (tenantId) => [`staff:${tenantId}`], revalidate: 300 }
);
```

Revalidar en server actions de CRUD de staff (`revalidateTag`).

### 6.2 — `getClientesForPicker`

Mismo patrón, tag `clientes-picker:${tenantId}`.

### ⚠️ Cuidado

Verificar que el RLS de estas tablas NO dependa de `auth.uid()` (solo de `tenant_id`). Si depende del usuario, **no se puede cachear cross-request**.

---

## Fase 7 — Cleanup `force-dynamic` ⏳

Audit grep:
```bash
grep -rn "export const dynamic" src/app/\(staff\)/
```

Quitar el opt-in donde `searchParams: Promise<...>` o `cookies()` ya lo fuerzan. Dejarlo donde el page no consume nada dinámico explícitamente pero depende del tenant.

**Impacto**: marginal, principalmente limpieza.

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
