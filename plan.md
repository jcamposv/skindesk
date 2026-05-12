# Mis Servicios — Refactor Plan

Working tracker for the post-review work on `src/components/clientes/servicios/`.
Source: technical review delivered 2026-05-11 (sections A–M).

## Status legend
- `[ ]` not started · `[~]` in progress · `[x]` done

---

## Current focus
**Bundles 1 + 2 closed.** Forms now drive on React Hook Form +
zodResolver; the schema is dispatched per service type, per-field errors
surface via `<FormMessage>`. UI/UX unchanged.

**Bundle 3 (Templates) dropped** — templates belong to the rutinas
module, not servicios. Catalog stays hardcoded in `catalog.ts`.

Next up: **Bundle 4 — Payments (manual ledger)** (review §M.5). Manual
payment registration only; no Stripe on the clienta side.

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

### §M.5 — Bundle 4: Payments (planned · manual ledger only, no Stripe)
- [ ] L8 · `payment_plans` (1:1 with `servicios`) +
  `payment_transactions` (N:1) tables + RLS.
- [ ] Manual-payment registration UI inside the service card.
  Fields: amount, method (efectivo / transferencia / tarjeta offline / otro),
  date, concept, notes.

### §M.6 — Bundle 5: Atomicity + perf (planned)
- [ ] L9 · Replace compensating delete with
  `private.create_servicio_with_first_session` SECURITY DEFINER RPC.
- [ ] L11 · List-view projection for `getServiciosForCliente` (omit
  `payload`).
- [ ] L12 · Pagination/lazy-load inside Histórico for >30 services.
- [ ] L13 · Index `sesiones (servicio_id, status)`.

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
