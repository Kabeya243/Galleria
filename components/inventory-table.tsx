"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useState } from "react";
import styles from "@/components/tools.module.css";

// Inventory table with a local search (Nov 2026): the search only
// filters the rows on this page — title, medium, exhibition — it never
// searches the rest of the site. Every page has its own search.
export type InventoryArtwork = {
  id: string;
  title: string;
  medium: string;
  dimensions: string;
  year: string;
  exhibition: { id: string; title: string; status: string };
};

export default function InventoryTable({ artworks }: { artworks: InventoryArtwork[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = artworks.filter((artwork) =>
    needle === "" ||
    artwork.title.toLowerCase().includes(needle) ||
    artwork.medium.toLowerCase().includes(needle) ||
    artwork.exhibition.title.toLowerCase().includes(needle),
  );

  return (
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
          placeholder="Search by title, medium or exhibition…"
          aria-label="Search inventory"
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
      {visible.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No artworks match.</strong>
          <p>Try a different search, or clear it to see everything.</p>
        </div>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.inventoryTable}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Medium</th>
                <th>Dimensions</th>
                <th>Year</th>
                <th>Exhibition</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((artwork) => (
                <tr key={artwork.id}>
                  <td>
                    <Link href={`/editor/${artwork.exhibition.id}`}>{artwork.title}</Link>
                  </td>
                  <td>{artwork.medium}</td>
                  <td>{artwork.dimensions}</td>
                  <td>{artwork.year}</td>
                  <td>{artwork.exhibition.title}</td>
                  <td>{artwork.exhibition.status === "public" ? "Published" : "Draft"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
