# Mis Servicios — Refactor Plan

Working tracker for the post-review work on `src/components/clientes/servicios/`.
Source: technical review delivered 2026-05-11 (sections A–M).

## Status legend
- `[ ]` not started · `[~]` in progress · `[x]` done

---

## Current focus
**Bundles 1 + 2 + 4 closed end-to-end.** Servicios runs on RHF + zod;
Pagos has its own migration + RLS + auto-plan trigger + recompute
trigger; UI consumes server data.

**Dashboard profesional** (`/profesional`) now reads from real tenant
data for 5 of 9 widgets:
- ✅ Clientes Activos (count from `clientes`)
- ✅ Ingresos del Mes (sum from `payment_transactions`)
- ✅ Revenue chart 6 meses (bucketed transactions)
- ✅ Tratamientos populares (top servicios by completed sesiones count)
- ✅ Clientes nuevos (recently created clientes + relative time)
- 🟡 Citas Hoy / Próximas citas — Demo badge (needs `citas` table)
- 🟡 Productos Bajos — Demo badge (needs `inventory` table)
- 🟡 Tareas pendientes — Demo badge (needs `tasks` table)

Aggregator service: `src/services/dashboard.service.ts`. All getters
RLS-scoped, wrapped in `React.cache`, batched via `Promise.all` in the
page.

**Perf pack landed 2026-05-12** (post pagos+dashboard review):
- Migración `20260512013147_perf_indexes_pagos_dashboard.sql` aplicada:
  `payment_transactions (tenant_id, paid_at desc)` and
  `sesiones (tenant_id, status)`.
- `getActiveClientesCount` → `count: 'estimated'`.
- `paymentRegisterSchema` rechaza `paid_at` futura (margen de 7 días
  para timezone/clock skew).
- `src/lib/supabase/select-helpers.ts` con `unwrapNested<T>()` y
  aplicado en `dashboard.service.ts`.
- Dashboard bucketing pasa a usar
  `America/Argentina/Buenos_Aires` para la frontera de "mes actual"
  (`Intl.DateTimeFormat` en TZ). TODO futuro: scopar la TZ por tenant.

Deliberadamente diferidos (esperar volumen real):
- RPCs (`register_payment`, `dashboard_aggregates`) — fold en 1
  round-trip; útil >2k tx/tenant.
- Aggregation en SQL (GROUP BY) para revenue por mes y top treatments
  — útil >10k tx o >5k sesiones.
- Refactor de RLS a policies con OR — resuelve advisor "multiple
  permissive policies" globalmente.
- `unstable_cache` en dashboard — incompatible con la UX actual de
  "veo mi pago al instante"; revisitar si hace falta cuando aparezca
  fricción.

Next candidates:
1. Agenda / `citas` module — ✅ shipped 2026-05-11 (calendar, sheet form,
   resource view, cliente-detail integration). Bundle 6 hardening
   shipped 2026-05-12 (EXCLUSION constraint, status history, cancellation
   reason, calendar provider abstraction, tenant config, etc — full
   detail in §M.7).
2. Inventario module — unlocks 1 widget.
3. Bundle 5 — servicios atomicity + perf cleanup (RPC for create, list
   projection, pagination, index on `(servicio_id, status)`).
4. Bundle 8 — Equipo / asistentes (invite + permissions UI). See §M.8.

---

## Roadmap

### §M.1 — Confirm priorities
- [x] User approved Bundle 1 (L1–L4) on 2026-05-11.
- [x] Payments scope clarified: **manual ledger only**, no Stripe for clientas.
  Stripe stays exactly as it is (profesional SaaS subscription only).

### §M.2 — Bundle 1: Must-fix-now ← **active**

- [x] **L4 · PhotoUploader blob cleanup (ref-based)** — done 2026-05-11
  - File: `src/components/clientes/servicios/photo-uploader.tsx`
  - Mirrored `previews` state into `previewsRef`; unmount effect revokes
    via the ref so URLs added after mount are caught.
  - Typecheck + lint clean.

