-- INOV2627 · base de dados (Supabase, projeto inov2627)
-- Uma tabela de documentos (col, id, data) com as mesmas coleções do artifact do Claude.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from anon, authenticated;
-- Códigos de coordenador (guardados com bcrypt; nunca em texto)
create table private.coord_codes(id serial primary key, hash text not null, label text, created_at timestamptz default now());

create table public.docs(
  col text not null check (col ~ '^[a-z_]{1,40}$'),
  id text not null check (length(id) between 1 and 200),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
alter table public.docs enable row level security;
create index docs_col_idx on public.docs(col);

-- Verdadeiro quando o pedido traz no cabeçalho x-inov-code um código de coordenador válido
create or replace function public.inov_coord() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from private.coord_codes c
    where c.hash = extensions.crypt(coalesce(nullif(current_setting('request.headers', true),'')::json->>'x-inov-code',''), c.hash)
  );
$$;
revoke all on function public.inov_coord() from public;
grant execute on function public.inov_coord() to anon, authenticated;

-- Júri (sem login): lê as coleções da sessão e escreve ideias e feedback. Coordenador: tudo.
create policy docs_read on public.docs for select to anon, authenticated
  using (col = any (array['ideias','sessoes','live','fotos','config','feedback']) or (select public.inov_coord()));
create policy docs_insert on public.docs for insert to anon, authenticated
  with check (col = any (array['ideias','feedback','pedidos']) or (select public.inov_coord()));
create policy docs_update on public.docs for update to anon, authenticated
  using (col = any (array['ideias','feedback']) or (select public.inov_coord()))
  with check (col = any (array['ideias','feedback']) or (select public.inov_coord()));
create policy docs_delete on public.docs for delete to anon, authenticated
  using (col = any (array['ideias','feedback']) or (select public.inov_coord()));
grant select, insert, update, delete on public.docs to anon, authenticated;

-- Para criar/mudar o código de coordenador (no SQL editor do Supabase):
--   insert into private.coord_codes(hash,label) values (extensions.crypt('NOVO-CODIGO', extensions.gen_salt('bf',10)),'nome');
--   delete from private.coord_codes where label='nome';
