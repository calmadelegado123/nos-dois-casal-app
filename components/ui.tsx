'use client';

import { useEffect } from 'react';
import { X, Plus } from 'lucide-react';

/** Bottom-sheet no celular, modal centralizado no desktop */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/40" onClick={onClose} />
      <div className="safe-bottom relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-24 right-5 z-20 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition active:scale-95 sm:right-[calc(50%-20rem)]"
    >
      <Plus className="h-7 w-7" />
    </button>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="safe-top sticky top-0 z-20 bg-stone-50/90 px-4 pb-2 pt-4 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        {children}
      </div>
    </header>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-stone-200/60 p-1 text-sm font-medium">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 py-1.5 transition ${value === o.value ? 'bg-white shadow-sm' : 'text-stone-500'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-stone-400">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  );
}