- [x] **L2 · `deleteSessionPhotoAction` defense in depth** — done 2026-05-11
  - File: `src/actions/servicios.actions.ts`
  - Tenant-prefix guard added; rejects path not under caller's tenant.
  - Session-membership guard added; rejects path that isn't in
    `before_paths` or `after_paths` of the supplied `sessionId`.
  - Reordered: verify → delete storage → splice column. Storage delete
    no longer runs when the verify fails.
  - Storage error now returns its own message instead of `mapPgError`.
  - Typecheck + lint clean.

- [x] **L1 · Strict per-type Zod for `payload.data`** — done 2026-05-11
  - File: `src/schemas/servicios.schema.ts` (+ types.ts + 2 call sites)
  - All four per-type `data` schemas are now `.strict()`; no more
    `passthrough`. `LevelScore` kept as a literal union (0..5),
    `SkinReaction` / `Fitzpatrick` / `HairThickness` / `LaserView` as
    enums, `LaserDiagnosis` strict with empty-string-or-enum fields.
  - `types.ts` re-exports the inferred types; duplicate TS interfaces
    deleted (single source of truth).
  - `as unknown as ServicioCreateInput[…]` casts removed from
    `add-service-sheet.tsx` and `add-session-dialog.tsx`.
  - The `as unknown as Json` casts in `actions/servicios.actions.ts`
    stay (the Supabase `Json` row type is recursive and doesn't accept
    strict shapes structurally — pure serialization-boundary cast).
  - Full typecheck + lint clean.

- [x] **L3 · `professional` text → `professional_id` FK** — done 2026-05-12
  - Migration `20260512002011_servicios_professional_id.sql` applied to
    the cloud DB; types regenerated.
  - Schema: `professional` field replaced by `professionalId` (uuid
    nullable) + `professionalLabel` (text) in `sesionCreateSchema` and
    `servicioCreateSchema`.
  - Service layer batches `profiles.full_name` lookups via
    `fetchProfileNames`; `resolveProfessionalName` picks FK-resolved name
    first, falls back to `professionalLabel`. Mappers now expose all
    three fields (`professional` for display, `professionalId`,
    `professionalLabel`).
  - Actions write both columns.
  - `ProfesionalSelect` rewritten to emit `{ professionalId,
    professionalLabel }`; manual fallback via a `__manual__` sentinel
    option that swaps in a free-text input. Unknown FKs (removed staff)
    are preserved and surfaced as "(profesional removido)".
  - Wizard `GlobalConfigDraft` and dialog `SessionMetaDraft` carry the
    new pair. Vertical-rail summary resolves the display string via a
    `resolveProfesionalDisplay` helper.
  - Page → tabs → tab chain forwards `currentProfesional:
    ProfesionalValue` instead of a name string.
  - Typecheck + lint + `npm run build` all green.

### §M.3 — Bundle 2: RHF + Zod migration ← **active**

Combines L5 + L6 + L10. Five phases — each phase ships clean (typecheck +
lint + build green) before moving to the next.

- [x] **Phase 1 · Schema scaffolding (no app code)** — done 2026-05-12
  - `sesionBaseShape` extracted as a plain field map; reused by
    `sesionCreateSchema` + the four per-type form schemas.
  - Per-type payload schemas exported individually
    (`facialPayloadSchema` / `corporalPayloadSchema` /
    `laserPayloadSchema` / `otherPayloadSchema`). The discriminated
    union still composes from them.
  - `facialSesionFormSchema` / `corporalSesionFormSchema` /
    `laserSesionFormSchema` / `otherSesionFormSchema` + factory
    `sesionFormSchemaFor(type)` and `SesionFormInput` union added.
  - Wizard counterparts: `facialServicioCreateFormSchema` etc. +
    `servicioCreateFormSchemaFor` factory. Laser variant requires
    diagnosis; non-laser variants enforce `laserDiagnosis: null`.
  - `sesionCreateSchema` and `servicioCreateSchema` unchanged on the
    surface (server-side validation untouched).
  - Typecheck + lint clean.

