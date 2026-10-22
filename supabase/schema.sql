-- =====================================================================
-- Agenda & Finanças Casal — Schema + RLS
-- Execute TODO este arquivo no SQL Editor do Supabase (uma única vez).
-- Pode ser reexecutado em banco vazio; não é idempotente sobre dados existentes.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. HOUSEHOLDS (o "grupo" do casal)
-- ---------------------------------------------------------------------
create table public.households (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 1 and 80),
  invite_code        text unique,
  invite_expires_at  timestamptz,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. PROFILES (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default 'Eu' check (char_length(display_name) between 1 and 40),
  color         text not null default 'rose' check (color in ('rose','sky','emerald','amber','violet')),
  household_id  uuid references public.households(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public.profiles (household_id);

-- Cria o profile automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Eu'));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. Função auxiliar usada por TODAS as políticas RLS
--    SECURITY DEFINER evita recursão de RLS na tabela profiles.
-- ---------------------------------------------------------------------
create or replace function public.my_household_id()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.profiles where id = auth.uid()
$$;
revoke all on function public.my_household_id() from public, anon;
grant execute on function public.my_household_id() to authenticated;

-- Verifica se um profile pertence ao meu household (para pagador/responsável)
create or replace function public.is_household_member(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = p_user and household_id is not null
      and household_id = public.my_household_id()
  )
$$;
revoke all on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. EVENTS (Agenda)
-- ---------------------------------------------------------------------
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null default public.my_household_id()
                references public.households(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 120),
  description   text check (char_length(description) <= 2000),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  all_day       boolean not null default false,
  category      text not null default 'outros'
                check (category in ('trabalho','familia','saude','lazer','casa','outros')),
  assignee_id   uuid references public.profiles(id) on delete set null, -- null = "Ambos"
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at >= starts_at)
);
create index on public.events (household_id, starts_at);

-- ---------------------------------------------------------------------
-- 5. NOTES + CHECKLIST ITEMS
-- ---------------------------------------------------------------------
create table public.notes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null default public.my_household_id()
                references public.households(id) on delete cascade,
  kind          text not null default 'note' check (kind in ('note','checklist')),
  title         text not null default '' check (char_length(title) <= 120),
  content       text not null default '' check (char_length(content) <= 10000),
  tags          text[] not null default '{}',
  pinned        boolean not null default false,
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, household_id)
);
create index on public.notes (household_id, updated_at desc);

create table public.checklist_items (
  id            uuid primary key default gen_random_uuid(),
  note_id       uuid not null,
  household_id  uuid not null default public.my_household_id(),
  text          text not null check (char_length(text) between 1 and 300),
  done          boolean not null default false,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  -- FK composta: o item só pode apontar para nota do MESMO household
  foreign key (note_id, household_id) references public.notes(id, household_id) on delete cascade
);
create index on public.checklist_items (note_id, position);

-- ---------------------------------------------------------------------
-- 6. TRANSACTIONS (Finanças)
-- ---------------------------------------------------------------------
create table public.transactions (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null default public.my_household_id()
                      references public.households(id) on delete cascade,
  type                text not null check (type in ('income','expense')),
  description         text not null check (char_length(description) between 1 and 120),
  amount              numeric(12,2) not null check (amount > 0),
  category            text not null default 'outros'
                      check (category in ('alimentacao','moradia','transporte','saude','lazer',
                                          'educacao','contas','compras','salario','outros')),
  date                date not null,
  payer_id            uuid references public.profiles(id) on delete set null,
  status              text not null default 'paid' check (status in ('paid','pending')),
  series_id           uuid,               -- agrupa parcelas/recorrências
  series_kind         text check (series_kind in ('installment','recurring')),
  installment_number  integer,
  installment_total   integer,
  created_by          uuid default auth.uid() references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on public.transactions (household_id, date);
create index on public.transactions (series_id);

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_events_touch       before update on public.events       for each row execute function public.touch_updated_at();
create trigger trg_notes_touch        before update on public.notes        for each row execute function public.touch_updated_at();
create trigger trg_transactions_touch before update on public.transactions for each row execute function public.touch_updated_at();

-- Impede trocar household_id / created_by de um registro existente
create or replace function public.lock_ownership_columns()
returns trigger language plpgsql as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'household_id não pode ser alterado';
  end if;
  -- (permite virar NULL quando a conta do autor é excluída)
  if new.created_by is distinct from old.created_by and new.created_by is not null then
    raise exception 'created_by não pode ser alterado';
  end if;
  return new;
end $$;
create trigger trg_events_lock       before update on public.events       for each row execute function public.lock_ownership_columns();
create trigger trg_notes_lock        before update on public.notes        for each row execute function public.lock_ownership_columns();
create trigger trg_transactions_lock before update on public.transactions for each row execute function public.lock_ownership_columns();

-- =====================================================================
-- 7. ROW LEVEL SECURITY
-- =====================================================================
alter table public.households      enable row level security;
alter table public.profiles        enable row level security;
alter table public.events          enable row level security;
alter table public.notes           enable row level security;
alter table public.checklist_items enable row level security;
alter table public.transactions    enable row level security;

-- Usuários anônimos não acessam nada
revoke all on all tables in schema public from anon;

-- HOUSEHOLDS: só leitura do próprio. Criação/entrada SOMENTE via RPC.
revoke insert, update, delete on public.households from authenticated;
create policy "households: ler o próprio"
  on public.households for select to authenticated
  using (id = public.my_household_id());

-- PROFILES: ler a si mesmo e ao parceiro; editar só nome/cor de si mesmo.
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, color) on public.profiles to authenticated;

