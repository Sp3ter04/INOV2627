-- PROPOSTA (não aplicada). Torna o updated_at fiável (hora do servidor) e acelera a sincronização incremental.
-- 1) Índice para "dá-me só o que mudou": docs?col=eq.X&updated_at=gt.T
create index if not exists docs_col_updated_idx on public.docs (col, updated_at);

-- 2) O servidor passa a escrever sempre o updated_at (já não depende do relógio do telemóvel de cada pessoa)
create or replace function public.docs_touch() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists docs_touch_trg on public.docs;
create trigger docs_touch_trg before insert or update on public.docs
for each row execute function public.docs_touch();