- [x] **Phase 2 · Migrate `AddSessionDialog` to RHF** — done 2026-05-12
  - One `useForm` instance per dialog mount; schema dispatched via
    `sesionFormSchemaFor(service.serviceType)`.
  - Wrapped in `<Form>` (FormProvider) so Step3* children read/write
    via `useFormContext`.
  - `SessionMetaBlock` (date / professional / nextSuggestion) is a
    child that consumes RHF directly.
  - `notes` / `beforePaths` / `afterPaths` / `durationMin` /
    `recommendations` live at the form root (L6). Step3* render them
    at their existing visual slots via path bindings.

- [x] **Phase 3 · Refactor `Step3Facial/Corporal/Laser/Other`** — done
  - `value` / `onChange` props gone. All four take only
    `cliente`, `sessionId?`, `pathPrefix?` (+ Step3Corporal still
    needs `isPostOp`, Step3Laser still has `showDiagnosis`).
  - Each field uses `<FormField>` + `<FormItem>` + `<FormLabel>` +
    `<FormMessage>` for plain inputs; `Controller` wraps the custom
    inputs (zone pickers, ChipMultiSelect, LevelScale, PhotoUploader).
  - `FacialSessionDraft` / `CorporalSessionDraft` / `LaserSessionDraft`
    / `OtherSessionDraft` and their `INITIAL_*_DRAFT` exports are
    deleted — defaults are now built at the parent.
  - `pathPrefix` lets the same component mount in either the dialog
    form (root paths) or the wizard form (under `firstSession.*`).

- [x] **Phase 4 · Migrate `AddServiceSheet` wizard to RHF** — done
  - Steps 1 + 2 are plain state (single picks — no form needed).
  - Step 3 mounts a `Step3FormShell` child that owns its own
    `useForm` instance with the per-type wizard schema
    (`servicioCreateFormSchemaFor`). Unmount-remount semantics on
    type/catalog change → no stale clinical data leaks.
  - Step3Global, Step3Facial/Corporal/Laser/Other render inside that
    form's `<FormProvider>`.
  - Submit uses native `type="submit"` button inside the wrapping
    `<form>`.
  - `GlobalConfigDraft` + the wizard's hand-rolled `canAdvance` are
    gone.

- [x] **Phase 5 · Delete dedup helpers** — done
  - `stripDraftMeta`, `buildPayload`, `pickDraft`, `readDuration`,
    `readSessionNotes`, `readBeforePaths`, `readAfterPaths`,
    `readRecommendations` all deleted. The RHF form state matches
    the API shape directly — no marshalling left.
  - `deriveTags` was the only pure-payload helper worth keeping;
    it's currently absent from the new flow. If tag derivation
    becomes a product requirement later it goes in a tiny
    `derive-tags.ts` module.

**Quitting criteria — all met:**
  · `npm run build` green.
  · Per-field validation errors render via `<FormMessage>` everywhere.
  · No `as unknown as` casts in the two form files (only the loose
    `useForm({...})` schema-resolver cast at the dispatched boundary).

### §M.4 — Bundle 3: Templates · **DROPPED (out of scope)**
User clarified 2026-05-12 that the "template / library" concept belongs to
the **rutinas** module, not servicios. The hardcoded `catalog.ts` const
stays — it's the canonical list of service types for this module.
- [x] ~~L7 · `service_templates` table~~ — not building.

### §M.5 — Bundle 4: Payments (manual ledger only, no Stripe)

- [x] **Mock UI** — done 2026-05-12 · in `src/components/clientes/pagos/`
  - `types.ts`, `mock-data.ts` (deterministic seed), `pagos-tab.tsx`,
    `payment-summary-row.tsx`, `service-payment-card.tsx`,
    `register-payment-dialog.tsx` (RHF + zod).
  - Wired into `cliente-detail-tabs.tsx` replacing the EmptyTab
    placeholder. Mock state is component-local; toasts + add/delete
    transactions work end-to-end visually.
  - **No cron / no fechas estimadas de cuota** per user instruction.
  - Also fixed a layout bug in the AddServiceSheet wizard step 3:
    `grid-template-rows` defaulted to `auto`, which made the form
    overflow the dialog without scrolling. Switched the grid to
    `[grid-template-rows:minmax(0,1fr)]` and added `min-h-0` to the
    cell flex containers.

