'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed,
  Handshake, Loader2, Repeat, Trash2, Wallet,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useHousehold } from '@/components/HouseholdProvider';
import { useRealtime } from '@/lib/useRealtime';
import { EmptyState, Fab, PageHeader, Segmented, Sheet } from '@/components/ui';
import { TX_CATEGORIES } from '@/lib/constants';
import type { Transaction, TxCategory } from '@/lib/types';
import { addMonths, errorMessage, formatBRL, monthLabel, parseDateKey, toDateKey } from '@/lib/format';

type Filter = 'all' | 'expense' | 'income' | 'pending';

export default function FinancasPage() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Partial<Transaction> | null>(null);

  const load = useCallback(async () => {
    const from = toDateKey(month);
    const to = toDateKey(addMonths(month, 1));
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', from)
      .lt('date', to)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    // numeric chega como string no PostgREST
    setTxs(((data as Transaction[]) ?? []).map((t) => ({ ...t, amount: Number(t.amount) })));
    setLoading(false);
  }, [supabase, month]);

  useEffect(() => { load(); }, [load]);
  useRealtime(householdId, ['transactions'], load);

  async function toggleStatus(t: Transaction) {
    setTxs((list) => list.map((x) => (x.id === t.id ? { ...x, status: t.status === 'paid' ? 'pending' : 'paid' } : x)));
    await supabase.from('transactions').update({ status: t.status === 'paid' ? 'pending' : 'paid' }).eq('id', t.id);
  }

  const visible = txs.filter((t) =>
    filter === 'all' ? true : filter === 'pending' ? t.status === 'pending' : t.type === filter,
  );

  return (
    <>
      <PageHeader title="Finanças" />
      <div className="space-y-4 px-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth((m) => addMonths(m, -1))} className="rounded-full p-2 hover:bg-stone-200" aria-label="Mês anterior">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="font-semibold">{monthLabel(month)}</p>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} className="rounded-full p-2 hover:bg-stone-200" aria-label="Próximo mês">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>
        ) : (
          <>
            <Dashboard txs={txs} />

            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Tudo' },
                { value: 'expense', label: 'Saídas' },
                { value: 'income', label: 'Entradas' },
                { value: 'pending', label: 'Pendentes' },
              ]}
            />

            {visible.length === 0 ? (
              <EmptyState icon={<Wallet className="h-10 w-10" />} text="Nenhum lançamento neste mês." />
            ) : (
              <ul className="card divide-y divide-stone-100 p-0">
                {visible.map((t) => <TxRow key={t.id} tx={t} onOpen={() => setEditing(t)} onToggle={() => toggleStatus(t)} />)}
              </ul>
            )}
          </>
        )}
      </div>

      <Fab label="Novo lançamento" onClick={() => setEditing({ type: 'expense', status: 'paid' })} />
      <TxForm month={month} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </>
  );
}

/* ------------------------------ Dashboard ------------------------------ */

