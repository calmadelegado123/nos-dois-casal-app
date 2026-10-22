-- =====================================================================
-- 002 — Editar quantidade de parcelas / recorrência de um lançamento
-- Rode este arquivo UMA vez no SQL Editor do Supabase.
-- =====================================================================
-- Refaz a série inteira a partir de qualquer lançamento dela:
--  * p_kind 'single'      → vira um lançamento único
--  * p_kind 'installment' → p_amount é o valor TOTAL, dividido em p_count parcelas
--  * p_kind 'recurring'   → p_amount é o valor de CADA mês, por p_count meses
-- A data informada é a data do lançamento que está sendo editado; a 1ª parcela
-- é recalculada a partir dela. O status "pago/pendente" de cada parcela é
-- preservado pelo número da parcela; a parcela editada recebe p_status.
-- SECURITY INVOKER: tudo passa pelas políticas RLS normais.
create or replace function public.rebuild_transaction_series(
  p_tx_id       uuid,
  p_kind        text,
  p_count       integer,
  p_type        text,
  p_description text,
  p_amount      numeric,
  p_category    text,
  p_date        date,
  p_payer_id    uuid,
  p_status      text
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_tx      transactions;
  v_number  int;
  v_start   date;
  v_old     jsonb := '{}'::jsonb;
  v_series  uuid := gen_random_uuid();
  v_each    numeric(12,2);
  v_first   numeric(12,2);
  v_status  text;
  v_new_id  uuid;
  v_ret     uuid;
  i int;
begin
  select * into v_tx from transactions where id = p_tx_id;
  if not found then raise exception 'lançamento não encontrado'; end if;

  if p_kind not in ('single','installment','recurring') then raise exception 'tipo inválido'; end if;
  if p_kind <> 'single' and (p_count < 2 or p_count > 60) then
    raise exception 'quantidade deve ser entre 2 e 60';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'valor deve ser maior que zero'; end if;

  v_number := coalesce(v_tx.installment_number, 1);

  -- guarda o status atual de cada parcela e apaga a série antiga
  if v_tx.series_id is not null then
    select coalesce(jsonb_object_agg(installment_number::text, status), '{}'::jsonb)
      into v_old
      from transactions where series_id = v_tx.series_id;
    delete from transactions where series_id = v_tx.series_id;
  else
    v_old := jsonb_build_object('1', v_tx.status);
    delete from transactions where id = p_tx_id;
  end if;
  v_old := v_old || jsonb_build_object(v_number::text, p_status);

  -- vira lançamento único
  if p_kind = 'single' then
    insert into transactions (type, description, amount, category, date, payer_id, status)
    values (p_type, p_description, p_amount, p_category, p_date, p_payer_id, p_status)
    returning id into v_ret;
    return v_ret;
  end if;

  -- se a parcela editada sumiu (ex.: era a 8ª e agora são 6), ancora na 1ª
  if v_number > p_count then v_number := 1; end if;
  v_start := (p_date - make_interval(months => v_number - 1))::date;

  if p_kind = 'installment' then
    v_each  := trunc(p_amount / p_count, 2);
    v_first := p_amount - v_each * (p_count - 1);
  else
    v_each  := p_amount;
    v_first := p_amount;
  end if;

  for i in 1..p_count loop
    v_status := coalesce(v_old->>(i::text), 'pending');
    insert into transactions (type, description, amount, category, date, payer_id, status,
                              series_id, series_kind, installment_number, installment_total)
    values (p_type, p_description,
            case when i = 1 then v_first else v_each end,
            p_category,
            (v_start + make_interval(months => i - 1))::date,
            p_payer_id, v_status, v_series, p_kind, i, p_count)
    returning id into v_new_id;
    if i = v_number then v_ret := v_new_id; end if;
  end loop;

  return v_ret;
end $$;

revoke all on function public.rebuild_transaction_series(uuid,text,integer,text,text,numeric,text,date,uuid,text) from public, anon;
grant execute on function public.rebuild_transaction_series(uuid,text,integer,text,text,numeric,text,date,uuid,text) to authenticated;