- [x] **Backend** — done 2026-05-12
  - Migration `20260512011421_pagos_module.sql` applied to cloud:
    - Enums `payment_method` + `payment_status`.
    - Tables `payment_plans` (UNIQUE servicio_id, 1:1) +
      `payment_transactions` (N:1).
    - Triggers: `updated_at`, sync (tenant + cliente from parent),
      audit+version, **recompute** (AFTER INSERT/UPDATE/DELETE on
      tx, refreshes `paid_amount` + `status` on the plan), and
      **`servicios_create_payment_plan`** (AFTER INSERT on servicios
      auto-creates the 1:1 plan).
    - Backfilled plans for existing servicios.
    - RLS: 4 policies per table (super_admin / profesional /
      asistente_select / clienta_self_select), `(select …)` cached
      helpers per supabase-postgres-best-practices.
  - `src/schemas/pagos.schema.ts` — `paymentRegisterSchema`, enum
    types `PaymentMethod` + `PaymentStatus`.
  - `src/services/pagos.service.ts` — `getPaymentPlansForCliente`
    (Map keyed by servicioId, two batched reads, React.cache).
  - `src/actions/pagos.actions.ts` — `registerPaymentAction`,
    `deletePaymentAction`. ActionState + `mapPgError`.
  - `pagos-tab.tsx` now reads `initialPlans` from the page server
    fetch; mutations go through actions + `router.refresh()`. Mock
    state and `mock-data.ts` deleted.
  - Typecheck + lint + build green.

### §M.6 — Bundle 5: Atomicity + perf (planned)
- [ ] L9 · Replace compensating delete with
  `private.create_servicio_with_first_session` SECURITY DEFINER RPC.
- [ ] L11 · List-view projection for `getServiciosForCliente` (omit
  `payload`).
- [ ] L12 · Pagination/lazy-load inside Histórico for >30 services.
- [ ] L13 · Index `sesiones (servicio_id, status)`.

### §M.7 — Bundle 6: Citas hardening · **active** (post-review 2026-05-11)

All 18 items from the citas review, grouped by execution batch.

**Batch A · DB migration (single file, cohesive)** — done 2026-05-12 · `supabase/migrations/20260512024456_citas_hardening.sql` pushed.
- [x] **C1 · EXCLUSION constraint** `citas_no_overlap_per_professional` on `(professional_id WITH =, tstzrange(start_at,end_at) WITH &&)` `WHERE professional_id IS NOT NULL AND status NOT IN ('cancelada','ausente')`. `btree_gist` extension enabled.
- [x] **C2 · New cancellation/confirmation columns**: `cancellation_reason`, `cancelled_by`, `confirmed_at`, `reminder_sent_at`, `rescheduled_from_id`, generated `duration_min`. Check constraint enforces `cancellation_reason IS NOT NULL` when status is `cancelada`.
- [x] **C3 · Calendar-provider columns**: `external_provider`, `external_event_id`, `external_calendar_id`, `external_sync_status` (check-constrained to `pending|synced|error|disabled`), `external_synced_at`. Unique partial index for webhook upsert.
- [x] **C4 · Status history** `public.cita_status_history` + AFTER UPDATE trigger `private.citas_log_status_change`. RLS mirrors citas (4 SELECT policies).
- [x] **C5 · `clienta_self_update` RLS policy** — asymmetric `using` (`status IN ('pendiente','confirmada')`) / `with check` (`status IN ('confirmada','cancelada')`).
- [x] **C6 · `confirmed_at` AUTO-fill** trigger `private.citas_set_confirmed_at` on INSERT + UPDATE OF status.
- [x] **C7 · Tightened all four definer functions** — `set search_path = public, auth`.
- [x] **C8 · Partial index** `citas_tenant_active_start_idx`.
- [x] **C9 · `tenants` table columns** `timezone`, `business_hours_start`, `business_hours_end` with sensible defaults.