create policy "profiles: ler a si e ao parceiro"
  on public.profiles for select to authenticated
  using (id = auth.uid() or (household_id is not null and household_id = public.my_household_id()));

create policy "profiles: editar a si mesmo"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- EVENTS
create policy "events: select" on public.events for select to authenticated
  using (household_id = public.my_household_id());
create policy "events: insert" on public.events for insert to authenticated
  with check (household_id = public.my_household_id()
              and created_by = auth.uid()
              and (assignee_id is null or public.is_household_member(assignee_id)));
create policy "events: update" on public.events for update to authenticated
  using (household_id = public.my_household_id())
  with check (household_id = public.my_household_id()
              and (assignee_id is null or public.is_household_member(assignee_id)));
create policy "events: delete" on public.events for delete to authenticated
  using (household_id = public.my_household_id());

-- NOTES
create policy "notes: select" on public.notes for select to authenticated
  using (household_id = public.my_household_id());
create policy "notes: insert" on public.notes for insert to authenticated
  with check (household_id = public.my_household_id() and created_by = auth.uid());
create policy "notes: update" on public.notes for update to authenticated
  using (household_id = public.my_household_id())
  with check (household_id = public.my_household_id());
create policy "notes: delete" on public.notes for delete to authenticated
  using (household_id = public.my_household_id());

-- CHECKLIST ITEMS
create policy "items: select" on public.checklist_items for select to authenticated
  using (household_id = public.my_household_id());
create policy "items: insert" on public.checklist_items for insert to authenticated
  with check (household_id = public.my_household_id());
create policy "items: update" on public.checklist_items for update to authenticated
  using (household_id = public.my_household_id())
  with check (household_id = public.my_household_id());
create policy "items: delete" on public.checklist_items for delete to authenticated
  using (household_id = public.my_household_id());

-- TRANSACTIONS
create policy "tx: select" on public.transactions for select to authenticated
  using (household_id = public.my_household_id());
create policy "tx: insert" on public.transactions for insert to authenticated
  with check (household_id = public.my_household_id()
              and created_by = auth.uid()
              and (payer_id is null or public.is_household_member(payer_id)));
create policy "tx: update" on public.transactions for update to authenticated
  using (household_id = public.my_household_id())
  with check (household_id = public.my_household_id()
              and (payer_id is null or public.is_household_member(payer_id)));
create policy "tx: delete" on public.transactions for delete to authenticated
  using (household_id = public.my_household_id());

-- =====================================================================
-- 8. RPCs DO CASAL (únicas portas para criar/entrar em um household)
-- =====================================================================

-- Gera código legível sem caracteres ambíguos (sem 0/O/1/I)
create or replace function public._gen_invite_code()
returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  bytes bytea := gen_random_bytes(8);
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end $$;
revoke all on function public._gen_invite_code() from public, anon, authenticated;

