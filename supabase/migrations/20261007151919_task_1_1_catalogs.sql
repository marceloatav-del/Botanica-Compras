-- Task 1.1 — schema and minimum reference model for CA-1-01..03.
-- Decisions: UUID domain IDs (including usuarios, whose email maps to Supabase Auth JWT),
-- case-insensitive product/email uniqueness, soft-delete only, quote relations with RESTRICT FKs.
-- The app never uses a service_role key. Later tasks extend these domain tables by migrations.

create type public.perfil_usuario as enum ('admin', 'loja', 'fornecedor');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) > 0),
  email text not null check (position('@' in btrim(email)) > 1),
  perfil public.perfil_usuario not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index usuarios_email_lower_unique on public.usuarios (lower(btrim(email)));

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) > 0),
  unidade_medida text not null check (length(btrim(unidade_medida)) > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index produtos_nome_lower_unique on public.produtos (lower(btrim(nome)));

create table public.lojas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) > 0),
  cnpj text,
  endereco text,
  pedido_minimo numeric(12,2) check (pedido_minimo is null or pedido_minimo >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) > 0),
  email text not null check (position('@' in btrim(email)) > 1),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Minimum real domain relationships needed to exercise CA-1-03 now. These are not mocks;
-- future forms/jobs add daily workflow data in their own authorized tasks.
create table public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references public.fornecedores(id) on update no action on delete restrict,
  criado_por_id uuid references public.usuarios(id) on update no action on delete restrict,
  created_at timestamptz not null default now()
);

create table public.cotacao_itens (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cotacoes(id) on update no action on delete restrict,
  produto_id uuid not null references public.produtos(id) on update no action on delete restrict,
  loja_id uuid not null references public.lojas(id) on update no action on delete restrict,
  created_at timestamptz not null default now(),
  constraint cotacao_itens_cotacao_produto_loja_unique unique (cotacao_id, produto_id, loja_id)
);

create index cotacoes_fornecedor_id_idx on public.cotacoes (fornecedor_id);
create index cotacoes_criado_por_id_idx on public.cotacoes (criado_por_id) where criado_por_id is not null;
create index cotacao_itens_cotacao_id_idx on public.cotacao_itens (cotacao_id);
create index cotacao_itens_produto_id_idx on public.cotacao_itens (produto_id);
create index cotacao_itens_loja_id_idx on public.cotacao_itens (loja_id);

create trigger usuarios_set_updated_at before update on public.usuarios
for each row execute function public.set_updated_at();
create trigger produtos_set_updated_at before update on public.produtos
for each row execute function public.set_updated_at();
create trigger lojas_set_updated_at before update on public.lojas
for each row execute function public.set_updated_at();
create trigger fornecedores_set_updated_at before update on public.fornecedores
for each row execute function public.set_updated_at();

-- SECURITY DEFINER avoids RLS self-recursion while looking up the current user's profile.
create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(btrim(coalesce((select auth.jwt() ->> 'email'), '')));
$$;

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios u
    where lower(btrim(u.email)) = (select public.current_user_email()) and u.ativo
  );
$$;

create or replace function public.current_user_is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios u
    where lower(btrim(u.email)) = (select public.current_user_email())
      and u.ativo and u.perfil = 'admin'
  );
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.current_user_email() from public, anon;
revoke all on function public.current_user_is_active() from public, anon;
revoke all on function public.current_user_is_active_admin() from public, anon;
grant execute on function public.current_user_email() to authenticated;
grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.current_user_is_active_admin() to authenticated;

alter table public.usuarios enable row level security;
alter table public.produtos enable row level security;
alter table public.lojas enable row level security;
alter table public.fornecedores enable row level security;
alter table public.cotacoes enable row level security;
alter table public.cotacao_itens enable row level security;

-- Profiles: active admins manage profiles; a signed-in user can read only their own profile.
create policy "users_read_self_or_admin" on public.usuarios
for select to authenticated
using (lower(btrim(email)) = (select public.current_user_email())
  or (select public.current_user_is_active_admin()));
create policy "admins_insert_users" on public.usuarios
for insert to authenticated
with check ((select public.current_user_is_active_admin()));
create policy "admins_update_users" on public.usuarios
for update to authenticated
using ((select public.current_user_is_active_admin()))
with check ((select public.current_user_is_active_admin()));

-- Catalog administration is limited to active admins; operational forms add scoped policies later.
create policy "admins_read_products" on public.produtos
for select to authenticated
using ((select public.current_user_is_active_admin()));
create policy "admins_insert_products" on public.produtos
for insert to authenticated
with check ((select public.current_user_is_active_admin()));
create policy "admins_update_products" on public.produtos
for update to authenticated
using ((select public.current_user_is_active_admin()))
with check ((select public.current_user_is_active_admin()));

create policy "admins_read_stores" on public.lojas
for select to authenticated
using ((select public.current_user_is_active_admin()));
create policy "admins_insert_stores" on public.lojas
for insert to authenticated
with check ((select public.current_user_is_active_admin()));
create policy "admins_update_stores" on public.lojas
for update to authenticated
using ((select public.current_user_is_active_admin()))
with check ((select public.current_user_is_active_admin()));

create policy "admins_read_suppliers" on public.fornecedores
for select to authenticated
using ((select public.current_user_is_active_admin()));
create policy "admins_insert_suppliers" on public.fornecedores
for insert to authenticated
with check ((select public.current_user_is_active_admin()));
create policy "admins_update_suppliers" on public.fornecedores
for update to authenticated
using ((select public.current_user_is_active_admin()))
with check ((select public.current_user_is_active_admin()));

-- Quote records are admin-only at this stage; supplier-scoped access belongs to the assigned quote task.
create policy "admins_manage_quotes" on public.cotacoes
for all to authenticated
using ((select public.current_user_is_active_admin()))
with check ((select public.current_user_is_active_admin()));
create policy "admins_manage_quote_items" on public.cotacao_itens
for all to authenticated
using ((select public.current_user_is_active_admin()))
with check ((select public.current_user_is_active_admin()));

revoke all on public.usuarios, public.produtos, public.lojas, public.fornecedores,
  public.cotacoes, public.cotacao_itens from public, anon, authenticated;
grant select, insert, update on public.usuarios, public.produtos, public.lojas, public.fornecedores,
  public.cotacoes, public.cotacao_itens to authenticated;