**Batch B · Server actions + services** — done 2026-05-12.
- [x] **C10 · `mapPgError` handles `23P01`** → "Conflicto de horario: ya hay otra cita…".
- [x] **C11 · Pre-flight `detectOverlap`** in `createCitaAction` + `updateCitaAction` (excludes the edited row). DB EXCLUSION is the backstop; the action also catches `23P01` from a racing tab and re-surfaces as `errors: { startAt: ['overlap'] }`.
- [x] **C12 · `AgendaCita` DTO extended** with `cancellationReason`, `confirmedAt`, `reminderSentAt`, `rescheduledFromId`. Mapper + nested-select column lists updated.
- [x] **C13 · `src/lib/tenant-config.ts`** — `React.cache`-wrapped `getTenantConfig()` returning `{ timezone, businessHoursStart, businessHoursEnd }`. Hardcoded sites in `citas.actions.ts` (`CITA_WHEN_FMT`, `SUGGESTION_BUSINESS_*`, `TENANT_TZ`) and `citas.service.ts` (`todayBoundsIso`) all replaced.

**Batch C · Schemas (zod)** — done.
- [x] **C14 · `cancellationReason`** added + `superRefine` enforces required-when-cancelled + blank-when-not.

**Batch D · Form / UI** — done.
- [x] **C15 · `CancellationReasonField`** — separate sub-component watching `status`, only renders when `cancelada`. `aria-invalid` wired.
- [x] **C16 · `ServicioPickerField`** — new `listServiciosForClienteCitaAction` server action + a sub-component that watches `clienteId`, fetches the clienta's services, renders a native select with "Sin asociar a un servicio" sentinel.
- [x] **C17 · Arrow-key nav** on status radiogroup — Left/Up = previous, Right/Down = next, wraps at edges. Only the active radio has `tabIndex={0}`.
- [x] **C18 · Hoisted `CALENDAR_MIN` / `CALENDAR_MAX`** to module scope in `agenda-calendar.tsx`.

