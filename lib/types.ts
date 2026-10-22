export type MemberColor = 'rose' | 'sky' | 'emerald' | 'amber' | 'violet';

export interface Profile {
  id: string;
  display_name: string;
  color: MemberColor;
  household_id: string | null;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string | null;
  invite_expires_at: string | null;
}

export type EventCategory = 'trabalho' | 'familia' | 'saude' | 'lazer' | 'casa' | 'outros';

export interface CalendarEvent {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  category: EventCategory;
  assignee_id: string | null; // null = Ambos
  created_by: string;
}

export interface Note {
  id: string;
  household_id: string;
  kind: 'note' | 'checklist';
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  updated_at: string;
  created_by: string;
}

export interface ChecklistItem {
  id: string;
  note_id: string;
  text: string;
  done: boolean;
  position: number;
}

export type TxCategory =
  | 'alimentacao' | 'moradia' | 'transporte' | 'saude' | 'lazer'
  | 'educacao' | 'contas' | 'compras' | 'salario' | 'outros';

export interface Transaction {
  id: string;
  household_id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  category: TxCategory;
  date: string; // YYYY-MM-DD
  payer_id: string | null;
  status: 'paid' | 'pending';
  series_id: string | null;
  series_kind: 'installment' | 'recurring' | null;
  installment_number: number | null;
  installment_total: number | null;
}
