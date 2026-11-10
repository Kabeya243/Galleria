"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search, Trash2 } from "lucide-react";
import styles from "./tools.module.css";

type Contact = {
  id: string;
  name: string;
  role: string;
  email: string;
  notes: string;
};

const STORAGE_KEY = "sanaa-contacts";

const CONTACT_ROLES = ["Collector", "Curator", "Gallery", "Artist", "Art Advisor", "Institution", "Other"] as const;

// Contacts live on the account now (database, via /api/contacts), so
// they follow the artist to any browser or device. A copy saved in
// this browser before the move (localStorage "sanaa-contacts") is
// imported once, then the browser copy is cleared.
export default function ContactsTool() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [migratedCount, setMigratedCount] = useState(0);
  const migratedRef = useRef(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("Collector");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  // Local search (Nov 2026): only filters the contacts on this page —
  // name, role, email — never the rest of the site.
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visibleContacts = contacts.filter(
    (contact) =>
      needle === "" ||
      contact.name.toLowerCase().includes(needle) ||
      contact.role.toLowerCase().includes(needle) ||
      contact.email.toLowerCase().includes(needle),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/contacts");
        if (!res.ok) throw new Error("Could not load your contacts.");
        const json = (await res.json()) as { contacts?: Contact[] };
        if (cancelled) return;
        setContacts(json.contacts ?? []);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not load your contacts.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
      // One-time migration of the old browser-only copy, if any.
      if (migratedRef.current) return;
      migratedRef.current = true;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const local = JSON.parse(raw) as Contact[];
        if (!Array.isArray(local) || local.length === 0) {
          window.localStorage.removeItem(STORAGE_KEY);
          return;
        }
        let imported = 0;
        for (const item of local) {
          if (!item || typeof item.name !== "string" || !item.name.trim()) continue;
          const res = await fetch("/api/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: item.name, role: item.role, email: item.email, notes: item.notes }),
          });
          if (res.ok) {
            imported += 1;
            const created = (await res.json()) as { contact?: Contact };
            if (created.contact && !cancelled) {
              setContacts((current) => [created.contact as Contact, ...current]);
            }
          }
        }
        window.localStorage.removeItem(STORAGE_KEY);
        if (imported > 0 && !cancelled) setMigratedCount(imported);
      } catch {
        // A corrupt browser copy must not break the page; the
        // database list above is already showing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, role, email: email.trim(), notes: notes.trim() }),
      });
      const json = (await res.json()) as { contact?: Contact; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save this contact.");
      if (json.contact) setContacts((current) => [json.contact as Contact, ...current]);
      setName("");
      setEmail("");
      setNotes("");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save this contact.");
    } finally {
      setSaving(false);
    }
  }

  async function removeContact(id: string) {
    const previous = contacts;
    setContacts((current) => current.filter((contact) => contact.id !== id));
    try {
      const res = await fetch(`/api/contacts/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete this contact.");
    } catch {
      setContacts(previous);
    }
  }

  return (
    <div>
      <form className={styles.contactForm} onSubmit={addContact}>
        <label className={styles.field}>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Who is it?" required />
        </label>
        <label className={styles.field}>
          <span>Role</span>
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            {CONTACT_ROLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className={styles.field}>
          <span>Notes</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Met at… interested in…" />
        </label>
        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? "Saving…" : "Add contact"}
        </button>
      </form>
      {saveError && (
        <p role="alert" className={styles.resultNote}>
          {saveError}
        </p>
      )}
      {migratedCount > 0 && (
        <p role="status" className={styles.resultNote}>
          {migratedCount} {migratedCount === 1 ? "contact" : "contacts"} moved from this browser into your account.
        </p>
      )}

      {!loaded ? (
        <div className={styles.emptyBox}>
          <strong>Loading your contacts…</strong>
        </div>
      ) : loadError ? (
        <div className={styles.emptyBox}>
          <strong>Could not load your contacts.</strong>
          <p>{loadError}</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No contacts yet.</strong>
          <p>Add the people around your work: collectors, curators, galleries, advisors.</p>
        </div>
      ) : (
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              maxWidth: 420,
              marginBottom: 16,
              padding: "9px 12px",
              border: "1px solid var(--line)",
              borderRadius: 8,
            }}
          >
            <Search size={16} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, role or email…"
              aria-label="Search contacts"
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                color: "inherit",
                fontSize: 14,
                width: "100%",
              }}
            />
          </label>
          {visibleContacts.length === 0 ? (
            <div className={styles.emptyBox}>
              <strong>No contacts match.</strong>
              <p>Try a different search, or clear it to see everyone.</p>
            </div>
          ) : (
        <div className={styles.tableScroll}>
          <table className={styles.inventoryTable}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Notes</th>
              <th aria-label="Delete" />
            </tr>
          </thead>
          <tbody>
            {visibleContacts.map((contact) => (
              <tr key={contact.id}>
                <td>{contact.name}</td>
                <td>{contact.role}</td>
                <td>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : "N/A"}</td>
                <td>{contact.notes || "N/A"}</td>
                <td>
                  <button
                    className={styles.iconButton}
                    onClick={() => void removeContact(contact.id)}
                    aria-label={`Delete ${contact.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
          )}
        </div>
      )}
      <p className={styles.resultNote}>Saved to your account. They sync to every browser and device you sign in with.</p>
    </div>
  );
}