**Batch E · Cliente-detail integration** — done.
- [x] **C19 · `<ClienteCitasWidget>`** — two-column "Próximas / Historial reciente" card between the header and tabs. Backed by `getCitasForCliente(id)` (parallel-batched in the page's `Promise.all`). Empty-state link to the agenda.

**Batch F · Calendar provider abstraction** — done.
- [x] **C20 · `src/lib/calendar-providers/`** — `CalendarProvider` interface + `LocalCalendarProvider` no-op. `createCitaAction` routes through `Promise.allSettled([sendEmail, syncToExternalCalendar])`; sync result written back to the new `external_*` columns. Provider swap = single function (`getCalendarProvider`) when Google ships.

**Batch G · Algorithm + UX polish** — done.
- [x] **C21 · Gap-walk `findFreeSlotsLinear`** — sorts events, walks each gap, projects candidates into per-day business windows via `businessHoursWindowFor`. Linear in event count. `Intl`-based offset probe replaces the AR-hardcoded `-03:00`.
- [x] **C22 · TZ + business-hours rules** documented in `AGENTS.md`.

**Deferred (nice-to-have, after Bundle 6 ships)**
- [ ] Typeahead/Combobox for the clienta picker (needs a new shared component; defer until tenant has 500+ clientas).
- [ ] Refactor `useCitaMutations` to a single `mutate(opts)` shape (cosmetic; current 3-handler API is clearer for callers).
- [ ] Drop `security definer` from the audit trigger entirely (C7 already hardens it; full drop requires passing `created_by` from the action — bigger surgery).

### §M.8 — Bundle 8: Equipo / Asistentes — **pending**

Hoy no existe ningún flow para invitar asistentes ni asignarles permisos.
Los permission keys (`agenda`, `pagos`, `clientas`, `catalogo`) están
declarados en `src/types/supabase.ts` y todas las RLS + server actions
ya los chequean, pero el JSONB `profiles.permissions` se setea manualmente
vía SQL.

Cuando un profesional quiera tener una asistente real, esto es lo que
falta:

**A · Invitación de asistente**
- [ ] Server action `inviteAsistenteAction(email, fullName)` análoga a
  `createClientaAction`: crea auth user con `role: 'asistente'` +
  `tenant_id`, fuerza `password_set: false`, manda magic link.
- [ ] Branded email "Te invitaron a unirte a SkinDesk como asistente"
  (template nuevo, mismo formato que `clienta-invite.tsx`).

**B · Listado del equipo**
- [ ] Página `/settings/equipo` (solo profesional + super_admin).
- [ ] DataTable de asistentes del tenant: nombre, email, fecha de alta,
  permisos resumidos como chips ("Agenda: editar", "Catálogo: ver",
  etc), última actividad.
- [ ] Server-side via `listAsistentes` en `src/services/staff.service.ts`
  (ya existe el service, falta extender).

**C · Form de permisos**
- [ ] Sheet/Dialog "Editar permisos" abierto desde el menú kebab de
  cada fila.
- [ ] 4 grupos de radio (Sin acceso / Solo ver / Editar), uno por
  permission key declarado en `ASISTENTE_PERMISSION_KEYS`.
- [ ] Server action `updateAsistentePermissionsAction(profileId, perms)`
  que actualiza `profiles.permissions` + sincroniza
  `auth.users.app_metadata.permissions` (vía admin client) para que el
  JWT refleje el cambio sin re-login.
- [ ] RHF + zod schema con enum literal `["view", "edit"] | null`.

**D · Revocación**
- [ ] Acción "Desactivar asistente" — flip a `permissions = {}` (RLS
  ya cierra todos los accesos) + sign-out forzado vía
  `admin.auth.admin.signOut(userId, 'global')`.
- [ ] Acción "Eliminar asistente" — borra el auth user (cascade limpia
  profile). Warning si tiene rows asociados (citas creadas, pagos
  registrados — solo aviso, no bloqueo, porque RLS no impide la baja).

**E · Refresco de JWT cuando cambian los permisos**
- [ ] El JWT cachea `app_metadata.permissions` por su TTL (default 1h).
  Cuando el profesional cambia un permiso, la asistente sigue con la
  versión vieja hasta que su sesión refresque. Dos opciones:
  - Forzar `signOut(userId, 'global')` desde la action (drástico, la
    deslogea).
  - O permitir que `private.has_asistente_permission` lea de
    `profiles.permissions` (la DB) en vez de `auth.jwt()` (el token).
    **Hoy ya lee de profiles** (chequeado: el helper en
    `private_schema_and_signup_hardening.sql` hace `select permissions
    from public.profiles where id = auth.uid()`), así que el cambio es
    instantáneo a nivel RLS — pero la app layer que mira
    `session.profile.permissions` también lee de `profiles`, no del
    JWT. ✅ No hay que hacer nada para el refresh.

**Notas:**
- El permiso `catalogo` ya está wireado end-to-end (RLS sobre
  `productos`, storage policies, action gate). El bundle solo trae la
  UI para asignarlo.
- Hoy, hasta que esto exista, el profesional tiene acceso total al
  catálogo siempre (no necesita ningún permiso — el rol `profesional`
  en RLS le abre todo). El permiso `catalogo` solo aplica para
  asistentes.

### Deferred (review §L items 14+)
Documented; revisit after a real tenant has >20 active clientas with >10
services each.

---

## Open questions
_None right now._

## Decision log
- 2026-05-11 — Payments are 100% manual; no online cobro to the clienta.
  Stripe stays only for the profesional's SkinDesk subscription.
- 2026-05-11 — Order L1-L4 inside Bundle 1: L4 → L2 → L1 → L3
  (smallest blast radius first).
- 2026-05-12 — Permiso `catalogo` agregado a `ASISTENTE_PERMISSION_KEYS`
  y wireado en RLS + action gate del módulo de productos. La UI para
  asignarlo (§M.8) queda pendiente — vive sin urgencia porque no hay
  flow de invitación de asistentes todavía.
