-- =====================================================================
-- 003 — "Parcela X de Y" + valor por parcela ou total
-- Rode este arquivo UMA vez no SQL Editor do Supabase (depois do 002).
-- Substitui as duas funções de série; não altera nenhum dado existente.
-- =====================================================================

drop function if exists public.create_transaction_series(text,text,numeric,text,date,uuid,text,text,integer);
drop function if exists public.rebuild_transaction_series(uuid,text,integer,text,text,numeric,text,date,uuid,text);

-- Calcula valor de cada parcela. Se informado o TOTAL, divide por p_count e
-- joga os centavos de arredondamento na 1ª parcela criada.
create or replace function public._series_amounts(
  p_amount numeric, p_is_total boolean, p_count int, p_kind text,
  out each_amount numeric(12,2), out first_amount numeric(12,2)
) language plpgsql immutable as $$
begin
  if p_kind = 'installment' and p_is_total then
    each_amount  := trunc(p_amount / p_count, 2);
    first_amount := p_amount - each_amount * (p_count - 1);
  else
    each_amount  := p_amount;
    first_amount := p_amount;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Criar série
--   p_number : número da parcela cuja data é p_date (ex.: 5 em "5 de 10").
--              Cria da parcela p_number até p_count. Para recorrente use 1.
--   p_amount_is_total : true = p_amount é o total da compra; false = valor de cada parcela
-- ---------------------------------------------------------------------
create or replace function public.create_transaction_series(
  p_type            text,
  p_description     text,
  p_amount          numeric,
  p_category        text,
  p_date            date,
  p_payer_id        uuid,
  p_status          text,
  p_kind            text,
  p_count           integer,
  p_number          integer default 1,
  p_amount_is_total boolean default true
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_series uuid := gen_random_uuid();
  v_amt    record;
  i int;
begin
  if p_kind not in ('installment','recurring') then raise exception 'tipo de série inválido'; end if;
  if p_count < 2 or p_count > 60 then raise exception 'quantidade deve ser entre 2 e 60'; end if;
  if p_number < 1 or p_number > p_count then raise exception 'parcela atual deve estar entre 1 e %', p_count; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'valor deve ser maior que zero'; end if;

  select * into v_amt from _series_amounts(p_amount, p_amount_is_total, p_count, p_kind);

  for i in p_number..p_count loop
    insert into transactions (type, description, amount, category, date, payer_id, status,
                              series_id, series_kind, installment_number, installment_total)
    values (p_type, p_description,
            case when i = p_number then v_amt.first_amount else v_amt.each_amount end,
            p_category,
            (p_date + make_interval(months => i - p_number))::date,
            p_payer_id,
            case when i = p_number then p_status else 'pending' end,
            v_series, p_kind, i, p_count);
  end loop;
  return v_series;
end $$;

-- ---------------------------------------------------------------------
-- Refazer série a partir de um lançamento dela (edição)
--   p_number : novo número do lançamento editado (ex.: 5 em "5 de 10")
--   A série passa a ir da menor parcela existente (ou p_number, se menor) até p_count.
--   Status pago/pendente é preservado pelo número da parcela.
-- ---------------------------------------------------------------------
create or replace function public.rebuild_transaction_series(
  p_tx_id           uuid,
  p_kind            text,
  p_count           integer,
  p_type            text,
  p_description     text,
  p_amount          numeric,
  p_category        text,
  p_date            date,
  p_payer_id        uuid,
  p_status          text,
  p_number          integer default 1,
  p_amount_is_total boolean default true
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_tx      transactions;
  v_old     jsonb := '{}'::jsonb;
  v_first   int;
  v_series  uuid := gen_random_uuid();
  v_amt     record;
  v_new_id  uuid;
  v_ret     uuid;
  i int;
begin
  select * into v_tx from transactions where id = p_tx_id;
  if not found then raise exception 'lançamento não encontrado'; end if;
  if p_kind not in ('single','installment','recurring') then raise exception 'tipo inválido'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'valor deve ser maior que zero'; end if;
  if p_kind <> 'single' then
    if p_count < 2 or p_count > 60 then raise exception 'quantidade deve ser entre 2 e 60'; end if;
    if p_number < 1 or p_number > p_count then raise exception 'parcela atual deve estar entre 1 e %', p_count; end if;
  end if;

  -- status das parcelas antigas (pelo número) + menor parcela existente
  if v_tx.series_id is not null then
    select coalesce(jsonb_object_agg(installment_number::text, status), '{}'::jsonb),
           min(installment_number)
      into v_old, v_first
      from transactions where series_id = v_tx.series_id;
    -- renumera os status antigos para acompanhar a parcela editada
    if v_tx.installment_number is not null and v_tx.installment_number <> p_number then
      select coalesce(jsonb_object_agg(((k::int) + p_number - v_tx.installment_number)::text, v), '{}'::jsonb)
        into v_old from jsonb_each_text(v_old) as t(k, v);
      v_first := v_first + p_number - v_tx.installment_number;
    end if;
    delete from transactions where series_id = v_tx.series_id;
  else
    v_first := p_number;
    delete from transactions where id = p_tx_id;
  end if;
  v_old := v_old || jsonb_build_object(p_number::text, p_status);

  if p_kind = 'single' then
    insert into transactions (type, description, amount, category, date, payer_id, status)
    values (p_type, p_description, p_amount, p_category, p_date, p_payer_id, p_status)
    returning id into v_ret;
    return v_ret;
  end if;

  v_first := greatest(1, least(coalesce(v_first, p_number), p_number));
  select * into v_amt from _series_amounts(p_amount, p_amount_is_total, p_count, p_kind);

  for i in v_first..p_count loop
    insert into transactions (type, description, amount, category, date, payer_id, status,
                              series_id, series_kind, installment_number, installment_total)
    values (p_type, p_description,
            case when i = v_first then v_amt.first_amount else v_amt.each_amount end,
            p_category,
            (p_date + make_interval(months => i - p_number))::date,
            p_payer_id,
            coalesce(v_old->>(i::text), 'pending'),
            v_series, p_kind, i, p_count)
    returning id into v_new_id;
    if i = p_number then v_ret := v_new_id; end if;
  end loop;
  return v_ret;
end $$;

revoke all on function public._series_amounts(numeric,boolean,int,text) from public, anon;
grant execute on function public._series_amounts(numeric,boolean,int,text) to authenticated;
revoke all on function public.create_transaction_series(text,text,numeric,text,date,uuid,text,text,integer,integer,boolean) from public, anon;
grant execute on function public.create_transaction_series(text,text,numeric,text,date,uuid,text,text,integer,integer,boolean) to authenticated;
revoke all on function public.rebuild_transaction_series(uuid,text,integer,text,text,numeric,text,date,uuid,text,integer,boolean) from public, anon;
grant execute on function public.rebuild_transaction_series(uuid,text,integer,text,text,numeric,text,date,uuid,text,integer,boolean) to authenticated;
