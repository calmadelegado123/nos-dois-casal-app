'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarX2, ChevronLeft, ChevronRight, Clock, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useHousehold } from '@/components/HouseholdProvider';
import { useRealtime } from '@/lib/useRealtime';
import { EmptyState, Fab, PageHeader, Segmented, Sheet } from '@/components/ui';
import { COLOR_CLASSES, EVENT_CATEGORIES } from '@/lib/constants';
import type { CalendarEvent, EventCategory } from '@/lib/types';
import {
  WEEKDAYS_SHORT, addDays, addMonths, dayLabel, errorMessage, isSameDay, monthLabel,
  startOfDay, startOfWeek, timeLabel, toDateKey, toLocalInput,
} from '@/lib/format';

type View = 'month' | 'week' | 'day' | 'list';

function rangeFor(view: View, cursor: Date): [Date, Date] {
  if (view === 'month') {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return [start, addDays(start, 42)];
  }
  if (view === 'week') {
    const start = startOfWeek(cursor);
    return [start, addDays(start, 7)];
  }
  if (view === 'day') {
    const start = startOfDay(cursor);
    return [start, addDays(start, 1)];
  }
  const start = startOfDay(new Date());
  return [start, addDays(start, 90)];
}

/** um evento "ocorre" num dia se cruza aquele intervalo */
function occursOn(ev: CalendarEvent, day: Date) {
  const s = new Date(ev.starts_at);
  const e = new Date(ev.ends_at);
  const d0 = startOfDay(day);
  const d1 = addDays(d0, 1);
  return s < d1 && e >= d0;
}

export default function AgendaPage() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null);

  const [from, to] = useMemo(() => rangeFor(view, cursor), [view, cursor]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .lt('starts_at', to.toISOString())
      .gte('ends_at', from.toISOString())
      .order('starts_at')
      .limit(500);
    setEvents((data as CalendarEvent[]) ?? []);
    setLoading(false);
  }, [supabase, from, to]);

  useEffect(() => { load(); }, [load]);
  useRealtime(householdId, ['events'], load);

  function move(dir: 1 | -1) {
    if (view === 'month') setCursor((c) => addMonths(c, dir));
    else if (view === 'week') setCursor((c) => addDays(c, 7 * dir));
    else setCursor((c) => addDays(c, dir));
  }

  function newEvent(day?: Date) {
    const base = day ? new Date(day) : new Date();
    if (day) {
      base.setHours(9, 0, 0, 0);
    } else {
      base.setMinutes(0, 0, 0);
      base.setHours(base.getHours() + 1); // próxima hora cheia
    }
    setEditing({
      title: '',
      starts_at: base.toISOString(),
      ends_at: new Date(base.getTime() + 60 * 60 * 1000).toISOString(),
      all_day: false,
      category: 'outros',
      assignee_id: null,
    });
  }

  const headerLabel =
    view === 'month' ? monthLabel(cursor)
    : view === 'week' ? `${startOfWeek(cursor).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${addDays(startOfWeek(cursor), 6).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`
    : view === 'day' ? dayLabel(cursor)
    : 'Próximos 90 dias';

  return (
    <>
      <PageHeader title="Agenda">
        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setCursor(new Date())}>Hoje</button>
      </PageHeader>

      <div className="space-y-3 px-4">
        <Segmented<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: 'Mês' },
            { value: 'week', label: 'Semana' },
            { value: 'day', label: 'Dia' },
            { value: 'list', label: 'Lista' },
          ]}
        />

        {view !== 'list' && (
          <div className="flex items-center justify-between">
            <button onClick={() => move(-1)} className="rounded-full p-2 hover:bg-stone-200" aria-label="Anterior">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="font-semibold first-letter:uppercase">{headerLabel}</p>
            <button onClick={() => move(1)} className="rounded-full p-2 hover:bg-stone-200" aria-label="Próximo">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>
        ) : view === 'month' ? (
          <MonthGrid
            cursor={cursor}
            from={from}
            events={events}
            onPickDay={(d) => { setCursor(d); setView('day'); }}
          />
        ) : view === 'week' ? (
          <DayList days={Array.from({ length: 7 }, (_, i) => addDays(from, i))} events={events} onOpen={setEditing} onAdd={newEvent} />
        ) : view === 'day' ? (
          <DayList days={[cursor]} events={events} onOpen={setEditing} onAdd={newEvent} />
        ) : (
          <UpcomingList events={events} onOpen={setEditing} />
        )}
      </div>

      <Fab label="Novo compromisso" onClick={() => newEvent(view === 'day' ? cursor : undefined)} />

      <EventForm
        initial={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </>
  );
}

