<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tenant timezone & business hours

**Never hardcode `America/Argentina/Buenos_Aires`, `'09:00'`, `'20:00'`, or any other tenant-local constant in new code.** They live on the `tenants` row (`timezone`, `business_hours_start`, `business_hours_end`) and are surfaced via `getTenantConfig()` from `src/lib/tenant-config.ts`.

- Server code (Server Components, Server Actions, services): `await getTenantConfig()` and pass `timezone` / `businessHoursStart` / `businessHoursEnd` into the formatter or algorithm that needs it.
- Use `Intl.DateTimeFormat({ timeZone })` for display formatting — never `Date.prototype.getHours()` (browser-local).
- Browser-side, the `<input type="date">` / `<input type="time">` fields read/write the browser's local TZ. Conversion to ISO happens at the form-boundary helpers (`splitLocal` / `combineLocal` in `cita-dialog.tsx`).

Reason: a single tenant outside AR — or a profesional travelling — surfaces every hardcoded TZ as a bug. The helper is cached per-request via `React.cache()`, so reading it multiple times in the same Server Component cycle costs one DB round-trip.

# Color palette — single source of truth

The SkinDesk brand colors live as CSS variables in `src/app/globals.css` and are exposed through Tailwind tokens (`primary`, `secondary`, `accent`, `destructive`, `muted`). **Never hardcode hex colors in new code** when an existing token covers the role. The palette:

| Token | Hex | Role |
|-------|-----|------|
| `primary` (Balsam) | `#5C6E6C` | Default buttons, links, sidebar, focus rings — the main UI tone |
| `secondary` (Dusty rose) | `#C58F8A` | Supportive surfaces, soft accents |
| `accent` (Artemis honey) | `#D2A96A` | **Primary CTAs** — `variant="cta"` on Button |
| `destructive` (Warm copper) | `#BB7154` | Destructive actions, error states, error chips |
| `muted` (Aquatone) | `#A6B7AA` | Subdued fills, muted text foreground |

## Primary "create / add" CTAs — always `variant="cta"`

Every primary positive action (the headline "create" / "add" button on a page or sheet) **must** use the shared CTA variant on the `Button` component — not a hardcoded color, not `variant="default"`. This keeps the dashboard visually consistent and gives the user one strong color to scan for.

```tsx
// ✅ Correct
<Button variant="cta" size="lg" className="gap-1.5">
  <PlusIcon className="size-4" />
  Agregar producto
</Button>

// ❌ Wrong — hardcoded copper
<Button className="gap-1.5 bg-[#BB7154] text-white hover:bg-[#A56146]">…</Button>

// ❌ Wrong — default balsam, blends into chrome
<Button size="lg">Agregar producto</Button>
```

The rule applies to: **Agregar X**, **Nueva X**, **Registrar X**, **Crear X**, **Continuar** in wizards, **Subir foto** in uploaders. If the action is the primary positive thing a user can do on a screen, use `variant="cta"`.

**Do not use** `variant="cta"` for:
- Secondary actions (use `variant="outline"` or `variant="ghost"`)
- Destructive actions (use `variant="destructive"`)
- Inline pill buttons inside form sections (those have their own copper-tinted styling — see `AddPillButton` in `producto-form.tsx`)

## Why `accent` (honey) and not `destructive` (copper) for CTAs

Copper is reserved for destructive feedback. Filling a "Crear" button with copper while another nearby element uses copper text for "Eliminar" creates an ambiguity. Honey is the most vivid color in the palette that isn't already overloaded.

If you find a hardcoded `bg-[#BB7154] text-white` on a non-destructive button, replace it with `variant="cta"`.
