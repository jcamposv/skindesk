-- Pin search_path on public.set_updated_at to silence the
-- function_search_path_mutable advisor (lint 0011). The function only assigns
-- new.updated_at and never references other objects, so an empty search_path
-- is enough.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
