-- =============================================================================
-- SkinDesk · Performance indexes for pagos + dashboard aggregator queries
-- =============================================================================
-- Two composite indexes the dashboard's revenue + top-treatments queries
-- can use. RLS rewrites the dashboard reads to include
-- `tenant_id = current_tenant_id()`, so leading the index with `tenant_id`
-- lets PG combine the RLS filter with the secondary key in one index scan.
--
-- · `payment_tx_tenant_paid_at_idx` — supports `getMonthlyRevenue` and
--   `getRevenueByMonth` (tenant-scoped range scan over `paid_at`).
-- · `sesiones_tenant_status_idx` — supports `getTopTreatments`
--   (tenant + `status = 'completed'` filter).
-- =============================================================================

create index if not exists payment_tx_tenant_paid_at_idx
  on public.payment_transactions (tenant_id, paid_at desc);

create index if not exists sesiones_tenant_status_idx
  on public.sesiones (tenant_id, status);