/* --------------------------------- Mês --------------------------------- */

function MonthGrid({ cursor, from, events, onPickDay }: {
  cursor: Date; from: Date; events: CalendarEvent[]; onPickDay: (d: Date) => void;
}) {
  const { colorOf } = useHousehold();
  const today = new Date();
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));

  return (
    <div className="card p-2">
      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-medium text-stone-400">
        {WEEKDAYS_SHORT.map((w) => <div key={w}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const dayEvents = events.filter((e) => occursOn(e, d));
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = isSameDay(d, today);
          return (
            <button
              key={toDateKey(d)}
              onClick={() => onPickDay(d)}
              className={`flex aspect-square flex-col items-center rounded-lg pt-1 text-sm transition hover:bg-stone-100 ${inMonth ? '' : 'text-stone-300'}`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-full ${isToday ? 'bg-brand-600 font-bold text-white' : ''}`}>
                {d.getDate()}
              </span>
              <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${e.assignee_id ? colorOf(e.assignee_id).dot : 'bg-stone-400'}`} />
                ))}
                {dayEvents.length > 3 && <span className="text-[9px] leading-none text-stone-400">+</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- Semana / Dia ----------------------------- */

function DayList({ days, events, onOpen, onAdd }: {
  days: Date[]; events: CalendarEvent[]; onOpen: (e: CalendarEvent) => void; onAdd: (d: Date) => void;
}) {
  const today = new Date();
  return (
    <div className="space-y-3">
      {days.map((d) => {
        const list = events.filter((e) => occursOn(e, d));
        return (
          <section key={toDateKey(d)}>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className={`text-sm font-semibold first-letter:uppercase ${isSameDay(d, today) ? 'text-brand-600' : 'text-stone-600'}`}>
                {dayLabel(d)}
              </h3>
              <button onClick={() => onAdd(d)} className="text-xs font-medium text-brand-600">+ adicionar</button>
            </div>
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-stone-200 px-3 py-3 text-xs text-stone-400">Livre</p>
            ) : (
              <div className="space-y-2">{list.map((e) => <EventCard key={e.id} ev={e} onClick={() => onOpen(e)} />)}</div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function UpcomingList({ events, onOpen }: { events: CalendarEvent[]; onOpen: (e: CalendarEvent) => void }) {
  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.ends_at) >= now);
  if (upcoming.length === 0) return <EmptyState icon={<CalendarX2 className="h-10 w-10" />} text="Nenhum compromisso nos próximos 90 dias." />;

  const groups = new Map<string, CalendarEvent[]>();
  for (const e of upcoming) {
    const k = toDateKey(new Date(Math.max(new Date(e.starts_at).getTime(), startOfDay(now).getTime())));
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([k, list]) => {
        const [y, m, d] = k.split('-').map(Number);
        return (
          <section key={k}>
            <h3 className="mb-1.5 text-sm font-semibold text-stone-600 first-letter:uppercase">{dayLabel(new Date(y, m - 1, d))}</h3>
            <div className="space-y-2">{list.map((e) => <EventCard key={e.id} ev={e} onClick={() => onOpen(e)} />)}</div>
          </section>
        );
      })}
    </div>
  );
}

function EventCard({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
  const { nameOf, colorOf } = useHousehold();
  const cat = EVENT_CATEGORIES[ev.category];
  const catColor = COLOR_CLASSES[cat.color];
  const who = ev.assignee_id ? colorOf(ev.assignee_id) : COLOR_CLASSES.slate;
  return (
    <button onClick={onClick} className={`card flex w-full items-start gap-3 border-l-4 p-3 text-left ${who.border}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{ev.title}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
          <Clock className="h-3 w-3" />
          {ev.all_day ? 'Dia inteiro' : `${timeLabel(ev.starts_at)} – ${timeLabel(ev.ends_at)}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <span className={`chip ${catColor.soft} ${catColor.text}`}>{cat.label}</span>
          <span className={`chip ${who.soft} ${who.text}`}>{nameOf(ev.assignee_id)}</span>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------ Formulário ----------------------------- */

function EventForm({ initial, onClose, onSaved }: {
  initial: Partial<CalendarEvent> | null; onClose: () => void; onSaved: () => void;
}) {
  const supabase = createClient();
  const { members } = useHousehold();
  const [f, setF] = useState({
    title: '', description: '', start: '', end: '', all_day: false,
    category: 'outros' as EventCategory, assignee_id: '' as string,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!initial) return;
    setErr('');
    const s = new Date(initial.starts_at ?? Date.now());
    const e = new Date(initial.ends_at ?? Date.now());
    setF({
      title: initial.title ?? '',
      description: initial.description ?? '',
      start: initial.all_day ? toDateKey(s) : toLocalInput(s),
      end: initial.all_day ? toDateKey(e) : toLocalInput(e),
      all_day: !!initial.all_day,
      category: (initial.category ?? 'outros') as EventCategory,
      assignee_id: initial.assignee_id ?? '',
    });
  }, [initial]);

  function toggleAllDay(v: boolean) {
    setF((p) => ({
      ...p,
      all_day: v,
      start: v ? p.start.slice(0, 10) : `${p.start.slice(0, 10)}T09:00`,
      end: v ? p.end.slice(0, 10) : `${p.end.slice(0, 10)}T10:00`,
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    let starts: Date, ends: Date;
    if (f.all_day) {
      const [sy, sm, sd] = f.start.split('-').map(Number);
      const [ey, em, ed] = f.end.split('-').map(Number);
      starts = new Date(sy, sm - 1, sd, 0, 0);
      ends = new Date(ey, em - 1, ed, 23, 59);
    } else {
      starts = new Date(f.start);
      ends = new Date(f.end);
    }
    if (ends < starts) return setErr('O fim precisa ser depois do início.');

    const payload = {
      title: f.title.trim(),
      description: f.description.trim() || null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      all_day: f.all_day,
      category: f.category,
      assignee_id: f.assignee_id || null,
    };
    setSaving(true);
    const { error } = initial?.id
      ? await supabase.from('events').update(payload).eq('id', initial.id)
      : await supabase.from('events').insert(payload);
    setSaving(false);
    if (error) return setErr(errorMessage(error));
    onSaved();
  }

  async function remove() {
    if (!initial?.id || !confirm('Excluir este compromisso?')) return;
    const { error } = await supabase.from('events').delete().eq('id', initial.id);
    if (error) return setErr(errorMessage(error));
    onSaved();
  }

  return (
    <Sheet open={!!initial} onClose={onClose} title={initial?.id ? 'Editar compromisso' : 'Novo compromisso'}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">Título</label>
          <input className="input" required maxLength={120} value={f.title} autoFocus
            onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex.: Consulta no dentista" />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.all_day}
            onChange={(e) => toggleAllDay(e.target.checked)} />
          Dia inteiro
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Início</label>
            <input className="input" required type={f.all_day ? 'date' : 'datetime-local'} value={f.start}
              onChange={(e) => setF({ ...f, start: e.target.value, end: e.target.value > f.end ? e.target.value : f.end })} />
          </div>
          <div>
            <label className="label">Fim</label>
            <input className="input" required type={f.all_day ? 'date' : 'datetime-local'} value={f.end} min={f.start}
              onChange={(e) => setF({ ...f, end: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="label">Categoria</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map((c) => {
              const cc = COLOR_CLASSES[EVENT_CATEGORIES[c].color];
              const on = f.category === c;
              return (
                <button key={c} type="button" onClick={() => setF({ ...f, category: c })}
                  className={`chip ring-1 ${on ? `${cc.soft} ${cc.text} ring-current` : 'bg-white text-stone-500 ring-stone-200'}`}>
                  {EVENT_CATEGORIES[c].label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label">Para quem</label>
          <div className="flex flex-wrap gap-1.5">
            {[{ id: '', name: 'Ambos', color: 'slate' }, ...members.map((m) => ({ id: m.id, name: m.display_name, color: m.color }))].map((o) => {
              const cc = COLOR_CLASSES[o.color];
              const on = f.assignee_id === o.id;
              return (
                <button key={o.id || 'both'} type="button" onClick={() => setF({ ...f, assignee_id: o.id })}
                  className={`chip ring-1 ${on ? `${cc.soft} ${cc.text} ring-current` : 'bg-white text-stone-500 ring-stone-200'}`}>
                  <span className={`h-2 w-2 rounded-full ${cc.dot}`} /> {o.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label">Descrição</label>
          <textarea className="input min-h-[80px]" maxLength={2000} value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <div className="flex gap-2">
          {initial?.id && (
            <button type="button" onClick={remove} className="btn-danger" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
          )}
          <button type="submit" className="btn-primary flex-1" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </Sheet>
  );
}
