"use client";

import { useEffect, useState } from "react";

// Sub-admins management, manager only (the admin page renders this
// section only for the manager; the API routes check again server-side).
// The manager adds a sub-admin by the email of an existing account and
// picks which admin sections they may open. Granting the same email
// again replaces the permission list. Revoking removes admin access
// immediately — the account itself is untouched.
type SubAdminRow = {
  id: string;
  user: { id: string; name: string; email: string; role: string | null };
  grantedBy: { name: string; email: string };
  permissions: string[];
  createdAt: string;
};

type PermissionOption = { key: string; label: string };

const btnBase: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--ad-border)",
  background: "transparent",
  color: "var(--ad-ink)",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "var(--ad-btn-bg)",
  borderColor: "transparent",
  color: "var(--ad-btn-ink)",
};

const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: "var(--ad-down)",
  borderColor: "transparent",
  color: "#ffffff",
};

export default function SubAdmins() {
  const [rows, setRows] = useState<SubAdminRow[]>([]);
  const [options, setOptions] = useState<PermissionOption[]>([]);
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/sub-admins");
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.subAdmins ?? []);
      setOptions(data.permissions ?? []);
    } catch {
      // The section stays usable with the form alone; a reload retries.
    }
  }

  useEffect(() => {
    load();
  }, []);

  function togglePermission(key: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const address = email.trim().toLowerCase();
    if (!address) {
      setError("Enter the email of the account to make a sub-admin.");
      return;
    }
    if (picked.size === 0) {
      setError("Pick at least one permission.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sub-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address, permissions: [...picked] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save the sub-admin.");
        return;
      }
      setNotice(`${data.subAdmin.user.name} (${data.subAdmin.user.email}) is now a sub-admin.`);
      setEmail("");
      setPicked(new Set());
      await load();
    } catch {
      setError("Could not save the sub-admin. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    setNotice(null);
    setRevoking(id);
    try {
      const res = await fetch(`/api/admin/sub-admins/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not revoke the sub-admin.");
        return;
      }
      setNotice("Sub-admin access revoked.");
      setConfirming(null);
      await load();
    } catch {
      setError("Could not revoke the sub-admin. Try again.");
    } finally {
      setRevoking(null);
    }
  }

  const labelFor = (key: string) =>
    options.find((option) => option.key === key)?.label ?? key;

  return (
    <div className="ad-card">
      <div className="ad-card-head">
        <div>
          <h2>Add a sub-admin</h2>
          <p className="ad-card-sub">
            Give a signed-up account limited access to this dashboard. They sign in with their own
            account and only see the sections you pick here.
          </p>
        </div>
      </div>
      <form onSubmit={save} style={{ display: "grid", gap: 12 }}>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="Email of the account, for example assistant@lakisa.art"
          aria-label="Email of the sub-admin account"
          style={{
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid var(--ad-border)",
            background: "var(--ad-card)",
            color: "var(--ad-ink)",
            fontSize: 13,
            width: "100%",
            maxWidth: 420,
          }}
        />
        <fieldset
          style={{
            border: "1px solid var(--ad-border)",
            borderRadius: 8,
            padding: "10px 12px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "8px 16px",
            margin: 0,
          }}
        >
          <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--ad-muted)" }}>
            Sections they may open
          </legend>
          {options.map((option) => (
            <label
              key={option.key}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={picked.has(option.key)}
                onChange={() => togglePermission(option.key)}
              />
              {option.label}
              {option.key === "galleries.manage" ? " (can hide and rename)" : ""}
            </label>
          ))}
          {options.length === 0 ? (
            <span style={{ fontSize: 13, color: "var(--ad-muted)" }}>Loading permissions…</span>
          ) : null}
        </fieldset>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" style={btnPrimary} disabled={busy}>
            {busy ? "Saving…" : "Save sub-admin"}
          </button>
          {error ? (
            <span role="alert" style={{ fontSize: 13, color: "var(--ad-down)" }}>
              {error}
            </span>
          ) : null}
          {notice ? (
            <span role="status" style={{ fontSize: 13, color: "var(--ad-up, #2f7d4f)" }}>
              {notice}
            </span>
          ) : null}
        </div>
      </form>

      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>
          Sub-admins ({rows.length})
        </h3>
        {rows.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ad-muted)", margin: 0 }}>
            No sub-admins yet. Only you, the manager, can open this dashboard.
          </p>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Sections</th>
                  <th>Added by</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.user.name}</td>
                    <td>{row.user.email}</td>
                    <td>{row.permissions.map(labelFor).join(", ")}</td>
                    <td>{row.grantedBy.name}</td>
                    <td>{new Date(row.createdAt).toLocaleDateString("en-GB")}</td>
                    <td>
                      {confirming === row.id ? (
                        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button
                            type="button"
                            style={btnDanger}
                            disabled={revoking === row.id}
                            onClick={() => revoke(row.id)}
                          >
                            {revoking === row.id ? "Revoking…" : "Confirm revoke"}
                          </button>
                          <button type="button" style={btnBase} onClick={() => setConfirming(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button type="button" style={btnBase} onClick={() => setConfirming(row.id)}>
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
