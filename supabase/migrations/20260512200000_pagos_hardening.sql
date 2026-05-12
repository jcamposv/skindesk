-- =============================================================================
-- SkinDesk · Pagos hardening (1/2) — enum extensions
-- =============================================================================
-- ALTER TYPE ... ADD VALUE cannot be referenced in the same transaction that
-- adds the value. We split enum extensions into their own migration so the
-- next file (`_pagos_hardening_logic.sql`) can use the new values in
-- trigger bodies, view filters and check constraints.
--
-- New values:
--   payment_method: 'codi' — Mexico's instant transfer (matches the product
--                            requirements that mention CoDi alongside cash,
--                            transferencia and tarjeta).
--   payment_status: 'cancelled' — set by the recompute trigger when every
--                                 transaction on a plan has been voided.
-- =============================================================================

alter type public.payment_method add value if not exists 'codi'      after 'tarjeta';
alter type public.payment_status add value if not exists 'cancelled' after 'paid';
