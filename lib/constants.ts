import type { EventCategory, MemberColor, TxCategory } from './types';

export const EVENT_CATEGORIES: Record<EventCategory, { label: string; color: string }> = {
  trabalho: { label: 'Trabalho', color: 'indigo' },
  familia:  { label: 'Família',  color: 'pink' },
  saude:    { label: 'Saúde',    color: 'emerald' },
  lazer:    { label: 'Lazer',    color: 'amber' },
  casa:     { label: 'Casa',     color: 'teal' },
  outros:   { label: 'Outros',   color: 'slate' },
};

export const TX_CATEGORIES: Record<TxCategory, { label: string; emoji: string }> = {
  alimentacao: { label: 'Alimentação', emoji: '🛒' },
  moradia:     { label: 'Moradia',     emoji: '🏠' },
  transporte:  { label: 'Transporte',  emoji: '🚗' },
  saude:       { label: 'Saúde',       emoji: '💊' },
  lazer:       { label: 'Lazer',       emoji: '🎉' },
  educacao:    { label: 'Educação',    emoji: '📚' },
  contas:      { label: 'Contas',      emoji: '💡' },
  compras:     { label: 'Compras',     emoji: '🛍️' },
  salario:     { label: 'Salário',     emoji: '💰' },
  outros:      { label: 'Outros',      emoji: '📦' },
};

export const MEMBER_COLORS: MemberColor[] = ['rose', 'sky', 'emerald', 'amber', 'violet'];

/** Classes estáticas por cor (tailwind precisa enxergar os nomes completos). */
export const COLOR_CLASSES: Record<string, { dot: string; soft: string; text: string; border: string }> = {
  rose:    { dot: 'bg-rose-500',    soft: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-500' },
  sky:     { dot: 'bg-sky-500',     soft: 'bg-sky-100',     text: 'text-sky-700',     border: 'border-sky-500' },
  emerald: { dot: 'bg-emerald-500', soft: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-500' },
  amber:   { dot: 'bg-amber-500',   soft: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-500' },
  violet:  { dot: 'bg-violet-500',  soft: 'bg-violet-100',  text: 'text-violet-700',  border: 'border-violet-500' },
  indigo:  { dot: 'bg-indigo-500',  soft: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-500' },
  pink:    { dot: 'bg-pink-500',    soft: 'bg-pink-100',    text: 'text-pink-700',    border: 'border-pink-500' },
  teal:    { dot: 'bg-teal-500',    soft: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-500' },
  slate:   { dot: 'bg-slate-500',   soft: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-500' },
};
