"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

// Presentation Designer — build a professional art presentation (portfolio,
// gallery proposal, art-fair application, exhibition proposal) from the
// signed-in user's own artworks, preview it slide by slide, save it via
// /api/saved-work (kind "presentation"), and export it: real print-to-PDF
// (window.print() + a print stylesheet, one A4 landscape page per slide)
// plus a JSON download for backup.
//
// Design: the existing white-gallery luxury language only — white paper,
// near-black ink, discrete gold accent, Fraunces + DM Sans. No new palette,
// no new fonts. Component styles live in the <style> block at the bottom
// of this file so globals.css stays untouched.

export type PresentationArtwork = {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  color: string;
  accent: string;
  imageUrl: string | null;
  exhibitionTitle: string;
};

type SlideLayout = "title" | "full-bleed" | "art-left" | "art-right" | "two-art" | "text";

const LAYOUTS: { id: SlideLayout; label: string }[] = [
  { id: "title", label: "Title slide" },
  { id: "full-bleed", label: "Full-bleed artwork" },
  { id: "art-left", label: "Artwork left, text right" },
  { id: "art-right", label: "Artwork right, text left" },
  { id: "two-art", label: "Two artworks side by side" },
  { id: "text", label: "Text only" },
];

type PresType = "portfolio" | "gallery-proposal" | "art-fair" | "exhibition-proposal";

const PRES_TYPES: { id: PresType; label: string }[] = [
  { id: "portfolio", label: "Artist portfolio" },
  { id: "gallery-proposal", label: "Gallery proposal" },
  { id: "art-fair", label: "Art-fair application" },
  { id: "exhibition-proposal", label: "Exhibition proposal" },
];

type Slide = {
  id: string;
  layout: SlideLayout;
  artworkId: string;
  artworkId2: string;
  heading: string;
  text: string;
  capTitle: string;
  capYear: string;
  capMedium: string;
  capDims: string;
  capTitle2: string;
  capYear2: string;
  capMedium2: string;
  capDims2: string;
};

type Deck = {
  title: string;
  artistName: string;
  type: PresType;
  coverArtworkId: string;
  bio: string;
  curatorialText: string;
  projectDescription: string;
  exhibitionOverview: string;
  slides: Slide[];
};

type SavedPresentation = {
  id: string;
  title: string;
  data: Record<string, unknown>;
  updatedAt: string;
};

