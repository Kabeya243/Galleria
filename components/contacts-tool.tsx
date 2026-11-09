"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
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

// Contacts live in this browser only (localStorage) — no account or server
// involved. Enough to keep collectors, curators, galleries and advisors in
// one place while a shared CRM is a later step.
export default function ContactsTool() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("Collector");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setContacts(JSON.parse(raw) as Contact[]);
    } catch {
      // A corrupt local copy must not break the page.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
    } catch {
      // Storage full or unavailable — the list still works for this visit.
    }
  }, [contacts, loaded]);

  function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setContacts((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmed,
        role,
        email: email.trim(),
        notes: notes.trim(),
      },
      ...current,
    ]);
    setName("");
    setEmail("");
    setNotes("");
  }

  function removeContact(id: string) {
    setContacts((current) => current.filter((contact) => contact.id !== id));
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
        <button type="submit" className="primary-button">
          Add contact
        </button>
      </form>

      {contacts.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No contacts yet.</strong>
          <p>Add the people around your work: collectors, curators, galleries, advisors.</p>
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
            {contacts.map((contact) => (
              <tr key={contact.id}>
                <td>{contact.name}</td>
                <td>{contact.role}</td>
                <td>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : "N/A"}</td>
                <td>{contact.notes || "N/A"}</td>
                <td>
                  <button
                    className={styles.iconButton}
                    onClick={() => removeContact(contact.id)}
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
      <p className={styles.resultNote}>Saved in this browser only. They do not sync to your account yet.</p>
    </div>
  );
}
