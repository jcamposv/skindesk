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
