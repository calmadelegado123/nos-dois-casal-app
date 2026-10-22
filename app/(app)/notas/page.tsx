'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckSquare, Loader2, NotebookPen, Pin, PinOff, Search, Square, StickyNote, Tag, Trash2, X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useHousehold } from '@/components/HouseholdProvider';
import { useRealtime } from '@/lib/useRealtime';
import { EmptyState, Fab, PageHeader, Segmented, Sheet } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import type { ChecklistItem, Note } from '@/lib/types';

export default function NotasPage() {
  const supabase = createClient();
  const { householdId } = useHousehold();
  const [notes, setNotes] = useState<Note[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | 'new-note' | 'new-checklist' | null>(null);

  const load = useCallback(async () => {
    const [n, i] = await Promise.all([
      supabase.from('notes').select('*').order('pinned', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('checklist_items').select('id, note_id, text, done, position').order('position'),
    ]);
    setNotes((n.data as Note[]) ?? []);
    setItems((i.data as ChecklistItem[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);
  useRealtime(householdId, ['notes', 'checklist_items'], load);

  const allTags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort(), [notes]);
  const filtered = notes.filter((n) => {
    if (tag && !n.tags.includes(tag)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      items.some((i) => i.note_id === n.id && i.text.toLowerCase().includes(q))
    );
  });

  const [showNewMenu, setShowNewMenu] = useState(false);

  return (
    <>
      <PageHeader title="Notas & Listas" />
      <div className="space-y-3 px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input className="input pl-9" placeholder="Buscar..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {allTags.length > 0 && (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
            <button onClick={() => setTag(null)}
              className={`chip shrink-0 ring-1 ${!tag ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-600 ring-stone-200'}`}>
              Todas
            </button>
            {allTags.map((t) => (
              <button key={t} onClick={() => setTag(t === tag ? null : t)}
                className={`chip shrink-0 ring-1 ${tag === t ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-600 ring-stone-200'}`}>
                #{t}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<NotebookPen className="h-10 w-10" />} text="Nenhuma nota ainda. Toque no + para criar." />
        ) : (
          <div className="columns-2 gap-3 [&>*]:mb-3">
            {filtered.map((n) => (
              <NoteCard key={n.id} note={n} items={items.filter((i) => i.note_id === n.id)} onClick={() => setOpenId(n.id)} />
            ))}
          </div>
        )}
      </div>

      {showNewMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowNewMenu(false)}>
          <div className="absolute bottom-40 right-5 flex flex-col gap-2 sm:right-[calc(50%-20rem)]">
            <button className="btn-ghost shadow-lg" onClick={() => setOpenId('new-checklist')}>
              <CheckSquare className="h-4 w-4" /> Lista
            </button>
            <button className="btn-ghost shadow-lg" onClick={() => setOpenId('new-note')}>
              <StickyNote className="h-4 w-4" /> Nota
            </button>
          </div>
        </div>
      )}
      <Fab label="Nova nota" onClick={() => setShowNewMenu((v) => !v)} />

      <NoteEditor
        key={openId ?? 'closed'}
        openId={openId}
        note={notes.find((n) => n.id === openId) ?? null}
        allItems={items}
        onClose={() => { setOpenId(null); setShowNewMenu(false); load(); }}
        reload={load}
      />
    </>
  );
}

function NoteCard({ note, items, onClick }: { note: Note; items: ChecklistItem[]; onClick: () => void }) {
  const { nameOf } = useHousehold();
  const done = items.filter((i) => i.done).length;
  return (
    <button onClick={onClick} className="card block w-full break-inside-avoid text-left">
      <div className="mb-1 flex items-start gap-1">
        <p className="flex-1 font-semibold leading-tight">{note.title || (note.kind === 'checklist' ? 'Lista' : 'Nota')}</p>
        {note.pinned && <Pin className="h-3.5 w-3.5 shrink-0 fill-brand-500 text-brand-500" />}
      </div>
      {note.kind === 'note' ? (
        <p className="line-clamp-6 whitespace-pre-wrap text-sm text-stone-600">{note.content}</p>
      ) : (
        <>
          <ul className="space-y-0.5 text-sm text-stone-600">
            {items.filter((i) => !i.done).slice(0, 5).map((i) => (
              <li key={i.id} className="flex items-center gap-1.5"><Square className="h-3.5 w-3.5 shrink-0 text-stone-300" /><span className="truncate">{i.text}</span></li>
            ))}
          </ul>
          {items.length > 0 && (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full bg-emerald-500" style={{ width: `${(done / items.length) * 100}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-stone-400">{done}/{items.length} concluídos</p>
            </div>
          )}
        </>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {note.tags.map((t) => <span key={t} className="chip bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">#{t}</span>)}
      </div>
      <p className="mt-1 text-[10px] text-stone-400">por {nameOf(note.created_by, '—')}</p>
    </button>
  );
}

function NoteEditor({ openId, note, allItems, onClose, reload }: {
  openId: string | null;
  note: Note | null;
  allItems: ChecklistItem[];
  onClose: () => void;
  reload: () => void;
}) {
  const supabase = createClient();
  // id local: uma nota nova ganha id assim que o 1º item da lista é adicionado
  const [noteId, setNoteId] = useState<string | null>(note?.id ?? null);
  const [kind] = useState<Note['kind']>(note?.kind ?? (openId === 'new-checklist' ? 'checklist' : 'note'));
  const items = allItems.filter((i) => i.note_id === noteId);

  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [newItem, setNewItem] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // mantém o título/conteúdo sincronizado se o parceiro editar enquanto está aberto
  useEffect(() => {
    if (!note) return;
    setPinned(note.pinned);
    setTags(note.tags);
  }, [note]);

  const payload = () => ({ kind, title: title.trim(), content, tags, pinned });

  async function ensureNote(): Promise<string | null> {
    if (noteId) return noteId;
    const { data, error } = await supabase.from('notes').insert(payload()).select('id').single();
    if (error) { setErr(errorMessage(error)); return null; }
    setNoteId(data.id as string);
    return data.id as string;
  }

  async function save() {
    setErr('');
    setBusy(true);
    if (noteId) {
      const { error } = await supabase.from('notes').update(payload()).eq('id', noteId);
      if (error) { setErr(errorMessage(error)); setBusy(false); return; }
    } else if (title.trim() || content.trim()) {
      const id = await ensureNote();
      if (!id) { setBusy(false); return; }
    }
    setBusy(false);
    onClose();
  }

  async function remove() {
    if (!noteId || !confirm('Excluir esta nota?')) return;
    await supabase.from('notes').delete().eq('id', noteId);
    onClose();
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 24);
    if (t && !tags.includes(t) && tags.length < 10) setTags([...tags, t]);
    setTagInput('');
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const text = newItem.trim();
    if (!text) return;
    const noteId = await ensureNote();
    if (!noteId) return;
    setNewItem('');
    const position = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0;
    const { error } = await supabase.from('checklist_items').insert({ note_id: noteId, text, position });
    if (error) setErr(errorMessage(error));
    reload();
  }

  async function toggleItem(i: ChecklistItem) {
    await supabase.from('checklist_items').update({ done: !i.done }).eq('id', i.id);
    reload();
  }
  async function deleteItem(i: ChecklistItem) {
    await supabase.from('checklist_items').delete().eq('id', i.id);
    reload();
  }
  async function clearDone() {
    if (!noteId) return;
    await supabase.from('checklist_items').delete().eq('note_id', noteId).eq('done', true);
    reload();
  }

  const open = openId !== null;
  const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done) || a.position - b.position);

  return (
    <Sheet open={open} onClose={save} title={kind === 'checklist' ? 'Lista' : 'Nota'}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <input className="input text-lg font-semibold" placeholder="Título" maxLength={120}
            value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="button" onClick={() => setPinned(!pinned)} className="btn-ghost px-3" aria-label="Fixar">
            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
        </div>

        {kind === 'note' ? (
          <textarea className="input min-h-[200px]" placeholder="Escreva aqui..." maxLength={10000}
            value={content} onChange={(e) => setContent(e.target.value)} />
        ) : (
          <div className="space-y-2">
            <ul className="space-y-1">
              {sorted.map((i) => (
                <li key={i.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-stone-50">
                  <button onClick={() => toggleItem(i)} aria-label="Marcar">
                    {i.done ? <CheckSquare className="h-5 w-5 text-emerald-600" /> : <Square className="h-5 w-5 text-stone-300" />}
                  </button>
                  <span className={`flex-1 text-sm ${i.done ? 'text-stone-400 line-through' : ''}`}>{i.text}</span>
                  <button onClick={() => deleteItem(i)} className="text-stone-300 hover:text-red-500" aria-label="Remover item">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={addItem} className="flex gap-2">
              <input className="input" placeholder="Adicionar item..." maxLength={300}
                value={newItem} onChange={(e) => setNewItem(e.target.value)} />
              <button className="btn-primary" type="submit">Add</button>
            </form>
            {items.some((i) => i.done) && (
              <button onClick={clearDone} className="text-xs font-medium text-stone-500 hover:text-red-600">Limpar concluídos</button>
            )}
          </div>
        )}

        <div>
          <label className="label">Tags</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <span key={t} className="chip bg-stone-100 text-stone-600">
                #{t}
                <button onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remover ${t}`}><X className="h-3 w-3" /></button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5 text-stone-400" />
              <input className="w-28 border-b border-stone-200 bg-transparent py-1 text-sm outline-none focus:border-brand-500"
                placeholder="nova tag" value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                onBlur={addTag} />
            </div>
          </div>
        </div>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        <div className="flex gap-2">
          {noteId && (
            <button onClick={remove} className="btn-danger" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
          )}
          <button onClick={save} className="btn-primary flex-1" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar e fechar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
