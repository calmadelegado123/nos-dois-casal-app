'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, NotebookPen, Wallet, Settings } from 'lucide-react';

const TABS = [
  { href: '/agenda', label: 'Agenda', Icon: CalendarDays },
  { href: '/notas', label: 'Notas', Icon: NotebookPen },
  { href: '/financas', label: 'Finanças', Icon: Wallet },
  { href: '/ajustes', label: 'Ajustes', Icon: Settings },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/90 backdrop-blur">
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                  active ? 'text-brand-600' : 'text-stone-400 hover:text-stone-700'
                }`}
              >
                <Icon className={`h-6 w-6 ${active ? 'stroke-[2.4]' : ''}`} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
