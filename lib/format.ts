const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatBRL = (v: number) => brl.format(v);

export const pad = (n: number) => String(n).padStart(2, '0');

/** Date -> 'YYYY-MM-DD' no fuso local */
export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date -> valor para <input type="datetime-local"> no fuso local */
export function toLocalInput(d: Date) {
  return `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 'YYYY-MM-DD' -> Date local (meia-noite), sem o bug de fuso do new Date('YYYY-MM-DD') */
export function parseDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
export function startOfWeek(d: Date) {
  // semana começando no domingo (padrão BR)
  return addDays(startOfDay(d), -d.getDay());
}
export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function monthLabel(d: Date) {
  const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function dayLabel(d: Date) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Mensagem amigável a partir de erros do Supabase/Postgres */
export function errorMessage(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message);
  return 'Algo deu errado. Tente novamente.';
}
