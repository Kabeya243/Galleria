"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Exhibition Planner — plan one exhibition: title, concept, curatorial
// statement, dates, artwork selection from the user's own works, room
// assignment, artwork sequence (up/down), wall labels (auto-generated
// from artwork data, editable), installation checklist, team assignments
// and installation notes. The whole plan persists as one SavedWork row
// (kind "exhibition-plan") via /api/saved-work, so several plans can be
// kept side by side. Export is a real print-to-PDF (window.print() + a
// print stylesheet, one clean printable view).
//
// Design: the existing white-gallery luxury language only — white paper,
// near-black ink, discrete gold accent, Fraunces + DM Sans. Component
// styles live in the <style> block at the bottom of this file so
// globals.css stays untouched.

export type PlannerArtwork = {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  imageUrl: string | null;
  exhibitionId: string;
  exhibitionTitle: string;
};

type PlanItem = { artworkId: string; room: string; label: string };
type ChecklistItem = { id: string; text: string; done: boolean };
type TeamMember = { id: string; name: string; role: string; task: string };

type PlanData = {
  title: string;
  concept: string;
  statement: string;
  venue: string;
  startDate: string;
  endDate: string;
  rooms: string[];
  items: PlanItem[];
  checklist: ChecklistItem[];
  team: TeamMember[];
  notes: string;
};

type SavedPlan = { id: string; title: string; data: PlanData; updatedAt: string };

const EMPTY_PLAN: PlanData = {
  title: "",
  concept: "",
  statement: "",
  venue: "",
  startDate: "",
  endDate: "",
  rooms: ["Main Room"],
  items: [],
  checklist: [],
  team: [],
  notes: "",
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function autoLabel(a: PlannerArtwork): string {
  const bits = [a.title, a.artist, a.year].filter(Boolean);
  const head = bits.join(", ");
  const tail = [a.medium, a.dimensions].filter(Boolean).join(" · ");
  return tail ? `${head}\n${tail}` : head;
}

function parsePlan(raw: unknown): PlanData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const rooms = Array.isArray(r.rooms) ? r.rooms.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  const items = Array.isArray(r.items)
    ? r.items
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && typeof x.artworkId === "string")
        .map((x) => ({ artworkId: x.artworkId as string, room: str(x.room) || "Main Room", label: str(x.label) }))
    : [];
  const checklist = Array.isArray(r.checklist)
    ? r.checklist
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && typeof x.text === "string")
        .map((x) => ({ id: str(x.id) || uid(), text: x.text as string, done: x.done === true }))
    : [];
  const team = Array.isArray(r.team)
    ? r.team
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((x) => ({ id: str(x.id) || uid(), name: str(x.name), role: str(x.role), task: str(x.task) }))
    : [];
  return {
    title: str(r.title),
    concept: str(r.concept),
    statement: str(r.statement),
    venue: str(r.venue),
    startDate: str(r.startDate),
    endDate: str(r.endDate),
    rooms: rooms.length > 0 ? rooms : ["Main Room"],
    items,
    checklist,
    team,
    notes: str(r.notes),
  };
}