-- Cria o household e já associa o criador
create or replace function public.create_household(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if (select household_id from profiles where id = auth.uid()) is not null then
    raise exception 'você já faz parte de um casal';
  end if;

  insert into households (name, invite_code, invite_expires_at, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Nosso lar'),
          _gen_invite_code(), now() + interval '7 days', auth.uid())
  returning id into v_id;

  update profiles set household_id = v_id where id = auth.uid();
  return v_id;
end $$;

-- Entra no household usando o código (máx. 2 membros, código expira)
create or replace function public.join_household(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_count int;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if (select household_id from profiles where id = auth.uid()) is not null then
    raise exception 'você já faz parte de um casal';
  end if;

  select id into v_id from households
  where invite_code = upper(trim(p_code))
    and invite_expires_at > now()
  for update;

  if v_id is null then
    -- mensagem genérica: não revela se o código existe ou só expirou
    raise exception 'código inválido ou expirado';
  end if;

  select count(*) into v_count from profiles where household_id = v_id;
  if v_count >= 2 then raise exception 'este casal já está completo'; end if;

  update profiles set household_id = v_id where id = auth.uid();
  -- código de uso único: invalida após o parceiro entrar
  update households set invite_code = null, invite_expires_at = null where id = v_id;
  return v_id;
end $$;

-- Gera um novo código (ex.: o anterior expirou)
create or replace function public.regenerate_invite_code()
returns text language plpgsql security definer set search_path = public as $$
declare v_hid uuid := my_household_id(); v_code text;
begin
  if v_hid is null then raise exception 'sem casal'; end if;
  if (select count(*) from profiles where household_id = v_hid) >= 2 then
    raise exception 'o casal já está completo';
  end if;
  v_code := _gen_invite_code();
  update households set invite_code = v_code, invite_expires_at = now() + interval '7 days'
  where id = v_hid;
  return v_code;
end $$;

-- Sair do casal (os dados continuam com quem ficou)
create or replace function public.leave_household()
returns void language plpgsql security definer set search_path = public as $$
declare v_hid uuid := my_household_id();
begin
  if v_hid is null then return; end if;
  update profiles set household_id = null where id = auth.uid();
  -- se ninguém restou, apaga o household e todos os dados (cascade)
  if not exists (select 1 from profiles where household_id = v_hid) then
    delete from households where id = v_hid;
  end if;
end $$;

revoke all on function public.create_household(text)    from public, anon;
revoke all on function public.join_household(text)      from public, anon;
revoke all on function public.regenerate_invite_code()  from public, anon;
revoke all on function public.leave_household()         from public, anon;
grant execute on function public.create_household(text)   to authenticated;
grant execute on function public.join_household(text)     to authenticated;
grant execute on function public.regenerate_invite_code() to authenticated;
grant execute on function public.leave_household()        to authenticated;

-- =====================================================================
-- 9. LANÇAMENTOS PARCELADOS / RECORRENTES
--    SECURITY INVOKER: os inserts passam pelas políticas RLS normais.
-- =====================================================================
create or replace function public.create_transaction_series(
  p_type        text,
  p_description text,
  p_amount      numeric,       -- parcelado: valor TOTAL; recorrente: valor de CADA mês
  p_category    text,
  p_date        date,          -- data da 1ª ocorrência
  p_payer_id    uuid,
  p_status      text,
  p_kind        text,          -- 'installment' | 'recurring'
  p_count       integer        -- nº de parcelas / meses
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_series uuid := gen_random_uuid();
  v_each   numeric(12,2);
  v_first  numeric(12,2);
  i int;
begin
  if p_kind not in ('installment','recurring') then raise exception 'tipo de série inválido'; end if;
  if p_count < 2 or p_count > 60 then raise exception 'quantidade deve ser entre 2 e 60'; end if;

  if p_kind = 'installment' then
    v_each  := trunc(p_amount / p_count, 2);
    v_first := p_amount - v_each * (p_count - 1);  -- centavos de arredondamento na 1ª parcela
  else
    v_each  := p_amount;
    v_first := p_amount;
  end if;

  for i in 1..p_count loop
    insert into transactions (type, description, amount, category, date, payer_id, status,
                              series_id, series_kind, installment_number, installment_total)
    values (p_type,
            p_description,
            case when i = 1 then v_first else v_each end,
            p_category,
            (p_date + make_interval(months => i - 1))::date,
            p_payer_id,
            case when i = 1 then p_status else 'pending' end,
            v_series, p_kind, i, p_count);
  end loop;
  return v_series;
end $$;
revoke all on function public.create_transaction_series(text,text,numeric,text,date,uuid,text,text,integer) from public, anon;
grant execute on function public.create_transaction_series(text,text,numeric,text,date,uuid,text,text,integer) to authenticated;

-- =====================================================================
-- 10. REALTIME (respeita RLS para postgres_changes)
-- =====================================================================
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.checklist_items;
alter publication supabase_realtime add table public.transactions;