let uidCounter = 0;
function uid(): string {
  uidCounter += 1;
  return `slide-${Date.now().toString(36)}-${uidCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptySlide(layout: SlideLayout = "art-left"): Slide {
  return {
    id: uid(),
    layout,
    artworkId: "",
    artworkId2: "",
    heading: "",
    text: "",
    capTitle: "",
    capYear: "",
    capMedium: "",
    capDims: "",
    capTitle2: "",
    capYear2: "",
    capMedium2: "",
    capDims2: "",
  };
}

function captionFrom(art: PresentationArtwork | undefined): Pick<Slide, "capTitle" | "capYear" | "capMedium" | "capDims"> {
  return {
    capTitle: art?.title ?? "",
    capYear: art?.year ?? "",
    capMedium: art?.medium ?? "",
    capDims: art?.dimensions ?? "",
  };
}

function defaultDeck(userName: string, artworks: PresentationArtwork[]): Deck {
  return {
    title: "Untitled presentation",
    artistName: userName,
    type: "portfolio",
    coverArtworkId: artworks[0]?.id ?? "",
    bio: "",
    curatorialText: "",
    projectDescription: "",
    exhibitionOverview: "",
    slides: [
      { ...emptySlide("title"), heading: "Untitled presentation", text: userName },
      { ...emptySlide("text"), heading: `About ${userName}`, text: "" },
    ],
  };
}

function deckFromSaved(data: Record<string, unknown>, userName: string, artworks: PresentationArtwork[]): Deck {
  const base = defaultDeck(userName, artworks);
  const d = data as Partial<Deck>;
  const slides = Array.isArray(d.slides)
    ? (d.slides as Partial<Slide>[])
        .filter((s) => s && typeof s === "object")
        .map((s) => ({
          ...emptySlide((LAYOUTS.some((l) => l.id === s.layout) ? s.layout : "art-left") as SlideLayout),
          ...s,
          id: typeof s.id === "string" && s.id ? s.id : uid(),
        }))
    : base.slides;
  return {
    ...base,
    ...d,
    type: PRES_TYPES.some((t) => t.id === d.type) ? (d.type as PresType) : base.type,
    slides: slides.length > 0 ? slides : base.slides,
  };
}

function captionLine(slide: Slide, second = false): string {
  const title = second ? slide.capTitle2 : slide.capTitle;
  const year = second ? slide.capYear2 : slide.capYear;
  const medium = second ? slide.capMedium2 : slide.capMedium;
  const dims = second ? slide.capDims2 : slide.capDims;
  return [title, year, medium, dims].filter(Boolean).join(" · ");
}

// --- Slide artwork visual ---------------------------------------------------

function ArtworkVisual({ art, label }: { art: PresentationArtwork | undefined; label: string }) {
  if (art?.imageUrl) {
    // Plain <img>: the image is a user upload (R2 / DB blob URL), not a
    // Next-optimised asset, and it must also render inside window.print().
    return <img src={art.imageUrl} alt={art.title || label} className="pd-art-img" />;
  }
  return (
    <div className="pd-art-fallback" style={{ backgroundColor: art?.color ?? "#b8a184" }}>
      <span style={{ backgroundColor: art?.accent ?? "#343e36" }} />
      <strong>{art?.title ?? label}</strong>
    </div>
  );
}

// --- One slide, rendered the same in the live preview and in print --------

function SlideView({ slide, deck, artworks }: { slide: Slide; deck: Deck; artworks: PresentationArtwork[] }) {
  const art = artworks.find((a) => a.id === slide.artworkId);
  const art2 = artworks.find((a) => a.id === slide.artworkId2);
  const cover = artworks.find((a) => a.id === deck.coverArtworkId);
  const typeLabel = PRES_TYPES.find((t) => t.id === deck.type)?.label ?? "";

  if (slide.layout === "title") {
    return (
      <div className="pd-slide pd-slide-title">
        <p className="pd-slide-kicker">{typeLabel}</p>
        <h2>{slide.heading || deck.title}</h2>
        <p className="pd-slide-artist">{slide.text || deck.artistName}</p>
        {cover ? (
          <div className="pd-slide-cover">
            <ArtworkVisual art={cover} label="Cover artwork" />
          </div>
        ) : null}
      </div>
    );
  }

  if (slide.layout === "text") {
    return (
      <div className="pd-slide pd-slide-text">
        {slide.heading ? <h2>{slide.heading}</h2> : null}
        {slide.text ? <p>{slide.text}</p> : <p className="pd-slide-empty">Add your text in the editor.</p>}
      </div>
    );
  }

  if (slide.layout === "full-bleed") {
    return (
      <div className="pd-slide pd-slide-full">
        <div className="pd-slide-full-art">
          <ArtworkVisual art={art} label="Choose an artwork" />
        </div>
        <div className="pd-slide-captionbar">
          <strong>{captionLine(slide) || "Choose an artwork for this slide."}</strong>
          {slide.text ? <span>{slide.text}</span> : null}
        </div>
      </div>
    );
  }

  if (slide.layout === "two-art") {
    return (
      <div className="pd-slide pd-slide-two">
        {slide.heading ? <h3>{slide.heading}</h3> : null}
        <div className="pd-slide-two-grid">
          <figure>
            <ArtworkVisual art={art} label="Choose a first artwork" />
            <figcaption>{captionLine(slide) || "First artwork"}</figcaption>
          </figure>
          <figure>
            <ArtworkVisual art={art2} label="Choose a second artwork" />
            <figcaption>{captionLine(slide, true) || "Second artwork"}</figcaption>
          </figure>
        </div>
        {slide.text ? <p className="pd-slide-note">{slide.text}</p> : null}
      </div>
    );
  }

  // art-left / art-right
  const artFirst = slide.layout === "art-left";
  return (
    <div className={`pd-slide pd-slide-split ${artFirst ? "pd-split-left" : "pd-split-right"}`}>
      <div className="pd-slide-split-art">
        <ArtworkVisual art={art} label="Choose an artwork" />
      </div>
      <div className="pd-slide-split-text">
        {slide.heading ? <h3>{slide.heading}</h3> : null}
        {slide.text ? <p>{slide.text}</p> : null}
        <p className="pd-slide-caption">
          <strong>{slide.capTitle || art?.title || "Choose an artwork"}</strong>
          {[slide.capYear || art?.year, slide.capMedium || art?.medium, slide.capDims || art?.dimensions]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}

// --- Component --------------------------------------------------------------

export default function PresentationDesigner({
  artworks,
  userName,
}: {
  artworks: PresentationArtwork[];
  userName: string;
}) {
  const [deck, setDeck] = useState<Deck>(() => defaultDeck(userName, artworks));
  const [current, setCurrent] = useState(0);
  const [saved, setSaved] = useState<SavedPresentation[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const deckRef = useRef(deck);
  deckRef.current = deck;

  const refreshSaved = useCallback(async () => {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const res = await fetch("/api/saved-work?kind=presentation");
      if (!res.ok) throw new Error("Could not load your saved presentations.");
      const json = (await res.json()) as { saved: SavedPresentation[] };
      setSaved(json.saved ?? []);
    } catch (err) {
      setSavedError(err instanceof Error ? err.message : "Could not load your saved presentations.");
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  const updateDeck = useCallback((patch: Partial<Deck>) => {
    setDeck((d) => ({ ...d, ...patch }));
  }, []);

  const updateSlide = useCallback((id: string, patch: Partial<Slide>) => {
    setDeck((d) => ({ ...d, slides: d.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }, []);

  const pickArtwork = useCallback(
    (id: string, artworkId: string, second = false) => {
      const art = artworks.find((a) => a.id === artworkId);
      if (!art) {
        updateSlide(id, second ? { artworkId2: "" } : { artworkId: "" });
        return;
      }
      if (second) {
        const c = captionFrom(art);
        updateSlide(id, {
          artworkId2: artworkId,
          capTitle2: c.capTitle,
          capYear2: c.capYear,
          capMedium2: c.capMedium,
          capDims2: c.capDims,
        });
      } else {
        const c = captionFrom(art);
        updateSlide(id, {
          artworkId,
          capTitle: c.capTitle,
          capYear: c.capYear,
          capMedium: c.capMedium,
          capDims: c.capDims,
        });
      }
    },
    [artworks, updateSlide],
  );

  const moveSlide = useCallback((index: number, dir: -1 | 1) => {
    setDeck((d) => {
      const next = [...d.slides];
      const target = index + dir;
      if (target < 0 || target >= next.length) return d;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...d, slides: next };
    });
    setCurrent((c) => Math.max(0, Math.min(deckRef.current.slides.length - 1, c + dir)));
  }, []);

  const addSlide = useCallback(
    (layout: SlideLayout) => {
      const slide = emptySlide(layout);
      if ((layout === "art-left" || layout === "art-right" || layout === "full-bleed" || layout === "two-art") && artworks[0]) {
        slide.artworkId = artworks[0].id;
        Object.assign(slide, captionFrom(artworks[0]));
      }
      setDeck((d) => ({ ...d, slides: [...d.slides, slide] }));
      setCurrent(deckRef.current.slides.length);
    },
    [artworks],
  );

  const duplicateSlide = useCallback((index: number) => {
    setDeck((d) => {
      const copy = { ...d.slides[index], id: uid() };
      const next = [...d.slides];
      next.splice(index + 1, 0, copy);
      return { ...d, slides: next };
    });
    setCurrent(index + 1);
  }, []);

  const removeSlide = useCallback((index: number) => {
    setDeck((d) => {
      if (d.slides.length <= 1) return d;
      return { ...d, slides: d.slides.filter((_, i) => i !== index) };
    });
    setCurrent((c) => Math.max(0, Math.min(deckRef.current.slides.length - 2, c - (c > index ? 1 : 0))));
  }, []);

  const addTextSlideFromBlock = useCallback(
    (heading: string, text: string) => {
      if (!text.trim()) return;
      const slide = { ...emptySlide("text"), heading, text: text.trim() };
      setDeck((d) => ({ ...d, slides: [...d.slides, slide] }));
      setCurrent(deckRef.current.slides.length);
      setSaveMsg(`Added “${heading}” as a slide.`);
    },
    [],
  );

  // --- Save / load ----------------------------------------------------------
  const doSave = useCallback(async () => {
    const title = saveTitle.trim() || deckRef.current.title.trim() || "Untitled presentation";
    setSaving(true);
    setSaveMsg(null);
    try {
      if (loadedId) {
        const res = await fetch("/api/saved-work", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: loadedId, title, data: deckRef.current }),
        });
        if (!res.ok) throw new Error("Could not update this presentation.");
        setSaveMsg(`Updated “${title}”.`);
      } else {
        const res = await fetch("/api/saved-work", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "presentation", title, data: deckRef.current }),
        });
        if (!res.ok) throw new Error("Could not save this presentation.");
        const json = (await res.json()) as { saved: SavedPresentation };
        setLoadedId(json.saved.id);
        setSaveMsg(`Saved “${title}”.`);
      }
      setSaveTitle("");
      await refreshSaved();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Could not save this presentation.");
    } finally {
      setSaving(false);
    }
  }, [saveTitle, loadedId, refreshSaved]);

  const doLoad = useCallback(
    (row: SavedPresentation) => {
      const next = deckFromSaved(row.data, userName, artworks);
      setDeck(next);
      setCurrent(0);
      setLoadedId(row.id);
      setSaveTitle(row.title);
      setSaveMsg(`Loaded “${row.title}”.`);
    },
    [userName, artworks],
  );

  const doRename = useCallback(
    async (id: string) => {
      const title = renameValue.trim();
      if (!title) return;
      try {
        const res = await fetch("/api/saved-work", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, title }),
        });
        if (!res.ok) throw new Error("Could not rename this presentation.");
        setRenamingId(null);
        await refreshSaved();
      } catch {
        setSaveMsg("Could not rename this presentation.");
      }
    },
    [renameValue, refreshSaved],
  );

  const doDelete = useCallback(
    async (id: string, title: string) => {
      if (!window.confirm(`Delete the saved presentation “${title}”?`)) return;
      try {
        const res = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Could not delete this presentation.");
        if (loadedId === id) setLoadedId(null);
        await refreshSaved();
        setSaveMsg(`Deleted “${title}”.`);
      } catch {
        setSaveMsg("Could not delete this presentation.");
      }
    },
    [loadedId, refreshSaved],
  );

  const newDeck = useCallback(() => {
    setDeck(defaultDeck(userName, artworks));
    setCurrent(0);
    setLoadedId(null);
    setSaveTitle("");
    setSaveMsg("Started a new presentation.");
  }, [userName, artworks]);

  // --- Export ---------------------------------------------------------------
  const exportJson = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(deckRef.current, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(deckRef.current.title || "presentation").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg("JSON backup downloaded.");
    } catch {
      setExportMsg("Could not download the JSON backup.");
    }
  }, []);

  const printDeck = useCallback(() => {
    setExportMsg("In the print dialog, choose “Save as PDF”, A4, landscape, and turn off headers and footers.");
    window.print();
  }, []);

  const slide = deck.slides[Math.min(current, deck.slides.length - 1)];
  const slideLabel = useMemo(
    () => (s: Slide) => {
      const layout = LAYOUTS.find((l) => l.id === s.layout)?.label ?? s.layout;
      const art = artworks.find((a) => a.id === s.artworkId);
      const title = s.layout === "title" ? s.heading || deck.title : s.heading || art?.title || layout;
      return { layout, title };
    },
    [artworks, deck.title],
  );

  const contentBlocks: { key: "bio" | "curatorialText" | "projectDescription" | "exhibitionOverview"; label: string; hint: string }[] = [
    { key: "bio", label: "Artist biography", hint: "Who you are, where you work, what your work is about." },
    { key: "curatorialText", label: "Curatorial text", hint: "The idea that holds the works together." },
    { key: "projectDescription", label: "Project description", hint: "What you propose to make, show or do — and why now." },
    { key: "exhibitionOverview", label: "Exhibition overview", hint: "How the show hangs together: rooms, sequence, scale." },
  ];

  return (
    <>
      <div className="pd-screen">
        {artworks.length === 0 ? (
          <div className="pd-empty">
            <strong>No artworks yet.</strong>
            <p>
              A presentation needs your works. Open an exhibition in the editor and add your first artwork — it will
              show up here as soon as you save it.
            </p>
            <Link href="/exhibitions" className="galleries-open-button">
              Go to your exhibitions
            </Link>
            <p className="pd-empty-note">You can still draft title and text slides below while you wait.</p>
          </div>
        ) : null}

        {/* Presentation setup */}
        <section className="pd-section" aria-label="Presentation setup">
          <h2>1 · Presentation setup</h2>
          <div className="pd-grid pd-grid-setup">
            <label className="pd-field">
              <span>Presentation title</span>
              <input value={deck.title} onChange={(e) => updateDeck({ title: e.target.value })} placeholder="e.g. Already Enough As We Are" />
            </label>
            <label className="pd-field">
              <span>Artist name</span>
              <input value={deck.artistName} onChange={(e) => updateDeck({ artistName: e.target.value })} />
            </label>
            <label className="pd-field">
              <span>Presentation type</span>
              <select value={deck.type} onChange={(e) => updateDeck({ type: e.target.value as PresType })}>
                {PRES_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="pd-field">
              <span>Cover artwork</span>
              <select
                value={deck.coverArtworkId}
                onChange={(e) => updateDeck({ coverArtworkId: e.target.value })}
                disabled={artworks.length === 0}
              >
                <option value="">No cover artwork</option>
                {artworks.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                    {a.year ? ` (${a.year})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* Slides */}
        <section className="pd-section" aria-label="Slides">
          <h2>
            2 · Slides <span className="pd-count">{deck.slides.length}</span>
          </h2>
          <div className="pd-builder">
            <ol className="pd-slide-list">
              {deck.slides.map((s, i) => {
                const { layout, title } = slideLabel(s);
                return (
                  <li key={s.id} className={i === current ? "pd-slide-item pd-slide-item-active" : "pd-slide-item"}>
                    <button type="button" onClick={() => setCurrent(i)} className="pd-slide-item-main">
                      <span className="pd-slide-num">{i + 1}</span>
                      <span>
                        <strong>{title}</strong>
                        <small>{layout}</small>
                      </span>
                    </button>
                    <span className="pd-slide-item-actions">
                      <button type="button" title="Move up" aria-label={`Move slide ${i + 1} up`} disabled={i === 0} onClick={() => moveSlide(i, -1)}>
                        ↑
                      </button>
                      <button type="button" title="Move down" aria-label={`Move slide ${i + 1} down`} disabled={i === deck.slides.length - 1} onClick={() => moveSlide(i, 1)}>
                        ↓
                      </button>
                      <button type="button" title="Duplicate" aria-label={`Duplicate slide ${i + 1}`} onClick={() => duplicateSlide(i)}>
                        ⧉
                      </button>
                      <button type="button" title="Remove" aria-label={`Remove slide ${i + 1}`} disabled={deck.slides.length <= 1} onClick={() => removeSlide(i)}>
                        ×
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="pd-add-row">
              <span>Add a slide:</span>
              {LAYOUTS.map((l) => (
                <button key={l.id} type="button" className="pd-chip" onClick={() => addSlide(l.id)}>
                  + {l.label}
                </button>
              ))}
            </div>

            {/* Selected slide editor */}
            {slide ? (
              <div className="pd-slide-editor">
                <div className="pd-grid">
                  <label className="pd-field">
                    <span>Layout</span>
                    <select value={slide.layout} onChange={(e) => updateSlide(slide.id, { layout: e.target.value as SlideLayout })}>
                      {LAYOUTS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {slide.layout !== "text" && slide.layout !== "title" ? (
                    <label className="pd-field">
                      <span>{slide.layout === "two-art" ? "First artwork" : "Artwork"}</span>
                      <select value={slide.artworkId} onChange={(e) => pickArtwork(slide.id, e.target.value)} disabled={artworks.length === 0}>
                        <option value="">Choose an artwork…</option>
                        {artworks.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.title}
                            {a.year ? ` (${a.year})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {slide.layout === "two-art" ? (
                    <label className="pd-field">
                      <span>Second artwork</span>
                      <select value={slide.artworkId2} onChange={(e) => pickArtwork(slide.id, e.target.value, true)} disabled={artworks.length === 0}>
                        <option value="">Choose an artwork…</option>
                        {artworks.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.title}
                            {a.year ? ` (${a.year})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="pd-field">
                    <span>{slide.layout === "title" ? "Title on the slide" : "Heading"}</span>
                    <input
                      value={slide.heading}
                      onChange={(e) => updateSlide(slide.id, { heading: e.target.value })}
                      placeholder={slide.layout === "title" ? deck.title : "e.g. The work"}
                    />
                  </label>
                </div>

                {slide.layout !== "title" && slide.layout !== "text" ? (
                  <div className="pd-grid">
                    <label className="pd-field">
                      <span>Caption — title</span>
                      <input value={slide.capTitle} onChange={(e) => updateSlide(slide.id, { capTitle: e.target.value })} placeholder="Artwork title" />
                    </label>
                    <label className="pd-field">
                      <span>Caption — year</span>
                      <input value={slide.capYear} onChange={(e) => updateSlide(slide.id, { capYear: e.target.value })} placeholder="2026" />
                    </label>
                    <label className="pd-field">
                      <span>Caption — medium</span>
                      <input value={slide.capMedium} onChange={(e) => updateSlide(slide.id, { capMedium: e.target.value })} placeholder="Charcoal on paper" />
                    </label>
                    <label className="pd-field">
                      <span>Caption — dimensions</span>
                      <input value={slide.capDims} onChange={(e) => updateSlide(slide.id, { capDims: e.target.value })} placeholder="130 × 94 cm" />
                    </label>
                  </div>
                ) : null}
                {slide.layout === "two-art" ? (
                  <div className="pd-grid">
                    <label className="pd-field">
                      <span>Second caption — title</span>
                      <input value={slide.capTitle2} onChange={(e) => updateSlide(slide.id, { capTitle2: e.target.value })} placeholder="Artwork title" />
                    </label>
                    <label className="pd-field">
                      <span>Second caption — year</span>
                      <input value={slide.capYear2} onChange={(e) => updateSlide(slide.id, { capYear2: e.target.value })} placeholder="2026" />
                    </label>
                    <label className="pd-field">
                      <span>Second caption — medium</span>
                      <input value={slide.capMedium2} onChange={(e) => updateSlide(slide.id, { capMedium2: e.target.value })} placeholder="Charcoal on paper" />
                    </label>
                    <label className="pd-field">
                      <span>Second caption — dimensions</span>
                      <input value={slide.capDims2} onChange={(e) => updateSlide(slide.id, { capDims2: e.target.value })} placeholder="130 × 94 cm" />
                    </label>
                  </div>
                ) : null}

                <label className="pd-field pd-field-full">
                  <span>{slide.layout === "title" ? "Name under the title" : slide.layout === "text" ? "Text" : "Text on this slide"}</span>
                  <textarea
                    rows={slide.layout === "text" ? 6 : 3}
                    value={slide.text}
                    onChange={(e) => updateSlide(slide.id, { text: e.target.value })}
                    placeholder={
                      slide.layout === "title"
                        ? deck.artistName
                        : slide.layout === "text"
                          ? "Write the text for this slide…"
                          : "A short note to sit beside the work (optional)."
                    }
                  />
                </label>
                <p className="pd-hint">Captions are filled in automatically from the artwork you pick — edit them here if the record needs a correction for this presentation only.</p>
              </div>
            ) : null}
          </div>
        </section>

        {/* Content blocks */}
        <section className="pd-section" aria-label="Content">
          <h2>3 · Content</h2>
          <p className="pd-section-intro">
            These texts live with the presentation. Add any of them as a text slide when it belongs in the deck.
          </p>
          <div className="pd-blocks">
            {contentBlocks.map((b) => (
              <div key={b.key} className="pd-block">
                <label className="pd-field pd-field-full">
                  <span>{b.label}</span>
                  <textarea
                    rows={4}
                    value={deck[b.key]}
                    onChange={(e) => updateDeck({ [b.key]: e.target.value })}
                    placeholder={b.hint}
                  />
                </label>
                <button type="button" className="pd-chip" disabled={!deck[b.key].trim()} onClick={() => addTextSlideFromBlock(b.label, deck[b.key])}>
                  + Add as a slide
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Live preview */}
        <section className="pd-section" aria-label="Preview">
          <h2>4 · Preview</h2>
          <div className="pd-preview">
            <div className="pd-preview-nav">
              <button type="button" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>
                ← Previous
              </button>
              <span>
                Slide {current + 1} of {deck.slides.length}
              </span>
              <button type="button" onClick={() => setCurrent((c) => Math.min(deck.slides.length - 1, c + 1))} disabled={current >= deck.slides.length - 1}>
                Next →
              </button>
            </div>
            <div className="pd-preview-stage">
              {slide ? <SlideView slide={slide} deck={deck} artworks={artworks} /> : null}
            </div>
            <div className="pd-preview-dots" role="tablist" aria-label="Slides">
              {deck.slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={i === current}
                  aria-label={`Go to slide ${i + 1}`}
                  className={i === current ? "pd-dot pd-dot-active" : "pd-dot"}
                  onClick={() => setCurrent(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Save / load / export */}
        <section className="pd-section" aria-label="Save and export">
          <h2>5 · Save &amp; export</h2>
          <div className="pd-save-row">
            <label className="pd-field pd-field-grow">
              <span>Save this presentation as</span>
              <input
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder={deck.title || "Untitled presentation"}
              />
            </label>
            <button type="button" className="galleries-open-button" onClick={() => void doSave()} disabled={saving}>
              {saving ? "Saving…" : loadedId ? "Update saved presentation" : "Save presentation"}
            </button>
            <button type="button" className="pd-secondary-button" onClick={newDeck}>
              New presentation
            </button>
          </div>
          {saveMsg ? <p className="pd-msg">{saveMsg}</p> : null}

          <div className="pd-export-row">
            <button type="button" className="galleries-open-button" onClick={printDeck}>
              Download PDF
            </button>
            <button type="button" className="pd-secondary-button" onClick={exportJson}>
              Export as JSON (backup)
            </button>
          </div>
          <p className="pd-hint">
            “Download PDF” opens your browser’s print dialog — choose <strong>Save as PDF</strong>, paper size{" "}
            <strong>A4</strong>, orientation <strong>landscape</strong>, and turn off headers and footers. Each slide
            prints as one page.
          </p>
          {exportMsg ? <p className="pd-msg">{exportMsg}</p> : null}

          <h3 className="pd-subhead">Your saved presentations</h3>
          {savedLoading ? (
            <p className="pd-hint">Loading your saved presentations…</p>
          ) : savedError ? (
            <p className="pd-error">
              {savedError} <button type="button" className="pd-link-button" onClick={() => void refreshSaved()}>Try again</button>
            </p>
          ) : saved.length === 0 ? (
            <p className="pd-hint">Nothing saved yet — save this deck above and it will appear here.</p>
          ) : (
            <ul className="pd-saved-list">
              {saved.map((row) => (
                <li key={row.id}>
                  {renamingId === row.id ? (
                    <span className="pd-rename">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void doRename(row.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        autoFocus
                      />
                      <button type="button" className="pd-chip" onClick={() => void doRename(row.id)}>
                        Save name
                      </button>
                      <button type="button" className="pd-link-button" onClick={() => setRenamingId(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <>
                      <button type="button" className="pd-saved-title" onClick={() => doLoad(row)}>
                        {row.title}
                      </button>
                      <span className="pd-saved-meta">
                        {new Date(row.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                      <button
                        type="button"
                        className="pd-link-button"
                        onClick={() => {
                          setRenamingId(row.id);
                          setRenameValue(row.title);
                        }}
                      >
                        Rename
                      </button>
                      <button type="button" className="pd-link-button pd-danger" onClick={() => void doDelete(row.id, row.title)}>
                        Delete
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Print-only deck: one A4 landscape page per slide. Hidden on screen. */}
      <div className="pd-print" aria-hidden="true">
        {deck.slides.map((s, i) => (
          <div key={s.id} className="pd-print-page">
            <SlideView slide={s} deck={deck} artworks={artworks} />
            <p className="pd-print-footer">
              {deck.artistName} — {deck.title} · {i + 1} / {deck.slides.length}
            </p>
          </div>
        ))}
      </div>

      <style>{PRINT_AND_COMPONENT_CSS}</style>
    </>
  );
}

const PRINT_AND_COMPONENT_CSS = `
.pd-screen { display: flex; flex-direction: column; gap: 36px; }
.pd-section h2 { margin: 0 0 16px; font-size: 22px; }
.pd-section h2 .pd-count { color: var(--muted); font-size: 14px; font-weight: 400; }
.pd-section-intro { margin: -8px 0 16px; color: var(--muted); font-size: 13px; line-height: 1.6; }
.pd-subhead { margin: 28px 0 12px; font-size: 16px; }
.pd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.pd-grid-setup { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.pd-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 600; color: var(--muted); }
.pd-field-full { grid-column: 1 / -1; }
.pd-field-grow { flex: 1; min-width: 220px; }
.pd-field input, .pd-field select, .pd-field textarea { padding: 9px 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font: inherit; font-size: 14px; font-weight: 400; outline: none; resize: vertical; }
.pd-field input:focus, .pd-field select:focus, .pd-field textarea:focus { border-color: var(--ink); }
.pd-hint { margin: 12px 0 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.pd-msg { margin: 10px 0 0; color: var(--ink); font-size: 13px; }
.pd-error { color: #9b2c2c; font-size: 13px; }
.pd-empty { padding: 28px; border: 1px dashed var(--line); border-radius: 8px; text-align: center; }
.pd-empty strong { display: block; margin-bottom: 6px; font-size: 15px; }
.pd-empty p { margin: 0 0 16px; color: var(--muted); }
.pd-empty-note { margin: 16px 0 0 !important; font-size: 12px; }
.pd-secondary-button { display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--ink); font-size: 11px; font-weight: 600; cursor: pointer; }
.pd-secondary-button:hover { border-color: var(--ink); }
.pd-link-button { padding: 0; border: 0; background: none; color: var(--muted); font: inherit; font-size: 12px; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.pd-link-button:hover { color: var(--ink); }
.pd-danger:hover { color: #9b2c2c; }
.pd-chip { padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--paper); color: var(--ink); font-size: 12px; font-weight: 600; cursor: pointer; }
.pd-chip:hover:not(:disabled) { border-color: var(--ink); }
.pd-chip:disabled { opacity: .45; cursor: default; }

/* Slide list + builder */
.pd-builder { display: flex; flex-direction: column; gap: 16px; }
.pd-slide-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.pd-slide-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); }
.pd-slide-item-active { border-color: var(--ink); }
.pd-slide-item-main { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; padding: 0; border: 0; background: none; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.pd-slide-item-main span:last-child { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.pd-slide-item-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.pd-slide-item-main small { color: var(--muted); font-size: 11px; }
.pd-slide-num { display: grid; place-items: center; width: 26px; height: 26px; flex: none; border: 1px solid var(--line); border-radius: 50%; font-size: 12px; font-weight: 700; }
.pd-slide-item-actions { display: flex; gap: 2px; }
.pd-slide-item-actions button { width: 28px; height: 28px; border: 0; border-radius: 50%; background: transparent; color: var(--muted); font-size: 14px; cursor: pointer; }
.pd-slide-item-actions button:hover:not(:disabled) { background: var(--line); color: var(--ink); }
.pd-slide-item-actions button:disabled { opacity: .3; cursor: default; }
.pd-add-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px; color: var(--muted); }
.pd-slide-editor { padding: 18px; border: 1px solid var(--line); border-radius: 8px; background: var(--room-color, transparent); display: flex; flex-direction: column; gap: 16px; }

/* Content blocks */
.pd-blocks { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.pd-block { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; padding: 18px; border: 1px solid var(--line); border-radius: 8px; }
.pd-block .pd-field { width: 100%; }

/* Preview — the slide scales with its container (cqw units) */
.pd-preview { display: flex; flex-direction: column; gap: 12px; }
.pd-preview-nav { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; }
.pd-preview-nav button { padding: 8px 14px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--ink); font-size: 12px; font-weight: 600; cursor: pointer; }
.pd-preview-nav button:disabled { opacity: .4; cursor: default; }
.pd-preview-stage { width: 100%; max-width: 860px; margin: 0 auto; }
.pd-preview-dots { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.pd-dot { width: 28px; height: 28px; border: 1px solid var(--line); border-radius: 50%; background: var(--paper); color: var(--muted); font-size: 11px; cursor: pointer; }
.pd-dot-active { border-color: var(--ink); background: var(--ink); color: var(--paper); }

/* The slide itself — shared by preview and print */
.pd-slide { container-type: inline-size; position: relative; display: flex; flex-direction: column; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; padding: 4.5cqw 5cqw; border: 1px solid var(--line); border-radius: 4px; background: #fff; color: #1a1a1a; }
.pd-slide h2 { margin: 0; font-family: "Fraunces", serif; font-size: 5.2cqw; font-weight: 600; line-height: 1.1; }
.pd-slide h3 { margin: 0 0 2cqw; font-family: "Fraunces", serif; font-size: 3.4cqw; font-weight: 600; line-height: 1.2; }
.pd-slide p { margin: 0; font-size: 1.9cqw; line-height: 1.65; }
.pd-slide-kicker { margin: 0 0 1.5cqw; color: #a67c37; font-size: 1.5cqw; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
.pd-slide-artist { margin-top: 1.5cqw; color: #666; font-size: 2.4cqw; }
.pd-slide-title { align-items: center; justify-content: center; text-align: center; }
.pd-slide-cover { margin-top: 3cqw; width: 46%; max-height: 42%; min-height: 0; overflow: hidden; }
.pd-slide-text { justify-content: center; gap: 2cqw; }
.pd-slide-text p { max-width: 72ch; white-space: pre-wrap; }
.pd-slide-empty { color: #999; font-style: italic; }
.pd-slide-full { padding: 0; }
.pd-slide-full-art { flex: 1; min-height: 0; }
.pd-slide-captionbar { display: flex; flex-direction: column; gap: .4cqw; padding: 1.8cqw 5cqw; border-top: 1px solid #eceae4; }
.pd-slide-captionbar strong { font-size: 1.8cqw; font-weight: 600; }
.pd-slide-captionbar span { color: #666; font-size: 1.6cqw; line-height: 1.5; }
.pd-slide-split { flex-direction: row; align-items: stretch; gap: 4cqw; }
.pd-split-right { flex-direction: row-reverse; }
.pd-slide-split-art { flex: 1 1 55%; min-width: 0; min-height: 0; }
.pd-slide-split-text { flex: 1 1 45%; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1.6cqw; }
.pd-slide-split-text p { white-space: pre-wrap; }
.pd-slide-caption { color: #666; font-size: 1.6cqw; line-height: 1.5; }
.pd-slide-caption strong { display: block; color: #1a1a1a; font-size: 1.8cqw; }
.pd-slide-two { gap: 2cqw; }
.pd-slide-two-grid { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 3cqw; }
.pd-slide-two figure { margin: 0; min-height: 0; display: flex; flex-direction: column; gap: 1cqw; }
.pd-slide-two figure > :first-child { flex: 1; min-height: 0; }
.pd-slide-two figcaption { color: #666; font-size: 1.5cqw; line-height: 1.4; }
.pd-slide-note { color: #444; white-space: pre-wrap; }
.pd-art-img { display: block; width: 100%; height: 100%; object-fit: contain; background: #f4f2ee; }
.pd-art-fallback { position: relative; display: grid; place-items: center; width: 100%; height: 100%; min-height: 120px; overflow: hidden; }
.pd-art-fallback span { position: absolute; inset: 22%; opacity: .9; }
.pd-art-fallback strong { position: relative; padding: 0 12px; color: #fff; font-family: "Fraunces", serif; font-size: 2cqw; font-weight: 600; text-align: center; }

/* Save / export */
.pd-save-row { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; }
.pd-export-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
.pd-saved-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.pd-saved-list li { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 0; border-bottom: 1px solid var(--line); }
.pd-saved-title { padding: 0; border: 0; background: none; color: var(--ink); font: inherit; font-size: 14px; font-weight: 600; text-align: left; cursor: pointer; }
.pd-saved-title:hover { text-decoration: underline; text-underline-offset: 2px; }
.pd-saved-meta { color: var(--muted); font-size: 12px; }
.pd-rename { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.pd-rename input { height: 36px; padding: 0 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font-size: 14px; }

/* Print-only deck */
.pd-print { display: none; }
.pd-print-page { break-after: page; page-break-after: always; }
.pd-print-footer { display: none; }

@media (max-width: 760px) {
  .pd-grid { grid-template-columns: 1fr; }
  .pd-blocks { grid-template-columns: 1fr; }
  .pd-slide-list { gap: 6px; }
}

@media print {
  @page { size: A4 landscape; margin: 0; }
  body { background: #fff !important; }
  .pd-screen, .sidebar, .topbar, .welcome-row { display: none !important; }
  .dashboard-main, .dashboard-content { padding: 0 !important; margin: 0 !important; max-width: none !important; }
  .app-shell { display: block !important; }
  .pd-print { display: block; }
  .pd-print-page { display: flex; flex-direction: column; width: 297mm; height: 210mm; padding: 0; overflow: hidden; }
  .pd-print-page:last-child { break-after: auto; page-break-after: auto; }
  .pd-print-page .pd-slide { flex: 1; min-height: 0; border: 0; border-radius: 0; aspect-ratio: auto; }
  .pd-print-footer { display: block; margin: 0; padding: 2mm 8mm; border-top: 1px solid #eceae4; color: #999; font-size: 8pt; }
}
`;
