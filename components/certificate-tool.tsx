"use client";

import { useState } from "react";
import styles from "./tools.module.css";

export type CertificateArtwork = {
  id: string;
  title: string;
  medium: string;
  dimensions: string;
  year: string;
};

// Certificate of authenticity: pick one of your works and print a simple,
// honest certificate — title, artist, medium, dimensions, year, edition
// 1/1, date and a signature line. The browser's print dialog does the rest.
export default function CertificateTool({
  artistName,
  artworks,
}: {
  artistName: string;
  artworks: CertificateArtwork[];
}) {
  const [selectedId, setSelectedId] = useState(artworks[0]?.id ?? "");
  const selected = artworks.find((artwork) => artwork.id === selectedId) ?? artworks[0];
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  if (!selected) {
    return (
      <div className={styles.emptyBox}>
        <strong>No artworks yet.</strong>
        <p>Add a work in the editor first — a certificate needs a real piece behind it.</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.certificateControls}>
        <label className={styles.field}>
          <span>Artwork</span>
          <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
            {artworks.map((artwork) => (
              <option key={artwork.id} value={artwork.id}>
                {artwork.title} ({artwork.year})
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="primary-button" onClick={() => window.print()}>
          Print certificate
        </button>
      </div>

      <div className={styles.certificate}>
        <p className={styles.certificateKicker}>CERTIFICATE OF AUTHENTICITY</p>
        <h2>{selected.title}</h2>
        <p className={styles.certificateArtist}>{artistName}</p>
        <dl className={styles.certificateDetails}>
          <div>
            <dt>Medium</dt>
            <dd>{selected.medium}</dd>
          </div>
          <div>
            <dt>Dimensions</dt>
            <dd>{selected.dimensions}</dd>
          </div>
          <div>
            <dt>Year</dt>
            <dd>{selected.year}</dd>
          </div>
          <div>
            <dt>Edition</dt>
            <dd>1 / 1 — unique work</dd>
          </div>
        </dl>
        <p className={styles.certificateText}>
          This document certifies that the work described above is an original work by {artistName}.
        </p>
        <div className={styles.certificateSign}>
          <div>
            <span className={styles.signatureLine} />
            <p>Artist</p>
          </div>
          <div>
            <span className={styles.signatureLine} />
            <p>Date — {today}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
