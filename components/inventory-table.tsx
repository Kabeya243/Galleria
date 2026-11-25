"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useState } from "react";
import page from "./redesign-pages.module.css";
import dash from "./redesign-dashboard.module.css";

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
    <div className={page.sectionStack}>
      <label className={page.searchField}>
        <Search size={16} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, medium or exhibition…"
          aria-label="Search inventory"
        />
      </label>
      {visible.length === 0 ? (
        <section className={`${dash.card} ${page.emptyState}`}>
          <h3>No artworks match.</h3>
          <p>Try a different search, or clear it to see everything.</p>
        </section>
      ) : (
        <section className={dash.card}>
          <div className={page.tableWrap}>
            <table className={page.table}>
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
                      <Link href={`/editor/${artwork.exhibition.id}`} style={{ color: "var(--rd-text)", fontWeight: 700, textDecoration: "none" }}>
                        {artwork.title}
                      </Link>
                    </td>
                    <td>{artwork.medium}</td>
                    <td>{artwork.dimensions}</td>
                    <td>{artwork.year}</td>
                    <td>{artwork.exhibition.title}</td>
                    <td>
                      <span className={`${page.pill} ${artwork.exhibition.status === "public" ? page.pillLive : page.pillDraft}`}>
                        {artwork.exhibition.status === "public" ? "Published" : "Draft"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