function Dashboard({ txs }: { txs: Transaction[] }) {
  const { members, nameOf, colorOf } = useHousehold();

  const s = useMemo(() => {
    const expenses = txs.filter((t) => t.type === 'expense');
    const incomes = txs.filter((t) => t.type === 'income');
    const sum = (l: Transaction[]) => l.reduce((a, t) => a + t.amount, 0);
    const paidExpenses = expenses.filter((t) => t.status === 'paid');

    const byPayer = members.map((m) => ({ id: m.id, total: sum(paidExpenses.filter((t) => t.payer_id === m.id)) }));
    const byCategory = Object.entries(
      expenses.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.category]: (acc[t.category] ?? 0) + t.amount }), {}),
    ).sort((a, b) => b[1] - a[1]);

    return {
      income: sum(incomes),
      expense: sum(expenses),
      pending: sum(expenses.filter((t) => t.status === 'pending')),
      byPayer,
      byCategory,
      sharedPaid: sum(paidExpenses.filter((t) => t.payer_id)),
    };
  }, [txs, members]);

  const balance = s.income - s.expense;
  const maxCat = s.byCategory[0]?.[1] ?? 1;

  // Acerto de contas: assume divisão 50/50 das despesas pagas
  let settlement: string | null = null;
  if (s.byPayer.length === 2) {
    const [a, b] = s.byPayer;
    const diff = (a.total - b.total) / 2;
    if (Math.abs(diff) >= 0.01) {
      const debtor = diff > 0 ? b.id : a.id;
      const creditor = diff > 0 ? a.id : b.id;
      settlement = `${nameOf(debtor)} deve ${formatBRL(Math.abs(diff))} para ${nameOf(creditor)}`;
    } else {
      settlement = 'Vocês estão quites 🎉';
    }
  }

  return (
    <div className="space-y-3">
      <div className="card bg-gradient-to-br from-brand-600 to-brand-700 text-white ring-0">
        <p className="text-xs uppercase tracking-wide text-white/70">Saldo do mês</p>
        <p className="text-3xl font-bold">{formatBRL(balance)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2"><ArrowUpCircle className="h-5 w-5 text-emerald-200" /><div><p className="text-white/70 text-xs">Entradas</p><p className="font-semibold">{formatBRL(s.income)}</p></div></div>
          <div className="flex items-center gap-2"><ArrowDownCircle className="h-5 w-5 text-rose-200" /><div><p className="text-white/70 text-xs">Despesas</p><p className="font-semibold">{formatBRL(s.expense)}</p></div></div>
        </div>
        {s.pending > 0 && <p className="mt-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs">⏳ {formatBRL(s.pending)} ainda pendente</p>}
      </div>

      {members.length > 0 && (
        <div className="card">
          <p className="mb-3 text-sm font-semibold">Quem pagou (despesas pagas)</p>
          <div className="space-y-2.5">
            {s.byPayer.map((p) => {
              const pct = s.sharedPaid ? (p.total / s.sharedPaid) * 100 : 0;
              return (
                <div key={p.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${colorOf(p.id).dot}`} />{nameOf(p.id)}</span>
                    <span className="font-medium">{formatBRL(p.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                    <div className={`h-full ${colorOf(p.id).dot}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {settlement && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">
              <Handshake className="h-4 w-4 shrink-0 text-stone-500" /> {settlement}
              <span className="ml-auto text-[10px] text-stone-400">50/50</span>
            </p>
          )}
        </div>
      )}

      {s.byCategory.length > 0 && (
        <div className="card">
          <p className="mb-3 text-sm font-semibold">Despesas por categoria</p>
          <div className="space-y-2">
            {s.byCategory.map(([cat, total]) => {
              const c = TX_CATEGORIES[cat as TxCategory];
              return (
                <div key={cat} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2 text-sm">
                  <span className="truncate">{c.emoji} {c.label}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(total / maxCat) * 100}%` }} />
                  </div>
                  <span className="text-right text-xs font-medium text-stone-600">{formatBRL(total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Linhas ------------------------------- */

function TxRow({ tx, onOpen, onToggle }: { tx: Transaction; onOpen: () => void; onToggle: () => void }) {
  const { nameOf, colorOf } = useHousehold();
  const c = TX_CATEGORIES[tx.category];
  const isIncome = tx.type === 'income';
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button onClick={onToggle} aria-label={tx.status === 'paid' ? 'Marcar como pendente' : 'Marcar como pago'}>
        {tx.status === 'paid'
          ? <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          : <CircleDashed className="h-6 w-6 text-amber-500" />}
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate font-medium">
          {tx.description}
          {tx.installment_total && tx.series_kind === 'installment' && (
            <span className="ml-1 text-xs text-stone-400">({tx.installment_number}/{tx.installment_total})</span>
          )}
          {tx.series_kind === 'recurring' && <Repeat className="ml-1 inline h-3 w-3 text-stone-400" />}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-stone-500">
          <span>{c.emoji} {c.label}</span>·
          <span>{parseDateKey(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
          {tx.payer_id && (<>·<span className={`inline-flex items-center gap-1 ${colorOf(tx.payer_id).text}`}>{nameOf(tx.payer_id)}</span></>)}
        </p>
      </button>
      <span className={`shrink-0 font-semibold ${isIncome ? 'text-emerald-600' : 'text-stone-800'}`}>
        {isIncome ? '+' : '−'} {formatBRL(tx.amount)}
      </span>
    </li>
  );
}

/* ------------------------------ Formulário ----------------------------- */

type RepeatMode = 'single' | 'installment' | 'recurring';

function TxForm({ month, initial, onClose, onSaved }: {
  month: Date; initial: Partial<Transaction> | null; onClose: () => void; onSaved: () => void;
}) {
  const supabase = createClient();
  const { me, members } = useHousehold();
  const [f, setF] = useState({
    type: 'expense' as Transaction['type'],
    description: '',
    amount: '',
    category: 'outros' as TxCategory,
    date: '',
    payer_id: '',
    status: 'paid' as Transaction['status'],
    repeat: 'single' as RepeatMode,
    count: '2',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!initial) return;
    setErr('');
    const today = new Date();
    const defaultDate = today.getMonth() === month.getMonth() && today.getFullYear() === month.getFullYear()
      ? toDateKey(today) : toDateKey(month);
    setF({
      type: initial.type ?? 'expense',
      description: initial.description ?? '',
      amount: initial.amount ? String(initial.amount).replace('.', ',') : '',
      category: initial.category ?? (initial.type === 'income' ? 'salario' : 'outros'),
      date: initial.date ?? defaultDate,
      payer_id: initial.id ? (initial.payer_id ?? '') : me.id,
      status: initial.status ?? 'paid',
      repeat: (initial.series_kind ?? 'single') as RepeatMode,
      count: String(initial.installment_total ?? 2),
    });

    // Parcelado: no formulário o valor mostrado é o TOTAL da compra (soma das parcelas)
    if (initial.series_id && initial.series_kind === 'installment') {
      supabase
        .from('transactions')
        .select('amount')
        .eq('series_id', initial.series_id)
        .then(({ data }) => {
          const rows = (data ?? []) as { amount: number | string }[];
          const total = rows.reduce((a, r) => a + Number(r.amount), 0);
          if (total > 0) setF((p) => ({ ...p, amount: total.toFixed(2).replace('.', ',') }));
        });
    }
  }, [initial, month, me.id, supabase]);

  // aceita "1.234,56", "1234,56" e "1234.56"
  const parseAmount = (v: string) => Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const amount = parseAmount(f.amount);
    if (!(amount > 0)) return setErr('Informe um valor maior que zero.');
    const count = Number(f.count);

    if (f.repeat !== 'single' && !(count >= 2 && count <= 60)) return setErr('Quantidade deve ser entre 2 e 60.');

    const wasSeries = !!initial?.series_id;
    if (initial?.id && wasSeries && f.repeat === 'single'
      && !confirm('Transformar a série inteira em um único lançamento? As outras parcelas serão removidas.')) return;

    setSaving(true);
    let error: { message: string } | null = null;
    if (initial?.id && (wasSeries || f.repeat !== 'single')) {
      // muda parcelas/recorrência: refaz a série inteira no banco
      ({ error } = await supabase.rpc('rebuild_transaction_series', {
        p_tx_id: initial.id, p_kind: f.repeat, p_count: f.repeat === 'single' ? 1 : count,
        p_type: f.type, p_description: f.description.trim(), p_amount: amount, p_category: f.category,
        p_date: f.date, p_payer_id: f.payer_id || null, p_status: f.status,
      }));
    } else if (initial?.id) {
      ({ error } = await supabase.from('transactions').update({
        type: f.type, description: f.description.trim(), amount, category: f.category,
        date: f.date, payer_id: f.payer_id || null, status: f.status,
      }).eq('id', initial.id));
    } else if (f.repeat === 'single') {
      ({ error } = await supabase.from('transactions').insert({
        type: f.type, description: f.description.trim(), amount, category: f.category,
        date: f.date, payer_id: f.payer_id || null, status: f.status,
      }));
    } else {
      ({ error } = await supabase.rpc('create_transaction_series', {
        p_type: f.type, p_description: f.description.trim(), p_amount: amount, p_category: f.category,
        p_date: f.date, p_payer_id: f.payer_id || null, p_status: f.status, p_kind: f.repeat, p_count: count,
      }));
    }
    setSaving(false);
    if (error) return setErr(errorMessage(error));
    onSaved();
  }

  async function remove(scope: 'one' | 'future') {
    if (!initial?.id) return;
    const msg = scope === 'one' ? 'Excluir este lançamento?' : 'Excluir este e todos os próximos da série?';
    if (!confirm(msg)) return;
    const q = supabase.from('transactions').delete();
    const { error } = scope === 'one'
      ? await q.eq('id', initial.id)
      : await q.eq('series_id', initial.series_id!).gte('date', initial.date!);
    if (error) return setErr(errorMessage(error));
    onSaved();
  }

  const isSeries = !!initial?.series_id;
  const perInstallment = f.repeat === 'installment' && parseAmount(f.amount) > 0 && Number(f.count) >= 2
    ? formatBRL(parseAmount(f.amount) / Number(f.count)) : null;

  return (
    <Sheet open={!!initial} onClose={onClose} title={initial?.id ? 'Editar lançamento' : 'Novo lançamento'}>
      <form onSubmit={save} className="space-y-4">
        <Segmented<Transaction['type']>
          value={f.type}
          onChange={(type) => setF({ ...f, type, category: type === 'income' ? 'salario' : f.category === 'salario' ? 'outros' : f.category })}
          options={[{ value: 'expense', label: '− Despesa' }, { value: 'income', label: '+ Receita' }]}
        />

        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <div>
            <label className="label">Descrição</label>
            <input className="input" required maxLength={120} value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Mercado" />
          </div>
          <div>
            <label className="label">Valor (R$)</label>
            <input className="input" required inputMode="decimal" value={f.amount} placeholder="0,00"
              onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.,]/g, '') })} />
          </div>
        </div>

        <div>
          <label className="label">Categoria</label>
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as TxCategory })}>
            {(Object.keys(TX_CATEGORIES) as TxCategory[]).map((k) => (
              <option key={k} value={k}>{TX_CATEGORIES[k].emoji} {TX_CATEGORIES[k].label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Data</label>
            <input className="input" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </div>
          <div>
            <label className="label">{f.type === 'income' ? 'Recebido por' : 'Quem pagou'}</label>
            <select className="input" value={f.payer_id} onChange={(e) => setF({ ...f, payer_id: e.target.value })}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              <option value="">Conta conjunta</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Status</label>
          <Segmented<Transaction['status']>
            value={f.status}
            onChange={(status) => setF({ ...f, status })}
            options={[{ value: 'paid', label: '✓ Pago' }, { value: 'pending', label: '⏳ Pendente' }]}
          />
        </div>

        <div className="rounded-xl bg-stone-50 p-3">
            <label className="label">
              Repetição
              {isSeries && initial?.installment_number && (
                <span className="ml-1 normal-case tracking-normal text-stone-400">
                  · editando a {initial.installment_number}ª de {initial.installment_total}
                </span>
              )}
            </label>
            <Segmented<RepeatMode>
              value={f.repeat}
              onChange={(repeat) => setF({ ...f, repeat })}
              options={[
                { value: 'single', label: 'Única' },
                { value: 'installment', label: 'Parcelada' },
                { value: 'recurring', label: 'Mensal' },
              ]}
            />
            {f.repeat !== 'single' && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <input className="input w-20 text-center" type="number" min={2} max={60} value={f.count}
                  onChange={(e) => setF({ ...f, count: e.target.value })} />
                <span className="text-stone-600">
                  {f.repeat === 'installment'
                    ? <>parcelas{perInstallment && <> de <b>{perInstallment}</b></>} (valor acima = total)</>
                    : 'meses (valor acima = cada mês)'}
                </span>
              </div>
            )}
            {f.repeat !== 'single' && (
              <p className="mt-2 text-[11px] text-stone-400">
                {initial?.id
                  ? 'Ao salvar, a série inteira é refeita com esses dados. Parcelas já pagas continuam pagas; as novas entram como pendentes.'
                  : 'As ocorrências futuras são criadas como pendentes.'}
              </p>
            )}
          </div>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <div className="flex flex-wrap gap-2">
          {initial?.id && (
            <>
              <button type="button" onClick={() => remove('one')} className="btn-danger" aria-label="Excluir">
                <Trash2 className="h-4 w-4" />{isSeries && 'Só este'}
              </button>
              {isSeries && (
                <button type="button" onClick={() => remove('future')} className="btn-danger">Este e próximos</button>
              )}
            </>
          )}
          <button type="submit" className="btn-primary flex-1" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </Sheet>
  );
}
