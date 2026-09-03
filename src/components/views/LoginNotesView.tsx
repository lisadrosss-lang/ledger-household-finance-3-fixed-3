import React, { useState } from "react";
import { AppState, LoginNote } from "../../types";
import { Eye, EyeOff, KeyRound, Pencil, Plus, Save, Trash2, X } from "lucide-react";

interface LoginNotesViewProps {
  state: AppState;
  onUpdateLoginNotes: (loginNotes: LoginNote[]) => void;
  onShowToast: (message: string) => void;
}

const emptyNote: Omit<LoginNote, "id"> = {
  title: "",
  username: "",
  password: "",
  notes: "",
  url: "",
};

export const LoginNotesView: React.FC<LoginNotesViewProps> = ({
  state,
  onUpdateLoginNotes,
  onShowToast,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyNote);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({});

  const startAdd = () => {
    setEditingId(0);
    setForm(emptyNote);
  };

  const startEdit = (note: LoginNote) => {
    setEditingId(note.id);
    setForm({ title: note.title, username: note.username, password: note.password, notes: note.notes, url: note.url });
  };

  const saveNote = () => {
    if (!form.title.trim()) {
      onShowToast("Please enter a name for this login");
      return;
    }
    const note: LoginNote = { id: editingId || Date.now(), ...form, title: form.title.trim() };
    const next = editingId ? state.loginNotes.map((item) => (item.id === editingId ? note : item)) : [note, ...state.loginNotes];
    onUpdateLoginNotes(next);
    setEditingId(null);
    setForm(emptyNote);
    onShowToast(editingId ? "Login note updated" : "Login note added");
  };

  const deleteNote = (id: number) => {
    if (!window.confirm("Delete this login note?")) return;
    onUpdateLoginNotes(state.loginNotes.filter((note) => note.id !== id));
    onShowToast("Login note deleted");
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#2B2740]">Login details</h2>
          <p className="text-xs text-[#2B2740]/60 mt-1">Keep account names, usernames, passwords, and private notes together.</p>
        </div>
        <button onClick={startAdd} className="px-3 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
          <Plus size={15} /> Add note
        </button>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
        <KeyRound size={15} className="shrink-0 mt-0.5" />
        <span>These are sensitive details. Keep your app and Supabase access protected.</span>
      </div>

      {editingId !== null && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#7C3AED]/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#2B2740]">{editingId ? "Edit login note" : "Add login note"}</h3>
            <button onClick={() => setEditingId(null)} className="text-[#2B2740]/50 hover:text-[#2B2740]"><X size={17} /></button>
          </div>
          <input aria-label="Account name" placeholder="Account name" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full p-2.5 rounded-xl border border-black/10 text-sm" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input aria-label="Username or email" placeholder="Username or email" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full p-2.5 rounded-xl border border-black/10 text-sm" />
            <input aria-label="Password" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full p-2.5 rounded-xl border border-black/10 text-sm" />
          </div>
          <input aria-label="Website" placeholder="Website (optional)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full p-2.5 rounded-xl border border-black/10 text-sm" />
          <textarea aria-label="Private notes" placeholder="Private notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full p-2.5 rounded-xl border border-black/10 text-sm min-h-20" />
          <div className="flex gap-2">
            <button onClick={saveNote} className="flex-1 py-2.5 rounded-xl bg-[#7C3AED] text-white text-xs font-bold flex items-center justify-center gap-1.5"><Save size={14} /> Save</button>
            <button onClick={() => setEditingId(null)} className="px-4 py-2.5 rounded-xl bg-black/5 text-[#2B2740]/70 text-xs font-bold">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {state.loginNotes.length === 0 && editingId === null ? (
          <div className="bg-white rounded-2xl p-7 text-center text-xs text-[#2B2740]/50 border border-black/[0.04]">No login notes yet.</div>
        ) : state.loginNotes.map((note) => {
          const isVisible = !!visiblePasswords[note.id];
          return (
            <div key={note.id} className="bg-white rounded-2xl p-4 shadow-sm border border-black/[0.04] space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h3 className="font-extrabold text-sm text-[#2B2740] truncate">{note.title}</h3>{note.url && <a href={note.url} target="_blank" rel="noreferrer" className="text-[11px] text-[#7C3AED] truncate block">{note.url}</a>}</div>
                <div className="flex gap-1 shrink-0"><button title="Edit login note" onClick={() => startEdit(note)} className="p-1.5 text-[#7C3AED] hover:bg-[#7C3AED]/10 rounded-lg"><Pencil size={14} /></button><button title="Delete login note" onClick={() => deleteNote(note.id)} className="p-1.5 text-[#E5484D] hover:bg-[#E5484D]/10 rounded-lg"><Trash2 size={14} /></button></div>
              </div>
              <div className="text-xs space-y-1"><div><span className="text-[#2B2740]/50">Username: </span><span className="font-semibold text-[#2B2740]">{note.username || "Not set"}</span></div><div><span className="text-[#2B2740]/50">Password: </span><span className="font-mono text-[#2B2740]">{isVisible ? note.password || "Not set" : note.password ? "••••••••" : "Not set"}</span><button title={isVisible ? "Hide password" : "Show password"} onClick={() => setVisiblePasswords({ ...visiblePasswords, [note.id]: !isVisible })} className="ml-2 text-[#7C3AED] align-middle">{isVisible ? <EyeOff size={14} /> : <Eye size={14} />}</button></div></div>
              {note.notes && <p className="text-xs text-[#2B2740]/70 whitespace-pre-wrap border-t border-black/[0.05] pt-2">{note.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