export default function ExhibitionPlanner({ artworks }: { artworks: PlannerArtwork[] }) {
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanData>(EMPTY_PLAN);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Picker / rooms / checklist / team inputs.
  const [pickerQuery, setPickerQuery] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [newChecklist, setNewChecklist] = useState("");
  const [newMember, setNewMember] = useState({ name: "", role: "", task: "" });

  const byId = useMemo(() => new Map(artworks.map((a) => [a.id, a])), [artworks]);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const res = await fetch("/api/saved-work?kind=exhibition-plan");
      if (!res.ok) throw new Error("fetch");
      const json = (await res.json()) as { saved?: { id: string; title: string; data: unknown; updatedAt: string }[] };
      setPlans(
        (json.saved ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          data: parsePlan(row.data),
          updatedAt: row.updatedAt,
        })),
      );
    } catch {
      setPlansError("Could not load your saved plans — check your connection and refresh the page.");
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const update = useCallback((patch: Partial<PlanData>) => {
    setPlan((p) => ({ ...p, ...patch }));
    setDirty(true);
    setStatus(null);
  }, []);

  const newPlan = () => {
    setCurrentId(null);
    setPlan(EMPTY_PLAN);
    setDirty(false);
    setStatus(null);
    setError(null);
    setConfirmDeleteId(null);
  };

  const openPlan = (p: SavedPlan) => {
    setCurrentId(p.id);
    setPlan(p.data);
    setDirty(false);
    setStatus(null);
    setError(null);
    setConfirmDeleteId(null);
  };

  const savePlan = async () => {
    const title = plan.title.trim() || "Untitled exhibition";
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const data = { ...plan, title };
      const res = await fetch("/api/saved-work", {
        method: currentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          currentId ? { id: currentId, title, data } : { kind: "exhibition-plan", title, data },
        ),
      });
      if (!res.ok) throw new Error("save");
      const json = (await res.json()) as { saved?: { id: string; title: string; updatedAt: string } };
      if (json.saved) {
        if (!currentId) setCurrentId(json.saved.id);
        setPlan((p) => ({ ...p, title }));
      }
      setDirty(false);
      setStatus(`Plan “${title}” saved.`);
      await loadPlans();
    } catch {
      setError("Could not save the plan — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete");
      setConfirmDeleteId(null);
      if (currentId === id) newPlan();
      setStatus("Plan deleted.");
      await loadPlans();
    } catch {
      setError("Could not delete the plan — check your connection and try again.");
    }
  };

  // --- Artwork selection / sequence / rooms --------------------------------
  const selectedIds = useMemo(() => new Set(plan.items.map((i) => i.artworkId)), [plan.items]);

  const pickerList = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return artworks.filter((a) => !q || `${a.title} ${a.artist}`.toLowerCase().includes(q));
  }, [artworks, pickerQuery]);

  const toggleArtwork = (a: PlannerArtwork) => {
    if (selectedIds.has(a.id)) {
      update({ items: plan.items.filter((i) => i.artworkId !== a.id) });
    } else {
      update({
        items: [...plan.items, { artworkId: a.id, room: plan.rooms[0] ?? "Main Room", label: autoLabel(a) }],
      });
    }
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    const next = [...plan.items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update({ items: next });
  };

  const setItem = (index: number, patch: Partial<PlanItem>) => {
    const next = plan.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    update({ items: next });
  };

  const addRoom = () => {
    const name = newRoom.trim();
    if (!name || plan.rooms.includes(name)) return;
    update({ rooms: [...plan.rooms, name] });
    setNewRoom("");
  };

  const removeRoom = (name: string) => {
    if (plan.rooms.length <= 1) return;
    const rooms = plan.rooms.filter((r) => r !== name);
    const items = plan.items.map((i) => (i.room === name ? { ...i, room: rooms[0] } : i));
    update({ rooms, items });
  };

  // --- Checklist / team ------------------------------------------------------
  const addChecklistItem = () => {
    const text = newChecklist.trim();
    if (!text) return;
    update({ checklist: [...plan.checklist, { id: uid(), text, done: false }] });
    setNewChecklist("");
  };

  const toggleChecklist = (id: string) => {
    update({ checklist: plan.checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) });
  };

  const removeChecklist = (id: string) => {
    update({ checklist: plan.checklist.filter((c) => c.id !== id) });
  };

  const addMember = () => {
    if (!newMember.name.trim() && !newMember.role.trim() && !newMember.task.trim()) return;
    update({ team: [...plan.team, { id: uid(), ...newMember }] });
    setNewMember({ name: "", role: "", task: "" });
  };

  const removeMember = (id: string) => {
    update({ team: plan.team.filter((m) => m.id !== id) });
  };

  const doneCount = plan.checklist.filter((c) => c.done).length;

  const printPlan = useCallback(() => {
    setStatus("In the print dialog, choose “Save as PDF”, A4 portrait, and turn off headers and footers.");
    window.print();
  }, []);

  const dateRange =
    plan.startDate || plan.endDate
      ? [plan.startDate, plan.endDate].filter(Boolean).join(" — ")
      : "Dates to confirm";

  return (
    <div className="ep-wrap">
      {/* Saved plans */}
      <section className="ep-card ep-screen" aria-label="Saved exhibition plans">
        <div className="ep-card-head">
          <h2>Your plans</h2>
          <button type="button" className="ep-btn" onClick={newPlan}>
            + New plan
          </button>
        </div>
        {plansLoading ? (
          <p className="ep-muted">Loading your plans…</p>
        ) : plansError ? (
          <p className="ep-error" role="alert">{plansError}</p>
        ) : plans.length === 0 ? (
          <p className="ep-muted">
            No plans saved yet. Start below — give the exhibition a title and a concept, pick the works, and save it.
          </p>
        ) : (
          <ul className="ep-plan-list">
            {plans.map((p) => (
              <li key={p.id} className={currentId === p.id ? "ep-plan-active" : undefined}>
                <button type="button" className="ep-plan-btn" onClick={() => openPlan(p)}>
                  <strong>{p.title}</strong>
                  <span>
                    {p.data.items.length} work{p.data.items.length === 1 ? "" : "s"}
                    {p.data.startDate ? ` · ${p.data.startDate}` : ""}
                  </span>
                </button>
                {confirmDeleteId === p.id ? (
                  <span className="ep-inline-confirm">
                    Delete this plan?
                    <button type="button" className="ep-btn ep-btn-danger" onClick={() => void deletePlan(p.id)}>
                      Yes, delete
                    </button>
                    <button type="button" className="ep-btn ep-btn-ghost" onClick={() => setConfirmDeleteId(null)}>
                      Keep it
                    </button>
                  </span>
                ) : (
                  <button type="button" className="ep-btn ep-btn-ghost" onClick={() => setConfirmDeleteId(p.id)}>
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {status && <p className="ep-status ep-screen" role="status">{status}</p>}
      {error && <p className="ep-error ep-screen" role="alert">{error}</p>}

      {/* Editor */}
      <div className="ep-grid ep-screen">
        <section className="ep-card" aria-label="Exhibition details">
          <h2>Exhibition</h2>
          <label className="ep-field">
            <span>Title</span>
            <input
              type="text"
              value={plan.title}
              placeholder="e.g. Already Enough As We Are"
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>
          <label className="ep-field">
            <span>Venue</span>
            <input
              type="text"
              value={plan.venue}
              placeholder="Gallery, city…"
              onChange={(e) => update({ venue: e.target.value })}
            />
          </label>
          <div className="ep-field-row">
            <label className="ep-field">
              <span>Opens</span>
              <input type="date" value={plan.startDate} onChange={(e) => update({ startDate: e.target.value })} />
            </label>
            <label className="ep-field">
              <span>Closes</span>
              <input type="date" value={plan.endDate} onChange={(e) => update({ endDate: e.target.value })} />
            </label>
          </div>
          <label className="ep-field">
            <span>Concept</span>
            <textarea
              rows={3}
              value={plan.concept}
              placeholder="The idea in a few sentences — what the show is about and why now."
              onChange={(e) => update({ concept: e.target.value })}
            />
          </label>
          <label className="ep-field">
            <span>Curatorial statement</span>
            <textarea
              rows={5}
              value={plan.statement}
              placeholder="The longer text for the wall, the catalogue and the press release."
              onChange={(e) => update({ statement: e.target.value })}
            />
          </label>
        </section>

        <section className="ep-card" aria-label="Artwork selection">
          <h2>Artworks · {plan.items.length} selected</h2>
          <input
            type="search"
            className="ep-search"
            placeholder="Search your artworks…"
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            aria-label="Search your artworks"
          />
          <ul className="ep-picker">
            {pickerList.map((a) => {
              const on = selectedIds.has(a.id);
              return (
                <li key={a.id}>
                  <label className={on ? "ep-pick ep-pick-on" : "ep-pick"}>
                    <input type="checkbox" checked={on} onChange={() => toggleArtwork(a)} />
                    {a.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.imageUrl} alt="" className="ep-thumb" />
                    ) : (
                      <span className="ep-thumb ep-thumb-blank" aria-hidden="true" />
                    )}
                    <span className="ep-pick-text">
                      <strong>{a.title}</strong>
                      <span>
                        {[a.artist, a.year].filter(Boolean).join(", ")}
                        {a.exhibitionTitle ? ` · ${a.exhibitionTitle}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
            {pickerList.length === 0 && <li className="ep-muted">No artworks match that search.</li>}
          </ul>
        </section>
      </div>

      {/* Rooms */}
      <section className="ep-card ep-screen" aria-label="Rooms">
        <h2>Rooms</h2>
        <p className="ep-muted">Name the rooms of the venue, then assign each artwork to one below.</p>
        <div className="ep-rooms">
          {plan.rooms.map((r) => (
            <span key={r} className="ep-room-chip">
              {r}
              {plan.rooms.length > 1 && (
                <button type="button" onClick={() => removeRoom(r)} aria-label={`Remove room ${r}`}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="ep-inline-add">
          <input
            type="text"
            placeholder="Add a room…"
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRoom();
              }
            }}
            aria-label="Add a room"
          />
          <button type="button" className="ep-btn" onClick={addRoom} disabled={!newRoom.trim()}>
            Add room
          </button>
        </div>
      </section>

      {/* Sequence + wall labels */}
      <section className="ep-card ep-screen" aria-label="Sequence and wall labels">
        <h2>Sequence &amp; wall labels</h2>
        {plan.items.length === 0 ? (
          <p className="ep-muted">No artworks selected yet — pick works above and they will appear here in order.</p>
        ) : (
          <ol className="ep-sequence">
            {plan.items.map((item, i) => {
              const a = byId.get(item.artworkId);
              if (!a) return null;
              return (
                <li key={item.artworkId} className="ep-seq-item">
                  <span className="ep-seq-num">{i + 1}</span>
                  {a.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.imageUrl} alt="" className="ep-thumb ep-thumb-lg" />
                  ) : (
                    <span className="ep-thumb ep-thumb-lg ep-thumb-blank" aria-hidden="true" />
                  )}
                  <div className="ep-seq-body">
                    <strong>{a.title}</strong>
                    <span className="ep-muted">
                      {[a.artist, a.year, a.medium, a.dimensions].filter(Boolean).join(" · ")}
                    </span>
                    <label className="ep-field">
                      <span>Room</span>
                      <select value={item.room} onChange={(e) => setItem(i, { room: e.target.value })}>
                        {plan.rooms.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="ep-field">
                      <span>Wall label</span>
                      <textarea
                        rows={2}
                        value={item.label}
                        onChange={(e) => setItem(i, { label: e.target.value })}
                      />
                    </label>
                    <button
                      type="button"
                      className="ep-link-btn"
                      onClick={() => setItem(i, { label: autoLabel(a) })}
                    >
                      Reset label to auto-generated text
                    </button>
                  </div>
                  <div className="ep-seq-order">
                    <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} aria-label={`Move ${a.title} earlier`}>
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(i, 1)}
                      disabled={i === plan.items.length - 1}
                      aria-label={`Move ${a.title} later`}
                    >
                      ↓
                    </button>
                    <button type="button" className="ep-remove" onClick={() => toggleArtwork(a)} aria-label={`Remove ${a.title} from the plan`}>
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="ep-grid ep-screen">
        {/* Checklist */}
        <section className="ep-card" aria-label="Installation checklist">
          <h2>
            Installation checklist · {doneCount}/{plan.checklist.length}
          </h2>
          <ul className="ep-checklist">
            {plan.checklist.map((c) => (
              <li key={c.id}>
                <label className={c.done ? "ep-check ep-check-done" : "ep-check"}>
                  <input type="checkbox" checked={c.done} onChange={() => toggleChecklist(c.id)} />
                  <span>{c.text}</span>
                </label>
                <button type="button" className="ep-remove" onClick={() => removeChecklist(c.id)} aria-label={`Remove “${c.text}”`}>
                  ×
                </button>
              </li>
            ))}
            {plan.checklist.length === 0 && <li className="ep-muted">Nothing on the list yet.</li>}
          </ul>
          <div className="ep-inline-add">
            <input
              type="text"
              placeholder="Add a task… e.g. Hang the large works first"
              value={newChecklist}
              onChange={(e) => setNewChecklist(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addChecklistItem();
                }
              }}
              aria-label="Add a checklist item"
            />
            <button type="button" className="ep-btn" onClick={addChecklistItem} disabled={!newChecklist.trim()}>
              Add
            </button>
          </div>
        </section>

        {/* Team */}
        <section className="ep-card" aria-label="Team assignments">
          <h2>Team · {plan.team.length}</h2>
          <ul className="ep-team">
            {plan.team.map((m) => (
              <li key={m.id}>
                <strong>{m.name || "Unnamed"}</strong>
                <span>{[m.role, m.task].filter(Boolean).join(" — ")}</span>
                <button type="button" className="ep-remove" onClick={() => removeMember(m.id)} aria-label={`Remove ${m.name || "team member"}`}>
                  ×
                </button>
              </li>
            ))}
            {plan.team.length === 0 && <li className="ep-muted">No one assigned yet.</li>}
          </ul>
          <div className="ep-team-form">
            <input
              type="text"
              placeholder="Name"
              value={newMember.name}
              onChange={(e) => setNewMember((m) => ({ ...m, name: e.target.value }))}
              aria-label="Team member name"
            />
            <input
              type="text"
              placeholder="Role"
              value={newMember.role}
              onChange={(e) => setNewMember((m) => ({ ...m, role: e.target.value }))}
              aria-label="Team member role"
            />
            <input
              type="text"
              placeholder="Task"
              value={newMember.task}
              onChange={(e) => setNewMember((m) => ({ ...m, task: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMember();
                }
              }}
              aria-label="Team member task"
            />
            <button type="button" className="ep-btn" onClick={addMember}>
              Add person
            </button>
          </div>
        </section>
      </div>

      {/* Notes + save / export */}
      <section className="ep-card ep-screen" aria-label="Installation notes">
        <h2>Installation notes</h2>
        <label className="ep-field">
          <span>Notes for the install team</span>
          <textarea
            rows={4}
            value={plan.notes}
            placeholder="Hanging heights, lighting, transport, what must not be rushed…"
            onChange={(e) => update({ notes: e.target.value })}
          />
        </label>
        <div className="ep-actions">
          <button type="button" className="galleries-open-button" onClick={() => void savePlan()} disabled={saving}>
            {saving ? "Saving…" : dirty ? "Save plan" : currentId ? "Saved" : "Save plan"}
          </button>
          <button type="button" className="ep-btn" onClick={printPlan}>
            Export PDF (print)
          </button>
          {dirty && <span className="ep-muted">Unsaved changes.</span>}
        </div>
        <p className="ep-muted ep-hint">
          “Export PDF” opens your browser’s print dialog — choose <strong>Save as PDF</strong>, paper size A4,
          portrait, and turn off headers and footers for a clean one-document plan.
        </p>
      </section>

      {/* Print-only view */}
      <div className="ep-print" aria-hidden="true">
        <h1>{plan.title || "Untitled exhibition"}</h1>
        <p className="ep-print-meta">
          {plan.venue ? `${plan.venue} · ` : ""}
          {dateRange}
        </p>
        {plan.concept && (
          <>
            <h2>Concept</h2>
            <p>{plan.concept}</p>
          </>
        )}
        {plan.statement && (
          <>
            <h2>Curatorial statement</h2>
            <p>{plan.statement}</p>
          </>
        )}
        <h2>Works in order ({plan.items.length})</h2>
        {plan.items.length === 0 ? (
          <p>No artworks selected.</p>
        ) : (
          <ol>
            {plan.items.map((item, i) => {
              const a = byId.get(item.artworkId);
              if (!a) return null;
              return (
                <li key={item.artworkId}>
                  <strong>
                    {i + 1}. {a.title}
                  </strong>{" "}
                  — {item.room}
                  <br />
                  <span className="ep-print-label">{item.label}</span>
                </li>
              );
            })}
          </ol>
        )}
        <h2>Installation checklist ({doneCount}/{plan.checklist.length} done)</h2>
        {plan.checklist.length === 0 ? (
          <p>No checklist items.</p>
        ) : (
          <ul>
            {plan.checklist.map((c) => (
              <li key={c.id}>
                {c.done ? "☑" : "☐"} {c.text}
              </li>
            ))}
          </ul>
        )}
        <h2>Team</h2>
        {plan.team.length === 0 ? (
          <p>No team assignments.</p>
        ) : (
          <ul>
            {plan.team.map((m) => (
              <li key={m.id}>
                <strong>{m.name || "Unnamed"}</strong>
                {m.role ? ` — ${m.role}` : ""}
                {m.task ? `: ${m.task}` : ""}
              </li>
            ))}
          </ul>
        )}
        {plan.notes && (
          <>
            <h2>Installation notes</h2>
            <p>{plan.notes}</p>
          </>
        )}
      </div>

      <style>{`
        .ep-wrap { display: flex; flex-direction: column; gap: 18px; }
        .ep-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
        .ep-card { background: #fff; border: 1px solid #e8e2d6; border-radius: 14px; padding: 22px; }
        .ep-card h2 { font-family: Fraunces, Georgia, serif; font-size: 21px; margin: 0 0 14px; }
        .ep-card-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
        .ep-card-head h2 { margin: 0; }
        .ep-muted { color: #6b6455; font-size: 14px; margin: 0; }
        .ep-error { color: #8a2f2f; font-size: 14px; margin: 0; }
        .ep-status { color: #5c6b4a; font-size: 14px; margin: 0; }
        .ep-hint { margin-top: 12px; }
        .ep-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .ep-field > span { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #6b6455; font-weight: 700; }
        .ep-field input, .ep-field select, .ep-field textarea, .ep-search, .ep-inline-add input, .ep-team-form input { background: #fdfdfc; border: 1px solid #ddd6c8; border-radius: 8px; padding: 9px 12px; font: inherit; font-size: 14px; color: #141414; width: 100%; box-sizing: border-box; }
        .ep-field textarea { resize: vertical; }
        .ep-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .ep-btn { background: #141414; color: #fdfdfc; border: 1px solid #141414; border-radius: 8px; padding: 8px 14px; font: inherit; font-size: 14px; cursor: pointer; white-space: nowrap; }
        .ep-btn:disabled { opacity: .5; cursor: not-allowed; }
        .ep-btn-ghost { background: transparent; color: #141414; }
        .ep-btn-danger { background: #8a2f2f; border-color: #8a2f2f; }
        .ep-plan-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .ep-plan-list li { display: flex; align-items: center; gap: 10px; border: 1px solid #e8e2d6; border-radius: 10px; padding: 8px 12px; }
        .ep-plan-active { background: #f7f3ea; border-color: #d9cba6; }
        .ep-plan-btn { flex: 1; background: none; border: none; padding: 0; font: inherit; text-align: left; cursor: pointer; color: #141414; }
        .ep-plan-btn strong { display: block; font-size: 15px; }
        .ep-plan-btn span { font-size: 13px; color: #6b6455; }
        .ep-inline-confirm { display: inline-flex; align-items: center; gap: 8px; color: #8a2f2f; font-size: 14px; font-weight: 600; }
        .ep-search { margin-bottom: 12px; }
        .ep-picker { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow-y: auto; }
        .ep-pick { display: flex; align-items: center; gap: 10px; border: 1px solid #e8e2d6; border-radius: 10px; padding: 8px 10px; cursor: pointer; font-size: 14px; }
        .ep-pick-on { background: #f7f3ea; border-color: #d9cba6; }
        .ep-pick-text { display: flex; flex-direction: column; min-width: 0; }
        .ep-pick-text span { color: #6b6455; font-size: 13px; }
        .ep-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid #e8e2d6; flex: none; }
        .ep-thumb-lg { width: 72px; height: 72px; }
        .ep-thumb-blank { background: #e8e2d6; }
        .ep-rooms { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .ep-room-chip { display: inline-flex; align-items: center; gap: 6px; background: #f0ead9; border: 1px solid #ddd2b2; color: #5c4a1f; border-radius: 999px; padding: 4px 6px 4px 12px; font-size: 13px; }
        .ep-room-chip button { background: none; border: none; cursor: pointer; color: inherit; font-size: 15px; line-height: 1; }
        .ep-inline-add { display: flex; gap: 8px; }
        .ep-inline-add input { flex: 1; }
        .ep-sequence { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
        .ep-seq-item { display: flex; gap: 14px; border: 1px solid #e8e2d6; border-radius: 12px; padding: 14px; align-items: flex-start; }
        .ep-seq-num { font-family: Fraunces, Georgia, serif; font-size: 20px; color: #a67c37; flex: none; width: 24px; text-align: center; }
        .ep-seq-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .ep-seq-body .ep-field { margin-bottom: 6px; }
        .ep-link-btn { background: none; border: none; padding: 0; font: inherit; font-size: 13px; color: #a67c37; cursor: pointer; text-align: left; text-decoration: underline; }
        .ep-seq-order { display: flex; flex-direction: column; gap: 6px; flex: none; }
        .ep-seq-order button { background: #fff; border: 1px solid #ddd6c8; border-radius: 6px; width: 32px; height: 30px; cursor: pointer; font-size: 14px; color: #141414; }
        .ep-seq-order button:disabled { opacity: .4; cursor: not-allowed; }
        .ep-remove { background: none !important; border: none !important; width: auto !important; height: auto !important; color: #8a2f2f !important; font-size: 13px !important; text-decoration: underline; cursor: pointer; padding: 0 !important; }
        .ep-checklist, .ep-team { list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .ep-checklist li, .ep-team li { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #efe9dc; padding-bottom: 8px; font-size: 14px; }
        .ep-check { display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer; min-width: 0; }
        .ep-check-done span { text-decoration: line-through; color: #6b6455; }
        .ep-team li strong { flex: none; }
        .ep-team li span { flex: 1; color: #6b6455; }
        .ep-team-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .ep-team-form input:nth-child(3), .ep-team-form .ep-btn { grid-column: 1 / -1; }
        .ep-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 6px; }
        .ep-print { display: none; }
        @media (max-width: 900px) { .ep-grid { grid-template-columns: 1fr; } }
        @media (max-width: 640px) {
          .ep-seq-item { flex-wrap: wrap; }
          .ep-team-form { grid-template-columns: 1fr; }
        }
        @media print {
          body * { visibility: hidden; }
          .ep-print, .ep-print * { visibility: visible; }
          .ep-print { display: block; position: absolute; inset: 0; padding: 0; font-family: "DM Sans", Arial, sans-serif; color: #141414; font-size: 12pt; line-height: 1.5; }
          .ep-print h1 { font-family: Fraunces, Georgia, serif; font-size: 24pt; margin: 0 0 4pt; }
          .ep-print h2 { font-family: Fraunces, Georgia, serif; font-size: 14pt; margin: 18pt 0 6pt; border-bottom: 1px solid #a67c37; padding-bottom: 3pt; }
          .ep-print p { margin: 0 0 8pt; white-space: pre-wrap; }
          .ep-print-meta { color: #6b6455; }
          .ep-print ol, .ep-print ul { margin: 0 0 8pt; padding-left: 18pt; }
          .ep-print li { margin-bottom: 6pt; }
          .ep-print-label { white-space: pre-wrap; font-size: 11pt; color: #444; }
          @page { size: A4 portrait; margin: 18mm; }
        }
      `}</style>
    </div>
  );
}
