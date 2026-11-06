"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { FRAME_VARIANTS, type FrameVariant } from "@/lib/demo-data";
import FrameThumbnail from "@/components/frame-thumbnail";

// Art in Context — one guided workflow across the whole SANAA journey.
// The wizard holds a "context-project" (SavedWork kind "context-project")
// that points at the real Artwork and Exhibition rows; every step reads
// and writes those same rows, so the artwork is never uploaded twice and
// no step works on a disconnected copy. Step status is computed from
// real state (saved frames, saved photo-edits / palettes / mockups,
// exhibition status), never from a checkbox the user ticks by hand.

export type WizardArtwork = {
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
  frame: string;
  exhibitionId: string;
  exhibitionTitle: string;
};

export type WizardExhibition = {
  id: string;
  title: string;
  slug: string;
  status: string;
  description: string;
  roomNames: string[];
  artworks: { id: string; title: string; imageUrl: string | null }[];
};

type RawProject = { id: string; title: string; data: Record<string, unknown>; updatedAt: string };

type ArrangementLayout = "diptych" | "triptych" | "grid" | "salon";

type ProjectData = {
  artworkIds: string[];
  exhibitionId: string | null;
  photoFinal: Record<string, boolean>;
  palette: { artworkId: string; colors: string[]; wallColors: string[] } | null;
  arrangement: { layout: ArrangementLayout; artworkIds: string[]; spacing: number; wallColor: string } | null;
  exhibitionDetails: {
    title: string;
    statement: string;
    artists: string;
    lighting: string;
    tourText: string;
    visitorInfo: string;
    labels: Record<string, string>;
  };
  promotion: { poster: boolean; video: boolean; catalogue: boolean };
  mockupIds: string[];
};

type SavedRow = {
  id: string;
  title: string;
  data: Record<string, unknown>;
  artworkId: string | null;
  updatedAt: string;
};

const STEPS = [
  { n: 1, key: "upload", label: "Upload", hint: "Pick or upload the work" },
  { n: 2, key: "photography", label: "Photography", hint: "Clean the photo" },
  { n: 3, key: "colour", label: "Colour", hint: "Read the palette" },
  { n: 4, key: "frames", label: "Frames", hint: "Choose the frame" },
  { n: 5, key: "mockups", label: "Mockups", hint: "Hang it in a room" },
  { n: 6, key: "composition", label: "Composition", hint: "Arrange the set" },
  { n: 7, key: "gallery", label: "3D Gallery", hint: "Place it in the room" },
  { n: 8, key: "exhibition", label: "Exhibition", hint: "Write the show" },
  { n: 9, key: "publication", label: "Publication", hint: "Publish & share" },
  { n: 10, key: "promotion", label: "Export & Promotion", hint: "Catalogue, poster, video" },
] as const;

type StepStatus = "done" | "in-progress" | "not-started";

const GOLD = "#a67c37";
const INK = "#141414";

function emptyProjectData(): ProjectData {
  return {
    artworkIds: [],
    exhibitionId: null,
    photoFinal: {},
    palette: null,
    arrangement: null,
    exhibitionDetails: { title: "", statement: "", artists: "", lighting: "", tourText: "", visitorInfo: "", labels: {} },
    promotion: { poster: false, video: false, catalogue: false },
    mockupIds: [],
  };
}

function parseProjectData(raw: Record<string, unknown>): ProjectData {
  const base = emptyProjectData();
  const r = raw ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  if (Array.isArray(r.artworkIds)) base.artworkIds = strArr(r.artworkIds);
  if (typeof r.exhibitionId === "string") base.exhibitionId = r.exhibitionId;
  if (r.photoFinal && typeof r.photoFinal === "object") {
    for (const [k, v] of Object.entries(r.photoFinal as Record<string, unknown>)) if (v === true) base.photoFinal[k] = true;
  }
  if (r.palette && typeof r.palette === "object") {
    const p = r.palette as Record<string, unknown>;
    if (typeof p.artworkId === "string") {
      base.palette = { artworkId: p.artworkId, colors: strArr(p.colors), wallColors: strArr(p.wallColors) };
    }
  }
  if (r.arrangement && typeof r.arrangement === "object") {
    const a = r.arrangement as Record<string, unknown>;
    const layout = str(a.layout);
    if (layout === "diptych" || layout === "triptych" || layout === "grid" || layout === "salon") {
      base.arrangement = {
        layout,
        artworkIds: strArr(a.artworkIds),
        spacing: typeof a.spacing === "number" ? a.spacing : 24,
        wallColor: str(a.wallColor) || "#f5f2eb",
      };
    }
  }
  if (r.exhibitionDetails && typeof r.exhibitionDetails === "object") {
    const d = r.exhibitionDetails as Record<string, unknown>;
    const labels: Record<string, string> = {};
    if (d.labels && typeof d.labels === "object") {
      for (const [k, v] of Object.entries(d.labels as Record<string, unknown>)) if (typeof v === "string") labels[k] = v;
    }
    base.exhibitionDetails = {
      title: str(d.title),
      statement: str(d.statement),
      artists: str(d.artists),
      lighting: str(d.lighting),
      tourText: str(d.tourText),
      visitorInfo: str(d.visitorInfo),
      labels,
    };
  }
  if (r.promotion && typeof r.promotion === "object") {
    const p = r.promotion as Record<string, unknown>;
    base.promotion = { poster: p.poster === true, video: p.video === true, catalogue: p.catalogue === true };
  }
  if (Array.isArray(r.mockupIds)) base.mockupIds = strArr(r.mockupIds);
  return base;
}

function mixWithWhite(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#f5f2eb";
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * amount));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

async function fetchSaved(kind: string): Promise<SavedRow[]> {
  try {
    const res = await fetch(`/api/saved-work?kind=${encodeURIComponent(kind)}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { saved?: SavedRow[] };
    return json.saved ?? [];
  } catch {
    return [];
  }
}

function paletteColorsOf(row: SavedRow): string[] {
  const d = row.data ?? {};
  const direct = Array.isArray(d.colors)
    ? (d.colors as unknown[]).map((c) => (c && typeof c === "object" && typeof (c as { hex?: unknown }).hex === "string" ? (c as { hex: string }).hex : typeof c === "string" ? c : "")).filter(Boolean)
    : [];
  if (direct.length > 0) return direct;
  if (Array.isArray(d.palette)) return (d.palette as unknown[]).filter((x): x is string => typeof x === "string");
  return [];
}

const btnPrimary: React.CSSProperties = {
  background: INK,
  color: "#fdfdfc",
  border: `1px solid ${INK}`,
  borderRadius: 2,
  padding: "10px 18px",
  fontSize: 14,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: INK,
  border: `1px solid #d8d2c4`,
  borderRadius: 2,
  padding: "10px 18px",
  fontSize: 14,
  cursor: "pointer",
};
const btnGold: React.CSSProperties = {
  background: GOLD,
  color: "#fff",
  border: `1px solid ${GOLD}`,
  borderRadius: 2,
  padding: "10px 18px",
  fontSize: 14,
  cursor: "pointer",
};
const cardStyle: React.CSSProperties = {
  background: "#fdfdfc",
  border: "1px solid #e8e2d4",
  borderRadius: 2,
  padding: 20,
};
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b6558", marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d8d2c4",
  borderRadius: 2,
  background: "#fff",
  padding: "9px 10px",
  fontSize: 14,
  color: INK,
  fontFamily: "inherit",
};

export default function ArtInContext({
  userName,
  artworks: initialArtworks,
  exhibitions: initialExhibitions,
  initialProjects,
}: {
  userName: string;
  artworks: WizardArtwork[];
  exhibitions: WizardExhibition[];
  initialProjects: RawProject[];
}) {
  const [artworks, setArtworks] = useState<WizardArtwork[]>(initialArtworks);
  const [exhibitions, setExhibitions] = useState<WizardExhibition[]>(initialExhibitions);
  const [projects, setProjects] = useState<RawProject[]>(initialProjects);
  const [activeId, setActiveId] = useState<string | null>(initialProjects[0]?.id ?? null);
  const [data, setData] = useState<ProjectData>(() =>
    initialProjects[0] ? parseProjectData(initialProjects[0].data) : emptyProjectData(),
  );
  const [newTitle, setNewTitle] = useState("");
  const [step, setStep] = useState(1);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Saved work from the neighbouring tools — the real state steps
  // 2, 3, 5 and 10 read (photo-edits, palettes, mockups, presentations,
  // marketing assets, video projects, exhibition plans).
  const [photoEdits, setPhotoEdits] = useState<SavedRow[]>([]);
  const [palettes, setPalettes] = useState<SavedRow[]>([]);
  const [mockups, setMockups] = useState<SavedRow[]>([]);
  const [presentations, setPresentations] = useState<SavedRow[]>([]);
  const [marketingAssets, setMarketingAssets] = useState<SavedRow[]>([]);
  const [videoProjects, setVideoProjects] = useState<SavedRow[]>([]);
  const [plans, setPlans] = useState<SavedRow[]>([]);
  const [linkedLoading, setLinkedLoading] = useState(true);

  const activeProject = projects.find((p) => p.id === activeId) ?? null;
  const dataRef = useRef(data);
  dataRef.current = data;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const refreshLinked = useCallback(async () => {
    setLinkedLoading(true);
    const [pe, pa, mo, pr, ma, vi, pl] = await Promise.all([
      fetchSaved("photo-edit"),
      fetchSaved("palette"),
      fetchSaved("mockup"),
      fetchSaved("presentation"),
      fetchSaved("marketing-asset"),
      fetchSaved("video-project"),
      fetchSaved("exhibition-plan"),
    ]);
    setPhotoEdits(pe);
    setPalettes(pa);
    setMockups(mo);
    setPresentations(pr);
    setMarketingAssets(ma);
    setVideoProjects(vi);
    setPlans(pl);
    setLinkedLoading(false);
  }, []);

  useEffect(() => {
    void refreshLinked();
  }, [refreshLinked]);

  // ---- project CRUD (SavedWork kind "context-project") ------------------
  const persist = useCallback(async (next: ProjectData, id: string | null) => {
    if (!id) return;
    setSaveState("saving");
    try {
      const res = await fetch("/api/saved-work", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, data: next }),
      });
      if (!res.ok) throw new Error("save");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, []);

  const updateData = useCallback(
    (patch: Partial<ProjectData> | ((d: ProjectData) => ProjectData)) => {
      const next = typeof patch === "function" ? patch(dataRef.current) : { ...dataRef.current, ...patch };
      setData(next);
      void persist(next, activeIdRef.current);
    },
    [persist],
  );

  async function createProject() {
    const title = newTitle.trim() || `Context project ${projects.length + 1}`;
    setBusy("create-project");
    try {
      const res = await fetch("/api/saved-work", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "context-project", title, data: emptyProjectData() }),
      });
      if (!res.ok) throw new Error("create");
      const json = (await res.json()) as { saved: RawProject };
      const row: RawProject = { id: json.saved.id, title: json.saved.title, data: json.saved.data as Record<string, unknown>, updatedAt: String(json.saved.updatedAt) };
      setProjects((prev) => [row, ...prev]);
      setActiveId(row.id);
      setData(emptyProjectData());
      setStep(1);
      setNewTitle("");
      setNotice(`Project “${title}” created.`);
    } catch {
      setNotice("Could not create the project. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function openProject(id: string) {
    const row = projects.find((p) => p.id === id);
    if (!row) return;
    setActiveId(id);
    setData(parseProjectData(row.data));
    setStep(1);
    setNotice(null);
  }

  async function deleteProject(id: string) {
    setBusy("delete-project");
    try {
      const res = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete");
      const rest = projects.filter((p) => p.id !== id);
      setProjects(rest);
      setConfirmDeleteId(null);
      if (id === activeId) {
        setActiveId(rest[0]?.id ?? null);
        setData(rest[0] ? parseProjectData(rest[0].data) : emptyProjectData());
      }
      setNotice("Project deleted.");
    } catch {
      setNotice("Could not delete the project.");
    } finally {
      setBusy(null);
    }
  }

  // ---- derived real state ------------------------------------------------
  const selectedArtworks = useMemo(
    () => data.artworkIds.map((id) => artworks.find((a) => a.id === id)).filter((a): a is WizardArtwork => !!a),
    [data.artworkIds, artworks],
  );
  const primary = selectedArtworks[0] ?? null;
  const exhibition = useMemo(
    () => exhibitions.find((e) => e.id === data.exhibitionId) ?? null,
    [data.exhibitionId, exhibitions],
  );
  const placedInExhibition = useMemo(() => {
    if (!exhibition) return new Map<string, boolean>();
    const placed = new Map<string, boolean>();
    for (const art of selectedArtworks) {
      const direct = exhibition.artworks.some((a) => a.id === art.id);
      const copy = exhibition.artworks.some((a) => a.id !== art.id && a.title === art.title && a.imageUrl === art.imageUrl);
      placed.set(art.id, direct || copy);
    }
    return placed;
  }, [exhibition, selectedArtworks]);

  const photoEditFor = useCallback((artworkId: string) => photoEdits.some((r) => r.artworkId === artworkId), [photoEdits]);
  const paletteFor = useCallback((artworkId: string) => palettes.find((r) => r.artworkId === artworkId) ?? null, [palettes]);
  const mockupsFor = useCallback(
    (artworkId: string) => mockups.filter((r) => r.artworkId === artworkId || (typeof r.data.artworkIds !== "undefined" && Array.isArray(r.data.artworkIds) && (r.data.artworkIds as unknown[]).includes(artworkId))),
    [mockups],
  );

  const statuses = useMemo((): StepStatus[] => {
    const s: StepStatus[] = Array(10).fill("not-started") as StepStatus[];
    const hasWorks = selectedArtworks.length > 0;
    s[0] = hasWorks ? "done" : "not-started";
    if (primary) {
      const photoDone = photoEditFor(primary.id) || data.photoFinal[primary.id] === true;
      s[1] = photoDone ? "done" : hasWorks ? "in-progress" : "not-started";
      const paletteDone = (data.palette?.artworkId === primary.id && data.palette.colors.length > 0) || paletteFor(primary.id) !== null;
      s[2] = paletteDone ? "done" : hasWorks ? "in-progress" : "not-started";
      s[3] = primary.frame && primary.frame !== "wood" ? "done" : hasWorks ? "in-progress" : "not-started";
      const mockDone = data.mockupIds.length > 0 || selectedArtworks.some((a) => mockupsFor(a.id).length > 0);
      s[4] = mockDone ? "done" : hasWorks ? "in-progress" : "not-started";
    }
    s[5] = data.arrangement && data.arrangement.artworkIds.length >= 2 ? "done" : hasWorks ? "in-progress" : "not-started";
    if (exhibition) {
      const placedCount = selectedArtworks.filter((a) => placedInExhibition.get(a.id)).length;
      s[6] = placedCount > 0 ? "done" : hasWorks ? "in-progress" : "not-started";
      const titled = exhibition.title.trim() !== "" && exhibition.title !== "Untitled exhibition";
      s[7] = titled && exhibition.description.trim() !== "" ? "done" : "in-progress";
      s[8] = exhibition.status === "public" ? "done" : "in-progress";
    } else if (hasWorks) {
      s[6] = "in-progress";
      s[7] = "not-started";
      s[8] = "not-started";
    }
    if (exhibition) {
      const catalogue = data.promotion.catalogue || presentations.some((r) => String(r.data.exhibitionId ?? "") === exhibition.id || selectedArtworks.some((a) => r.artworkId === a.id));
      const poster = data.promotion.poster || marketingAssets.some((r) => String(r.data.exhibitionId ?? "") === exhibition.id);
      const video = data.promotion.video || videoProjects.some((r) => String((r.data as Record<string, unknown>).exhibitionId ?? "") === exhibition.id);
      s[9] = catalogue && poster && video ? "done" : catalogue || poster || video ? "in-progress" : "not-started";
    }
    return s;
  }, [selectedArtworks, primary, data, exhibition, placedInExhibition, photoEditFor, paletteFor, mockupsFor, presentations, marketingAssets, videoProjects]);

  const doneCount = statuses.filter((s) => s === "done").length;
  const pct = Math.round((doneCount / 10) * 100);

  // ---- shared helpers ----------------------------------------------------
  async function patchArtwork(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/artworks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? "Could not save the artwork.");
    }
    return (await res.json()) as { artwork?: WizardArtwork };
  }

  function artById(id: string) {
    return artworks.find((a) => a.id === id) ?? null;
  }

  const statusBadge = (s: StepStatus) =>
    s === "done" ? (
      <span style={{ color: "#2e6b34", fontSize: 12, fontWeight: 600 }}>✓ Done</span>
    ) : s === "in-progress" ? (
      <span style={{ color: GOLD, fontSize: 12, fontWeight: 600 }}>● In progress</span>
    ) : (
      <span style={{ color: "#8a8474", fontSize: 12 }}>○ Not started</span>
    );

  const stepHeader = (n: number, title: string, blurb: string) => (
    <div style={{ marginBottom: 16 }}>
      <p className="eyebrow">
        <span className="status-dot" /> STEP {n} OF 10 · {statusBadge(statuses[n - 1])}
      </p>
      <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 26, margin: "4px 0" }}>{title}</h2>
      <p style={{ color: "#5b554a", margin: 0, maxWidth: 720 }}>{blurb}</p>
    </div>
  );

  const navRow = (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 28 }}>
      <button type="button" style={{ ...btnGhost, visibility: step > 1 ? "visible" : "hidden" }} onClick={() => setStep(step - 1)}>
        ← Back
      </button>
      {step < 10 ? (
        <button type="button" style={btnPrimary} onClick={() => setStep(step + 1)}>
          Next step →
        </button>
      ) : (
        <span style={{ color: "#6b6558", fontSize: 13, alignSelf: "center" }}>
          {doneCount} of 10 steps done — {pct}%
        </span>
      )}
    </div>
  );

  // ============================ render ====================================
  return (
    <div>
      {/* ---- project bar ---- */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
          <div style={{ flex: "1 1 220px" }}>
            <label style={labelStyle} htmlFor="aic-project">Context project</label>
            <select
              id="aic-project"
              style={inputStyle}
              value={activeId ?? ""}
              onChange={(e) => openProject(e.target.value)}
            >
              {projects.length === 0 && <option value="">No project yet — create one</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <label style={labelStyle} htmlFor="aic-new-title">New project name</label>
            <input
              id="aic-new-title"
              style={inputStyle}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Dakar series — from studio to show"
            />
          </div>
          <button type="button" style={btnPrimary} disabled={busy === "create-project"} onClick={createProject}>
            {busy === "create-project" ? "Creating…" : "New project"}
          </button>
          {activeProject && (
            <button
              type="button"
              style={btnGhost}
              disabled={busy === "delete-project"}
              onClick={() => {
                if (confirmDeleteId === activeProject.id) void deleteProject(activeProject.id);
                else {
                  setConfirmDeleteId(activeProject.id);
                  window.setTimeout(() => setConfirmDeleteId((c) => (c === activeProject.id ? null : c)), 4000);
                }
              }}
            >
              {confirmDeleteId === activeProject.id ? "Click again to delete" : "Delete project"}
            </button>
          )}
          <span style={{ fontSize: 13, color: "#6b6558", marginLeft: "auto" }}>
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "All changes saved ✓" : saveState === "error" ? "Save failed — changes are kept in this tab" : ""}
          </span>
        </div>
        {notice && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#5b554a" }}>{notice}</p>}
        {!activeProject && (
          <p style={{ margin: "12px 0 0", fontSize: 14 }}>
            Create a project to begin — it holds the artworks, the exhibition and every step&apos;s state, and you can come back to it any time.
          </p>
        )}
      </div>

      {activeProject && (
        <>
          {/* ---- progress + stepper ---- */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <strong style={{ fontFamily: "Fraunces, serif", fontSize: 18 }}>
                {activeProject.title}
              </strong>
              <span style={{ fontSize: 13, color: "#6b6558" }}>
                For {userName} · {doneCount} of 10 steps done · {pct}%
              </span>
            </div>
            <div style={{ height: 6, background: "#ece7da", borderRadius: 3, marginTop: 10, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: GOLD, transition: "width 300ms" }} />
            </div>
            <ol style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
              {STEPS.map((s) => {
                const st = statuses[s.n - 1];
                const active = step === s.n;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => setStep(s.n)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: active ? "#141414" : "#fff",
                        color: active ? "#fdfdfc" : INK,
                        border: `1px solid ${active ? INK : "#e8e2d4"}`,
                        borderRadius: 2,
                        padding: "10px 12px",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ display: "block", fontSize: 12, color: active ? "#c9a35c" : GOLD, fontWeight: 700 }}>
                        {s.n}. {st === "done" ? "✓ " : st === "in-progress" ? "● " : "○ "}{s.label}
                      </span>
                      <span style={{ display: "block", fontSize: 11, opacity: 0.75, marginTop: 2 }}>{s.hint}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* ---- step panels ---- */}
          {step === 1 && <StepUpload />}
          {step === 2 && <StepPhotography />}
          {step === 3 && <StepColour />}
          {step === 4 && <StepFrames />}
          {step === 5 && <StepMockups />}
          {step === 6 && <StepComposition />}
          {step === 7 && <StepGallery />}
          {step === 8 && <StepExhibition />}
          {step === 9 && <StepPublication />}
          {step === 10 && <StepPromotion />}
          {navRow}
        </>
      )}
    </div>
  );

  // ============================ STEP 1 — Upload ===========================
  function StepUpload() {
    const [edit, setEdit] = useState<Record<string, string> | null>(null);
    const [editMsg, setEditMsg] = useState<string | null>(null);
    const [uploadExhibitionId, setUploadExhibitionId] = useState(exhibitions[0]?.id ?? "");
    const [uploadTitle, setUploadTitle] = useState("");
    const [uploadBusy, setUploadBusy] = useState(false);
    const [uploadMsg, setUploadMsg] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);

    const toggleSelect = (id: string) => {
      const next = data.artworkIds.includes(id) ? data.artworkIds.filter((x) => x !== id) : [...data.artworkIds, id];
      updateData({ artworkIds: next });
    };

    const startEdit = (art: WizardArtwork) =>
      setEdit({ id: art.id, title: art.title, artist: art.artist, year: art.year, medium: art.medium, dimensions: art.dimensions, description: art.description });

    const saveEdit = async () => {
      if (!edit) return;
      setEditMsg(null);
      try {
        const { artwork } = await patchArtwork(edit.id, {
          title: edit.title,
          artist: edit.artist,
          year: edit.year,
          medium: edit.medium,
          dimensions: edit.dimensions,
          description: edit.description,
        });
        if (artwork) setArtworks((prev) => prev.map((a) => (a.id === artwork.id ? { ...a, ...artwork } : a)));
        setEditMsg("Saved to the artwork record ✓");
        setEdit(null);
      } catch (err) {
        setEditMsg(err instanceof Error ? err.message : "Could not save.");
      }
    };

    const uploadNew = async (file: File | undefined) => {
      if (!file) return;
      if (!uploadExhibitionId) {
        setUploadMsg("Pick an exhibition to hang the new work in first.");
        return;
      }
      setUploadBusy(true);
      setUploadMsg(null);
      try {
        const form = new FormData();
        form.append("file", file);
        const up = await fetch("/api/uploads", { method: "POST", body: form });
        if (!up.ok) {
          const j = (await up.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Upload failed.");
        }
        const { url } = (await up.json()) as { url: string };
        const title = uploadTitle.trim() || file.name.replace(/\.[^.]+$/, "");
        const created = await fetch("/api/artworks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ exhibitionId: uploadExhibitionId, title, imageUrl: url }),
        });
        if (!created.ok) throw new Error("The image uploaded, but the artwork record could not be created.");
        const { artwork } = (await created.json()) as { artwork: WizardArtwork };
        const exTitle = exhibitions.find((e) => e.id === uploadExhibitionId)?.title ?? "";
        setArtworks((prev) => [{ ...artwork, exhibitionTitle: exTitle }, ...prev]);
        setExhibitions((prev) =>
          prev.map((e) => (e.id === uploadExhibitionId ? { ...e, artworks: [{ id: artwork.id, title: artwork.title, imageUrl: artwork.imageUrl }, ...e.artworks] } : e)),
        );
        updateData({ artworkIds: [...dataRef.current.artworkIds, artwork.id] });
        setUploadTitle("");
        setUploadMsg(`“${title}” uploaded and added to the project ✓`);
      } catch (err) {
        setUploadMsg(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploadBusy(false);
      }
    };

    return (
      <div style={cardStyle}>
        {stepHeader(1, "Upload — choose the work", "Pick artworks from your library, or upload a new one. The wizard records the real artwork — title, artist, year, medium, dimensions, description and image — and every later step works on that same record.")}
        <p style={{ fontSize: 13, color: "#6b6558", marginTop: 0 }}>
          {selectedArtworks.length === 0 ? "No artwork selected yet." : `${selectedArtworks.length} artwork${selectedArtworks.length > 1 ? "s" : ""} in this project — the first one leads the journey.`}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {artworks.map((art) => {
            const selected = data.artworkIds.includes(art.id);
            return (
              <button
                key={art.id}
                type="button"
                onClick={() => toggleSelect(art.id)}
                style={{
                  textAlign: "left",
                  background: selected ? "#f7f1e3" : "#fff",
                  border: `2px solid ${selected ? GOLD : "#e8e2d4"}`,
                  borderRadius: 2,
                  padding: 0,
                  overflow: "hidden",
                  cursor: "pointer",
                }}
              >
                {art.imageUrl ? (
                  <img src={art.imageUrl} alt={art.title} style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ height: 130, background: art.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>No image</div>
                )}
                <span style={{ display: "block", padding: "8px 10px", fontSize: 13 }}>
                  <strong>{selected ? "✓ " : ""}{art.title}</strong>
                  <span style={{ display: "block", color: "#6b6558", fontSize: 12 }}>{[art.artist, art.year].filter(Boolean).join(" · ") || art.exhibitionTitle}</span>
                </span>
              </button>
            );
          })}
        </div>

        <h3 style={{ fontFamily: "Fraunces, serif", margin: "24px 0 8px" }}>Or upload a new artwork</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={labelStyle} htmlFor="aic-upload-ex">Hang it in</label>
            <select id="aic-upload-ex" style={inputStyle} value={uploadExhibitionId} onChange={(e) => setUploadExhibitionId(e.target.value)}>
              {exhibitions.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <label style={labelStyle} htmlFor="aic-upload-title">Title</label>
            <input id="aic-upload-title" style={inputStyle} value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Leave blank to use the file name" />
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { void uploadNew(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" style={btnPrimary} disabled={uploadBusy || exhibitions.length === 0} onClick={() => fileRef.current?.click()}>
            {uploadBusy ? "Uploading…" : "Choose an image…"}
          </button>
          <Link href="/exhibitions" style={{ fontSize: 13, color: GOLD }}>No exhibition yet? Create one →</Link>
        </div>
        {uploadMsg && <p style={{ fontSize: 13, marginTop: 8 }}>{uploadMsg}</p>}

        {primary && (
          <div style={{ marginTop: 28, borderTop: "1px solid #e8e2d4", paddingTop: 20 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", margin: "0 0 4px" }}>The record — {primary.title}</h3>
            <p style={{ fontSize: 13, color: "#6b6558", marginTop: 0 }}>This is the real artwork row. Edits here save straight to it, and the 3D gallery, catalogue and wall labels all read the same row.</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {primary.imageUrl && <img src={primary.imageUrl} alt={primary.title} style={{ width: 180, height: 180, objectFit: "contain", background: "#f5f2eb", border: "1px solid #e8e2d4" }} />}
              <div style={{ flex: "1 1 320px" }}>
                {edit ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div><label style={labelStyle}>Title</label><input style={inputStyle} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div><label style={labelStyle}>Artist</label><input style={inputStyle} value={edit.artist} onChange={(e) => setEdit({ ...edit, artist: e.target.value })} /></div>
                      <div><label style={labelStyle}>Year</label><input style={inputStyle} value={edit.year} onChange={(e) => setEdit({ ...edit, year: e.target.value })} /></div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div><label style={labelStyle}>Medium</label><input style={inputStyle} value={edit.medium} onChange={(e) => setEdit({ ...edit, medium: e.target.value })} /></div>
                      <div><label style={labelStyle}>Dimensions</label><input style={inputStyle} value={edit.dimensions} onChange={(e) => setEdit({ ...edit, dimensions: e.target.value })} /></div>
                    </div>
                    <div><label style={labelStyle}>Description</label><textarea style={{ ...inputStyle, minHeight: 70 }} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" style={btnGold} onClick={saveEdit}>Save to the artwork</button>
                      <button type="button" style={btnGhost} onClick={() => setEdit(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <dl style={{ margin: 0, fontSize: 14, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px" }}>
                    <dt style={{ color: "#6b6558" }}>Artist</dt><dd style={{ margin: 0 }}>{primary.artist || "—"}</dd>
                    <dt style={{ color: "#6b6558" }}>Year</dt><dd style={{ margin: 0 }}>{primary.year || "—"}</dd>
                    <dt style={{ color: "#6b6558" }}>Medium</dt><dd style={{ margin: 0 }}>{primary.medium || "—"}</dd>
                    <dt style={{ color: "#6b6558" }}>Dimensions</dt><dd style={{ margin: 0 }}>{primary.dimensions || "—"}</dd>
                    <dt style={{ color: "#6b6558" }}>Description</dt><dd style={{ margin: 0 }}>{primary.description || "—"}</dd>
                    <dt style={{ color: "#6b6558" }}>Exhibition</dt><dd style={{ margin: 0 }}>{primary.exhibitionTitle}</dd>
                  </dl>
                )}
                {!edit && (
                  <button type="button" style={{ ...btnGhost, marginTop: 14 }} onClick={() => startEdit(primary)}>
                    Edit this record
                  </button>
                )}
                {editMsg && <p style={{ fontSize: 13 }}>{editMsg}</p>}
              </div>
            </div>
            {selectedArtworks.length > 1 && (
              <p style={{ fontSize: 13, color: "#6b6558" }}>
                Also in this project: {selectedArtworks.slice(1).map((a) => a.title).join(", ")}. Select a different first artwork above to lead with it instead.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ======================= STEP 2 — Photography ===========================
  function StepPhotography() {
    if (!primary) return <div style={cardStyle}><p>No artwork selected yet — go back to step 1.</p></div>;
    const edits = photoEdits.filter((r) => r.artworkId === primary.id);
    const done = edits.length > 0 || data.photoFinal[primary.id] === true;
    return (
      <div style={cardStyle}>
        {stepHeader(2, "Photography — clean the photo", "Open the work in Photography Lab, straighten and fix the light, and save the edit. The wizard watches for a saved photo-edit on this artwork — or you can mark the original as final.")}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "start" }}>
          {primary.imageUrl && <img src={primary.imageUrl} alt={primary.title} style={{ width: 200, height: 200, objectFit: "contain", background: "#f5f2eb", border: "1px solid #e8e2d4" }} />}
          <div style={{ flex: "1 1 300px" }}>
            <p style={{ marginTop: 0 }}><strong>{primary.title}</strong> · {statusBadge(statuses[1])}</p>
            {linkedLoading ? (
              <p style={{ fontSize: 13, color: "#6b6558" }}>Checking saved photo-edits…</p>
            ) : edits.length > 0 ? (
              <ul style={{ fontSize: 13, margin: "0 0 12px", paddingLeft: 18 }}>
                {edits.map((e) => (
                  <li key={e.id}>Saved photo-edit: {e.title} <span style={{ color: "#6b6558" }}>({new Date(e.updatedAt).toLocaleDateString()})</span></li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: "#6b6558" }}>No saved photo-edit for this artwork yet.</p>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={`/tools/photography-lab?artworkId=${primary.id}`} target="_blank" rel="noreferrer" style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>
                Open in Photography Lab →
              </Link>
              <button type="button" style={btnGhost} onClick={() => void refreshLinked()}>Refresh status</button>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, fontSize: 14, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={data.photoFinal[primary.id] === true}
                onChange={(e) => updateData({ photoFinal: { ...data.photoFinal, [primary.id]: e.target.checked } })}
              />
              The original photo is final — no edit needed
            </label>
            {done && <p style={{ fontSize: 13, color: "#2e6b34" }}>Step complete: a photo-edit exists, or the original was marked final.</p>}
          </div>
        </div>
      </div>
    );
  }

  // ========================= STEP 3 — Colour ==============================
  function StepColour() {
    if (!primary) return <div style={cardStyle}><p>No artwork selected yet — go back to step 1.</p></div>;
    const savedPalette = paletteFor(primary.id);
    const stored = data.palette?.artworkId === primary.id ? data.palette : null;
    const shown = stored ?? (savedPalette ? { artworkId: primary.id, colors: paletteColorsOf(savedPalette), wallColors: [] } : null);
    const wallColors = shown ? (shown.wallColors.length > 0 ? shown.wallColors : ["#fdfdfc", "#f5f2eb", ...shown.colors.slice(0, 2).map((c) => mixWithWhite(c, 0.85))]) : [];

    const adoptPalette = (row: SavedRow) => {
      const colors = paletteColorsOf(row);
      if (colors.length === 0) return;
      updateData({ palette: { artworkId: primary.id, colors, wallColors: ["#fdfdfc", "#f5f2eb", ...colors.slice(0, 2).map((c) => mixWithWhite(c, 0.85))] } });
      setNotice(`Palette “${row.title}” stored in the project.`);
    };

    return (
      <div style={cardStyle}>
        {stepHeader(3, "Colour — read the palette", "Run Colour Intelligence on the artwork and bring its palette back here. The wizard stores the palette in the project and suggests the wall colours that let the work shine.")}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <Link href={`/tools/color-intelligence?artworkId=${primary.id}`} target="_blank" rel="noreferrer" style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>
            Open in Colour Intelligence →
          </Link>
          <button type="button" style={btnGhost} onClick={() => void refreshLinked()}>Refresh status</button>
        </div>
        {linkedLoading ? (
          <p style={{ fontSize: 13, color: "#6b6558" }}>Checking saved palettes…</p>
        ) : shown && shown.colors.length > 0 ? (
          <div>
            <p style={{ fontSize: 13, color: "#6b6558", marginTop: 0 }}>Palette for <strong>{primary.title}</strong> {statusBadge(statuses[2])}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {shown.colors.map((c) => (
                <span key={c} title={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, border: "1px solid #e8e2d4", borderRadius: 2, padding: "4px 8px", background: "#fff" }}>
                  <i style={{ width: 18, height: 18, borderRadius: "50%", background: c, display: "inline-block", border: "1px solid #d8d2c4" }} />
                  {c}
                </span>
              ))}
            </div>
            <h3 style={{ fontFamily: "Fraunces, serif", margin: "0 0 8px" }}>Suggested wall colours</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {wallColors.map((c) => (
                <span key={c} title={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, border: "1px solid #e8e2d4", borderRadius: 2, padding: "4px 8px", background: "#fff" }}>
                  <i style={{ width: 18, height: 18, borderRadius: "50%", background: c, display: "inline-block", border: "1px solid #d8d2c4" }} />
                  {c}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "#6b6558" }}>Paper white and warm gallery white first; the two palest tints come from the work&apos;s own dominant colours.</p>
          </div>
        ) : (
          <p style={{ fontSize: 14 }}>No palette stored yet. Open Colour Intelligence above, analyse <strong>{primary.title}</strong>, save the palette there — then come back and press Refresh.</p>
        )}
        {palettes.length > 0 && (
          <div style={{ marginTop: 20, borderTop: "1px solid #e8e2d4", paddingTop: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", margin: "0 0 8px" }}>Your saved palettes</h3>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {palettes.map((row) => (
                <li key={row.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    {paletteColorsOf(row).slice(0, 5).map((c) => (
                      <i key={c} style={{ width: 16, height: 16, borderRadius: "50%", background: c, display: "inline-block", border: "1px solid #d8d2c4" }} />
                    ))}
                  </span>
                  <span><strong>{row.title}</strong> <span style={{ color: "#6b6558" }}>· {artById(row.artworkId ?? "")?.title ?? "uploaded image"}</span></span>
                  {row.artworkId === primary.id && (
                    <button type="button" style={{ ...btnGhost, padding: "6px 12px" }} onClick={() => adoptPalette(row)}>
                      Store in this project
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ========================= STEP 4 — Frames ==============================
  function StepFrames() {
    const [picked, setPicked] = useState<string | null>(null);
    const [frameMsg, setFrameMsg] = useState<string | null>(null);
    const [frameBusy, setFrameBusy] = useState(false);
    if (!primary) return <div style={cardStyle}><p>No artwork selected yet — go back to step 1.</p></div>;
    const current = picked ?? primary.frame;
    const variants = Object.entries(FRAME_VARIANTS) as [FrameVariant, (typeof FRAME_VARIANTS)[FrameVariant]][];

    const saveFrame = async () => {
      setFrameBusy(true);
      setFrameMsg(null);
      try {
        await patchArtwork(primary.id, { frame: current });
        setArtworks((prev) => prev.map((a) => (a.id === primary.id ? { ...a, frame: current } : a)));
        setFrameMsg(`Frame “${FRAME_VARIANTS[current as FrameVariant]?.label ?? current}” saved to the artwork ✓`);
      } catch (err) {
        setFrameMsg(err instanceof Error ? err.message : "Could not save the frame.");
      } finally {
        setFrameBusy(false);
      }
    };

    return (
      <div style={cardStyle}>
        {stepHeader(4, "Frames — choose the frame", "All 28 frame styles from Frame Studio, previewed on your own work. Pick one and save it — the frame is written to the real artwork row, so the 3D gallery and the public exhibition show the same frame.")}
        <p style={{ fontSize: 13, color: "#6b6558", marginTop: 0 }}>
          Saved frame: <strong>{FRAME_VARIANTS[primary.frame as FrameVariant]?.label ?? primary.frame}</strong> · {statusBadge(statuses[3])}
          {" "}· <Link href={`/tools/frame-studio?artworkId=${primary.id}`} target="_blank" rel="noreferrer" style={{ color: GOLD }}>Open the full Frame Studio for custom widths, mats and glass →</Link>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {variants.map(([key, spec]) => {
            const active = current === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPicked(key)}
                style={{
                  textAlign: "center",
                  background: active ? "#f7f1e3" : "#fff",
                  border: `2px solid ${active ? GOLD : "#e8e2d4"}`,
                  borderRadius: 2,
                  padding: "10px 8px",
                  cursor: "pointer",
                }}
              >
                <FrameThumbnail variant={key} imageUrl={primary.imageUrl} artworkColor={primary.color} width={96} height={72} />
                <span style={{ display: "block", fontSize: 12, marginTop: 8 }}>{spec.label}</span>
                {primary.frame === key && <span style={{ display: "block", fontSize: 11, color: "#2e6b34" }}>saved ✓</span>}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" style={btnGold} disabled={frameBusy || current === primary.frame} onClick={saveFrame}>
            {frameBusy ? "Saving…" : current === primary.frame ? "Frame already saved" : `Save “${FRAME_VARIANTS[current as FrameVariant]?.label ?? current}” to the artwork`}
          </button>
          {frameMsg && <span style={{ fontSize: 13 }}>{frameMsg}</span>}
        </div>
      </div>
    );
  }

  // ========================= STEP 5 — Mockups =============================
  function StepMockups() {
    if (!primary) return <div style={cardStyle}><p>No artwork selected yet — go back to step 1.</p></div>;
    const mine = mockups.filter((r) => selectedArtworks.some((a) => r.artworkId === a.id || (Array.isArray(r.data.artworkIds) && (r.data.artworkIds as unknown[]).includes(a.id))));
    return (
      <div style={cardStyle}>
        {stepHeader(5, "Mockups — hang it in a room", "Place the work in a real interior in Mockup Studio and save the mockup. Saved mockups are collected into this project, and the high-resolution exports are reused again at step 10.")}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <Link href={`/tools/mockup-studio?artworkId=${primary.id}`} target="_blank" rel="noreferrer" style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>
            Open in Mockup Studio →
          </Link>
          <button type="button" style={btnGhost} onClick={() => void refreshLinked()}>Refresh status</button>
        </div>
        {linkedLoading ? (
          <p style={{ fontSize: 13, color: "#6b6558" }}>Checking saved mockups…</p>
        ) : mine.length === 0 ? (
          <p style={{ fontSize: 14 }}>No saved mockups for these artworks yet. Open Mockup Studio above, hang <strong>{primary.title}</strong> in an interior, and save the mockup — then come back and press Refresh.</p>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: "#6b6558", marginTop: 0 }}>{mine.length} saved mockup{mine.length > 1 ? "s" : ""} for this project · {statusBadge(statuses[4])}</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {mine.map((row) => {
                const collected = data.mockupIds.includes(row.id);
                return (
                  <li key={row.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13, border: "1px solid #e8e2d4", borderRadius: 2, padding: "10px 12px", background: "#fff" }}>
                    <strong>{row.title}</strong>
                    <span style={{ color: "#6b6558" }}>{artById(row.artworkId ?? "")?.title ?? ""} · {new Date(row.updatedAt).toLocaleDateString()}</span>
                    <label style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={collected}
                        onChange={(e) =>
                          updateData({ mockupIds: e.target.checked ? [...data.mockupIds, row.id] : data.mockupIds.filter((x) => x !== row.id) })
                        }
                      />
                      Collected in this project
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ======================= STEP 6 — Composition ===========================
  function StepComposition() {
    const [layout, setLayout] = useState<ArrangementLayout>(data.arrangement?.layout ?? "diptych");
    const [pickedIds, setPickedIds] = useState<string[]>(data.arrangement?.artworkIds ?? data.artworkIds.slice(0, 2));
    const [spacing, setSpacing] = useState(data.arrangement?.spacing ?? 24);
    const [wallColor, setWallColor] = useState(data.arrangement?.wallColor ?? "#f5f2eb");
    const [compMsg, setCompMsg] = useState<string | null>(null);
    const chosen = pickedIds.map((id) => artById(id)).filter((a): a is WizardArtwork => !!a);
    const canSave = chosen.length >= 2 && chosen.length <= 6;

    const togglePick = (id: string) =>
      setPickedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 6 ? prev : [...prev, id]));

    const saveArrangement = () => {
      if (!canSave) return;
      updateData({ arrangement: { layout, artworkIds: pickedIds, spacing, wallColor } });
      setCompMsg("Arrangement saved in the project ✓");
    };

    const wallStyle: React.CSSProperties = {
      background: wallColor,
      border: "1px solid #d8d2c4",
      borderRadius: 2,
      padding: 28,
      minHeight: 260,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    };
    const imgBox = (w: number): React.CSSProperties => ({
      width: w,
      aspectRatio: "4 / 5",
      objectFit: "cover",
      background: "#fff",
      border: "4px solid #fff",
      boxShadow: "0 4px 14px rgba(20,20,20,0.25)",
      display: "block",
    });

    const preview = () => {
      if (chosen.length === 0) return <p style={{ color: "#6b6558" }}>Pick 2–6 artworks to preview the arrangement.</p>;
      if (layout === "diptych" || layout === "triptych") {
        return (
          <div style={{ display: "flex", gap: spacing, justifyContent: "center", flexWrap: "wrap" }}>
            {chosen.map((a) => (
              <img key={a.id} src={a.imageUrl ?? undefined} alt={a.title} style={imgBox(layout === "diptych" ? 190 : 140)} />
            ))}
          </div>
        );
      }
      if (layout === "grid") {
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 150px)", gap: spacing, justifyContent: "center" }}>
            {chosen.map((a) => (
              <img key={a.id} src={a.imageUrl ?? undefined} alt={a.title} style={imgBox(150)} />
            ))}
          </div>
        );
      }
      // salon-style: varied sizes, clustered
      return (
        <div style={{ display: "flex", gap: spacing, alignItems: "flex-end", justifyContent: "center", flexWrap: "wrap" }}>
          {chosen.map((a, i) => (
            <img key={a.id} src={a.imageUrl ?? undefined} alt={a.title} style={imgBox(i % 2 === 0 ? 170 : 120)} />
          ))}
        </div>
      );
    };

    return (
      <div style={cardStyle}>
        {stepHeader(6, "Composition — arrange the set", "Combine artworks into one hanging — a diptych, a triptych, a grid, or a salon-style cluster. Set the spacing and the wall, preview it, and save the arrangement in the project. This is the arrangement the 3D gallery and the catalogue build from.")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
          {artworks.map((art) => {
            const on = pickedIds.includes(art.id);
            return (
              <button
                key={art.id}
                type="button"
                onClick={() => togglePick(art.id)}
                style={{
                  textAlign: "left",
                  background: on ? "#f7f1e3" : "#fff",
                  border: `2px solid ${on ? GOLD : "#e8e2d4"}`,
                  borderRadius: 2,
                  padding: 0,
                  overflow: "hidden",
                  cursor: "pointer",
                }}
              >
                {art.imageUrl ? (
                  <img src={art.imageUrl} alt={art.title} style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ height: 100, background: art.color }} />
                )}
                <span style={{ display: "block", padding: "6px 8px", fontSize: 12 }}><strong>{on ? "✓ " : ""}{art.title}</strong></span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}>
          <div>
            <label style={labelStyle} htmlFor="aic-layout">Layout</label>
            <select id="aic-layout" style={inputStyle} value={layout} onChange={(e) => setLayout(e.target.value as ArrangementLayout)}>
              <option value="diptych">Diptych — two works side by side</option>
              <option value="triptych">Triptych — three works in a row</option>
              <option value="grid">Grid — two by two</option>
              <option value="salon">Salon-style — clustered, varied sizes</option>
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="aic-spacing">Spacing — {spacing}px</label>
            <input id="aic-spacing" type="range" min={0} max={60} step={4} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} style={{ width: 160 }} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="aic-wall">Wall colour</label>
            <input id="aic-wall" type="color" value={wallColor} onChange={(e) => setWallColor(e.target.value)} style={{ width: 60, height: 36, border: "1px solid #d8d2c4", background: "#fff", padding: 2 }} />
          </div>
          <span style={{ fontSize: 13, color: "#6b6558" }}>{chosen.length} of 2–6 works picked · {statusBadge(statuses[5])}</span>
        </div>
        <div style={wallStyle}>{preview()}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16 }}>
          <button type="button" style={btnGold} disabled={!canSave} onClick={saveArrangement}>
            Save arrangement in the project
          </button>
          {compMsg && <span style={{ fontSize: 13 }}>{compMsg}</span>}
          {!canSave && <span style={{ fontSize: 13, color: "#6b6558" }}>Pick at least 2 artworks (up to 6).</span>}
        </div>
        {data.arrangement && (
          <p style={{ fontSize: 13, color: "#6b6558" }}>
            Saved: {data.arrangement.layout} · {data.arrangement.artworkIds.length} works · {data.arrangement.spacing}px spacing · wall {data.arrangement.wallColor}
          </p>
        )}
      </div>
    );
  }

  // ======================== STEP 7 — 3D Gallery ===========================
  function StepGallery() {
    const [galleryMsg, setGalleryMsg] = useState<string | null>(null);
    const [copyBusy, setCopyBusy] = useState<string | null>(null);

    const createExhibition = async () => {
      setGalleryMsg(null);
      try {
        const res = await fetch("/api/exhibitions", { method: "POST" });
        if (!res.ok) throw new Error("Could not create the exhibition.");
        const { exhibition } = (await res.json()) as { exhibition: { id: string; title: string; slug: string; status: string; description: string } };
        setExhibitions((prev) => [{ id: exhibition.id, title: exhibition.title, slug: exhibition.slug, status: exhibition.status, description: exhibition.description, roomNames: ["Room 1"], artworks: [] }, ...prev]);
        updateData({ exhibitionId: exhibition.id });
        setGalleryMsg("Exhibition created — now add the works to it below.");
      } catch (err) {
        setGalleryMsg(err instanceof Error ? err.message : "Could not create the exhibition.");
      }
    };

    const addCopy = async (art: WizardArtwork) => {
      if (!exhibition) return;
      setCopyBusy(art.id);
      setGalleryMsg(null);
      try {
        const res = await fetch("/api/artworks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            exhibitionId: exhibition.id,
            title: art.title,
            artist: art.artist,
            year: art.year,
            medium: art.medium,
            dimensions: art.dimensions,
            description: art.description,
            imageUrl: art.imageUrl,
            frame: art.frame,
          }),
        });
        if (!res.ok) throw new Error("Could not add the work to this exhibition.");
        const { artwork } = (await res.json()) as { artwork: { id: string; title: string; imageUrl: string | null } };
        setExhibitions((prev) =>
          prev.map((e) => (e.id === exhibition.id ? { ...e, artworks: [...e.artworks, { id: artwork.id, title: artwork.title, imageUrl: artwork.imageUrl }] } : e)),
        );
        setGalleryMsg(`“${art.title}” added to “${exhibition.title}” — same image, dimensions, frame and metadata. Open the 3D editor to hang it on the wall.`);
      } catch (err) {
        setGalleryMsg(err instanceof Error ? err.message : "Could not add the work.");
      } finally {
        setCopyBusy(null);
      }
    };

    return (
      <div style={cardStyle}>
        {stepHeader(7, "3D Gallery — place it in the room", "Pick the exhibition this project hangs in, then make sure every selected work is actually in it. Works already there are read from the real exhibition rows; a work that lives in another exhibition is added as a copy — same image, dimensions, frame and metadata — so the original never moves. Then open the 3D editor to hang it.")}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}>
          <div style={{ flex: "1 1 260px" }}>
            <label style={labelStyle} htmlFor="aic-exhibition">Exhibition for this project</label>
            <select id="aic-exhibition" style={inputStyle} value={data.exhibitionId ?? ""} onChange={(e) => updateData({ exhibitionId: e.target.value || null })}>
              <option value="">— Pick an exhibition —</option>
              {exhibitions.map((e) => (
                <option key={e.id} value={e.id}>{e.title} ({e.status === "public" ? "published" : "draft"} · {e.artworks.length} works)</option>
              ))}
            </select>
          </div>
          <button type="button" style={btnGhost} onClick={createExhibition}>+ New exhibition</button>
          {exhibition && (
            <Link href={`/editor/${exhibition.id}`} target="_blank" rel="noreferrer" style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>
              Open in the 3D editor →
            </Link>
          )}
        </div>
        {galleryMsg && <p style={{ fontSize: 13 }}>{galleryMsg}</p>}
        {exhibition ? (
          <div>
            <p style={{ fontSize: 13, color: "#6b6558", marginTop: 0 }}>
              “{exhibition.title}” — rooms: {exhibition.roomNames.join(", ") || "Room 1"} · {statusBadge(statuses[6])}
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {selectedArtworks.map((art) => {
                const placed = placedInExhibition.get(art.id) === true;
                const inOwnExhibition = art.exhibitionId === exhibition.id;
                return (
                  <li key={art.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 13, border: "1px solid #e8e2d4", borderRadius: 2, padding: "10px 12px", background: "#fff" }}>
                    {art.imageUrl && <img src={art.imageUrl} alt={art.title} style={{ width: 44, height: 44, objectFit: "cover" }} />}
                    <span><strong>{art.title}</strong> <span style={{ color: "#6b6558" }}>· {art.dimensions || art.medium}</span></span>
                    <span style={{ marginLeft: "auto" }}>
                      {placed ? (
                        <span style={{ color: "#2e6b34", fontWeight: 600 }}>✓ Placed in this exhibition</span>
                      ) : (
                        <button type="button" style={{ ...btnGhost, padding: "6px 12px" }} disabled={copyBusy === art.id} onClick={() => void addCopy(art)}>
                          {copyBusy === art.id ? "Adding…" : inOwnExhibition ? "Add to this exhibition" : "Add a copy to this exhibition"}
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
              {selectedArtworks.length === 0 && <li style={{ fontSize: 13, color: "#6b6558" }}>No artworks in this project yet — go back to step 1.</li>}
            </ul>
          </div>
        ) : (
          <p style={{ fontSize: 14 }}>Pick an exhibition above (or create a new one) to see which works are already placed in it.</p>
        )}
      </div>
    );
  }

  // ======================== STEP 8 — Exhibition ===========================
  function StepExhibition() {
    const [details, setDetails] = useState(data.exhibitionDetails);
    const [exMsg, setExMsg] = useState<string | null>(null);
    const [exBusy, setExBusy] = useState(false);
    const [planId, setPlanId] = useState("");
    useEffect(() => {
      setDetails(data.exhibitionDetails);
      // Sync when the project changes; typing stays local until saved.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId]);

    if (!exhibition) return <div style={cardStyle}><p>No exhibition linked yet — pick or create one in step 7.</p></div>;

    const importPlan = (id: string) => {
      setPlanId(id);
      const row = plans.find((p) => p.id === id);
      if (!row) return;
      const d = row.data as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      const labels: Record<string, string> = { ...details.labels };
      if (Array.isArray(d.items)) {
        for (const item of d.items as Record<string, unknown>[]) {
          if (typeof item.artworkId === "string" && typeof item.label === "string" && item.label) labels[item.artworkId] = item.label;
        }
      }
      setDetails((prev) => ({
        ...prev,
        title: str(d.title) || prev.title,
        statement: str(d.statement) || prev.statement,
        labels,
      }));
      setExMsg(`Imported “${row.title}” from Exhibition Planner — review it, then save.`);
    };

    const saveExhibition = async () => {
      setExBusy(true);
      setExMsg(null);
      try {
        const title = details.title.trim() || exhibition.title;
        const res = await fetch(`/api/exhibitions/${encodeURIComponent(exhibition.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, description: details.statement }),
        });
        if (!res.ok) throw new Error("Could not save the exhibition.");
        setExhibitions((prev) => prev.map((e) => (e.id === exhibition.id ? { ...e, title, description: details.statement } : e)));
        updateData({ exhibitionDetails: details });
        setExMsg("Saved — title and curatorial statement are on the real exhibition row; the rest lives in this project.");
      } catch (err) {
        setExMsg(err instanceof Error ? err.message : "Could not save.");
      } finally {
        setExBusy(false);
      }
    };

    const setField = (key: keyof ProjectData["exhibitionDetails"], value: string) =>
      setDetails((prev) => ({ ...prev, [key]: value }));

    return (
      <div style={cardStyle}>
        {stepHeader(8, "Exhibition — write the show", "Finish the exhibition from the selected works: title, curatorial statement, artists, wall labels, room structure, lighting notes, a guided tour and visitor information. The title and statement save to the real exhibition row.")}
        {plans.length > 0 && (
          <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginBottom: 16, padding: 12, background: "#f7f1e3", border: "1px solid #e8e2d4", borderRadius: 2 }}>
            <div style={{ flex: "1 1 260px" }}>
              <label style={labelStyle} htmlFor="aic-plan">Import from Exhibition Planner</label>
              <select id="aic-plan" style={inputStyle} value={planId} onChange={(e) => importPlan(e.target.value)}>
                <option value="">— Pick a saved plan —</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: 13, color: "#6b6558" }}>Brings in the plan&apos;s title, statement and wall labels.</span>
          </div>
        )}
        <div style={{ display: "grid", gap: 12 }}>
          <div><label style={labelStyle} htmlFor="aic-ex-title">Exhibition title</label><input id="aic-ex-title" style={inputStyle} value={details.title || exhibition.title} onChange={(e) => setField("title", e.target.value)} /></div>
          <div><label style={labelStyle} htmlFor="aic-ex-statement">Curatorial statement</label><textarea id="aic-ex-statement" style={{ ...inputStyle, minHeight: 90 }} value={details.statement || exhibition.description} onChange={(e) => setField("statement", e.target.value)} placeholder="What is this show about, and why do these works hang together?" /></div>
          <div><label style={labelStyle} htmlFor="aic-ex-artists">Artists</label><input id="aic-ex-artists" style={inputStyle} value={details.artists} onChange={(e) => setField("artists", e.target.value)} placeholder="e.g. Kabeya Ilunga, with …" /></div>
          <div><label style={labelStyle} htmlFor="aic-ex-lighting">Lighting notes</label><textarea id="aic-ex-lighting" style={{ ...inputStyle, minHeight: 60 }} value={details.lighting} onChange={(e) => setField("lighting", e.target.value)} placeholder="e.g. Warm spots on the charcoal works; keep the blue wall in low light." /></div>
          <div><label style={labelStyle} htmlFor="aic-ex-tour">Guided tour text</label><textarea id="aic-ex-tour" style={{ ...inputStyle, minHeight: 60 }} value={details.tourText} onChange={(e) => setField("tourText", e.target.value)} placeholder="What the visitor hears, stop by stop." /></div>
          <div><label style={labelStyle} htmlFor="aic-ex-visitor">Visitor information</label><input id="aic-ex-visitor" style={inputStyle} value={details.visitorInfo} onChange={(e) => setField("visitorInfo", e.target.value)} placeholder="e.g. Open daily 10–18, free entry." /></div>
        </div>
        <h3 style={{ fontFamily: "Fraunces, serif", margin: "20px 0 8px" }}>Wall labels</h3>
        <p style={{ fontSize: 13, color: "#6b6558", marginTop: 0 }}>One label per work. Left blank, the label is built from the artwork record (title, artist, year, medium, dimensions).</p>
        <div style={{ display: "grid", gap: 10 }}>
          {selectedArtworks.map((art) => (
            <div key={art.id} style={{ display: "flex", gap: 10, alignItems: "start" }}>
              {art.imageUrl && <img src={art.imageUrl} alt={art.title} style={{ width: 48, height: 48, objectFit: "cover" }} />}
              <div style={{ flex: 1 }}>
                <label style={labelStyle} htmlFor={`aic-label-${art.id}`}>{art.title}</label>
                <textarea
                  id={`aic-label-${art.id}`}
                  style={{ ...inputStyle, minHeight: 52 }}
                  value={details.labels[art.id] ?? ""}
                  onChange={(e) => setDetails((prev) => ({ ...prev, labels: { ...prev.labels, [art.id]: e.target.value } }))}
                  placeholder={[art.title, art.artist, art.year].filter(Boolean).join(", ") + (art.medium || art.dimensions ? ` — ${[art.medium, art.dimensions].filter(Boolean).join(" · ")}` : "")}
                />
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: "#6b6558" }}>Rooms: {exhibition.roomNames.join(", ") || "Room 1"} — room structure is edited in the 3D editor. <Link href={`/editor/${exhibition.id}`} target="_blank" rel="noreferrer" style={{ color: GOLD }}>Open the editor →</Link></p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" style={btnGold} disabled={exBusy} onClick={saveExhibition}>{exBusy ? "Saving…" : "Save exhibition"}</button>
          <span style={{ fontSize: 13 }}>{statusBadge(statuses[7])}</span>
          {exMsg && <span style={{ fontSize: 13 }}>{exMsg}</span>}
        </div>
      </div>
    );
  }

  // ======================== STEP 9 — Publication ==========================
  function StepPublication() {
    const [pubBusy, setPubBusy] = useState(false);
    const [pubMsg, setPubMsg] = useState<string | null>(null);
    const [qr, setQr] = useState<string | null>(null);
    const [origin, setOrigin] = useState("");
    useEffect(() => {
      setOrigin(window.location.origin);
    }, []);
    useEffect(() => {
      if (exhibition && exhibition.status === "public" && origin) {
        void QRCode.toDataURL(`${origin}/exhibition/${exhibition.slug}`, { width: 220, margin: 1 }).then(setQr).catch(() => setQr(null));
      } else {
        setQr(null);
      }
    }, [exhibition, origin]);

    if (!exhibition) return <div style={cardStyle}><p>No exhibition linked yet — pick or create one in step 7.</p></div>;
    const publicUrl = origin ? `${origin}/exhibition/${exhibition.slug}` : `/exhibition/${exhibition.slug}`;
    const isPublic = exhibition.status === "public";

    const togglePublish = async () => {
      setPubBusy(true);
      setPubMsg(null);
      try {
        const res = await fetch(`/api/exhibitions/${encodeURIComponent(exhibition.id)}/publish`, { method: "POST" });
        if (!res.ok) throw new Error("Could not change the publication state.");
        const { status } = (await res.json()) as { status: string };
        setExhibitions((prev) => prev.map((e) => (e.id === exhibition.id ? { ...e, status } : e)));
        setPubMsg(status === "public" ? "Published — the exhibition is live at its public URL." : "Unpublished — the exhibition is a draft again.");
      } catch (err) {
        setPubMsg(err instanceof Error ? err.message : "Could not publish.");
      } finally {
        setPubBusy(false);
      }
    };

    return (
      <div style={cardStyle}>
        {stepHeader(9, "Publication — publish & share", "Publish the exhibition and generate everything a visitor needs: the public link, a QR code, the social preview and the catalogue link.")}
        <p style={{ fontSize: 14 }}>
          <strong>{exhibition.title}</strong> · {isPublic ? <span style={{ color: "#2e6b34", fontWeight: 600 }}>Published ✓</span> : <span style={{ color: GOLD, fontWeight: 600 }}>Draft</span>} · {statusBadge(statuses[8])}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <button type="button" style={isPublic ? btnGhost : btnGold} disabled={pubBusy} onClick={togglePublish}>
            {pubBusy ? "Working…" : isPublic ? "Unpublish (back to draft)" : "Publish exhibition"}
          </button>
          {isPublic && (
            <Link href={publicUrl} target="_blank" rel="noreferrer" style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>View the public exhibition →</Link>
          )}
        </div>
        {pubMsg && <p style={{ fontSize: 13 }}>{pubMsg}</p>}
        {isPublic && (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px" }}>
              <h3 style={{ fontFamily: "Fraunces, serif", margin: "0 0 8px" }}>Shareables</h3>
              <dl style={{ margin: 0, fontSize: 14, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px" }}>
                <dt style={{ color: "#6b6558" }}>Public URL</dt>
                <dd style={{ margin: 0, wordBreak: "break-all" }}><a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: GOLD }}>{publicUrl}</a></dd>
                <dt style={{ color: "#6b6558" }}>Catalogue</dt>
                <dd style={{ margin: 0 }}><Link href={`/tools/presentation-designer?exhibitionId=${exhibition.id}`} target="_blank" rel="noreferrer" style={{ color: GOLD }}>Build the PDF catalogue →</Link></dd>
                <dt style={{ color: "#6b6558" }}>Works</dt>
                <dd style={{ margin: 0 }}>{exhibition.artworks.length} in the show</dd>
              </dl>
              <h3 style={{ fontFamily: "Fraunces, serif", margin: "20px 0 8px" }}>Social preview</h3>
              <div style={{ border: "1px solid #e8e2d4", borderRadius: 2, overflow: "hidden", maxWidth: 420 }}>
                {exhibition.artworks[0]?.imageUrl && <img src={exhibition.artworks[0].imageUrl} alt="" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />}
                <div style={{ padding: 12 }}>
                  <strong style={{ display: "block", fontSize: 15 }}>{exhibition.title}</strong>
                  <span style={{ fontSize: 13, color: "#6b6558" }}>{(exhibition.description || "An exhibition on SANAA").slice(0, 120)}</span>
                  <span style={{ display: "block", fontSize: 12, color: GOLD, marginTop: 6 }}>{publicUrl.replace(/^https?:\/\//, "")}</span>
                </div>
              </div>
            </div>
            <div>
              <h3 style={{ fontFamily: "Fraunces, serif", margin: "0 0 8px" }}>QR code</h3>
              {qr ? (
                <>
                  <img src={qr} alt={`QR code for ${exhibition.title}`} style={{ width: 220, height: 220, border: "1px solid #e8e2d4", background: "#fff" }} />
                  <p style={{ fontSize: 13, color: "#6b6558" }}>Print it on the poster, the invitation or the wall label.</p>
                  <a href={qr} download={`${exhibition.slug}-qr.png`} style={{ ...btnGhost, textDecoration: "none", display: "inline-block" }}>Download QR (PNG)</a>
                </>
              ) : (
                <p style={{ fontSize: 13, color: "#6b6558" }}>Generating…</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== STEP 10 — Export & Promotion ======================
  function StepPromotion() {
    if (!exhibition) return <div style={cardStyle}><p>No exhibition linked yet — pick or create one in step 7.</p></div>;
    const catalogueDone = data.promotion.catalogue || presentations.some((r) => String(r.data.exhibitionId ?? "") === exhibition.id);
    const posterDone = data.promotion.poster || marketingAssets.some((r) => String(r.data.exhibitionId ?? "") === exhibition.id);
    const videoDone = data.promotion.video || videoProjects.some((r) => String((r.data as Record<string, unknown>).exhibitionId ?? "") === exhibition.id);
    const collectedMockups = mockups.filter((r) => data.mockupIds.includes(r.id));
    const wallLabelOf = (art: WizardArtwork) =>
      data.exhibitionDetails.labels[art.id] ||
      [art.title, art.artist, art.year].filter(Boolean).join(", ") + (art.medium || art.dimensions ? `\n${[art.medium, art.dimensions].filter(Boolean).join(" · ")}` : "");

    const togglePromo = (key: keyof ProjectData["promotion"]) =>
      updateData({ promotion: { ...data.promotion, [key]: !data.promotion[key] } });

    return (
      <div style={cardStyle}>
        {stepHeader(10, "Export & Promotion — send it out", "The outputs of the whole journey, in one place: the saved mockups, the exhibition images, the PDF catalogue, the wall labels, the promotional poster and the walkthrough video.")}
        <div style={{ display: "grid", gap: 16 }}>
          <section>
            <h3 style={{ fontFamily: "Fraunces, serif", margin: "0 0 8px" }}>High-resolution mockups</h3>
            {collectedMockups.length > 0 || mockupsForPrimary() ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                {(collectedMockups.length > 0 ? collectedMockups : mockups.filter((r) => selectedArtworks.some((a) => r.artworkId === a.id))).map((r) => (
                  <li key={r.id}>{r.title} <span style={{ color: "#6b6558" }}>· {artById(r.artworkId ?? "")?.title ?? ""}</span></li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: "#6b6558", margin: 0 }}>No mockups collected yet — see step 5. <Link href={`/tools/mockup-studio?artworkId=${primary?.id ?? ""}`} target="_blank" rel="noreferrer" style={{ color: GOLD }}>Open Mockup Studio →</Link></p>
            )}
            <p style={{ fontSize: 13, color: "#6b6558" }}>Export the full-resolution file from Mockup Studio — the saved mockup keeps your scene, frame and light.</p>
          </section>

          <section>
            <h3 style={{ fontFamily: "Fraunces, serif", margin: "0 0 8px" }}>Exhibition images</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {exhibition.artworks.map((a) => (
                <span key={a.id} style={{ textAlign: "center", fontSize: 12, width: 110 }}>
                  {a.imageUrl && <img src={a.imageUrl} alt={a.title} style={{ width: 110, height: 110, objectFit: "cover", border: "1px solid #e8e2d4" }} />}
                  <span style={{ display: "block", marginTop: 4 }}>{a.title}</span>
                </span>
              ))}
            </div>
          </section>

          <section style={{ borderTop: "1px solid #e8e2d4", paddingTop: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", margin: "0 0 8px" }}>PDF catalogue {catalogueDone ? <span style={{ color: "#2e6b34", fontSize: 13 }}>✓</span> : null}</h3>
            <p style={{ fontSize: 14, margin: "0 0 8px" }}>Built from the Presentation Designer data — the same works, captions and curatorial text as the show.</p>
            <Link href={`/tools/presentation-designer?exhibitionId=${exhibition.id}`} target="_blank" rel="noreferrer" style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>
              Open Presentation Designer →
            </Link>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={data.promotion.catalogue} onChange={() => togglePromo("catalogue")} /> Catalogue exported
            </label>
          </section>

          <section style={{ borderTop: "1px solid #e8e2d4", paddingTop: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", margin: "0 0 8px" }}>Wall labels</h3>
            <p style={{ fontSize: 13, color: "#6b6558", marginTop: 0 }}>From the planner labels (step 8) — or the artwork record where no label was written. Print this page for the install.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {selectedArtworks.map((art) => (
                <div key={art.id} style={{ border: "1px solid #d8d2c4", padding: 14, background: "#fff" }}>
                  <strong style={{ display: "block", fontFamily: "Fraunces, serif", fontSize: 15 }}>{art.title}</strong>
                  <span style={{ display: "block", fontSize: 12, color: "#5b554a", whiteSpace: "pre-line", marginTop: 4 }}>{wallLabelOf(art)}</span>
                </div>
              ))}
            </div>
            <button type="button" style={{ ...btnGhost, marginTop: 12 }} onClick={() => window.print()}>Print wall labels</button>
          </section>

          <section style={{ borderTop: "1px solid #e8e2d4", paddingTop: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", margin: "0 0 8px" }}>Promotional poster {posterDone ? <span style={{ color: "#2e6b34", fontSize: 13 }}>✓</span> : null}</h3>
            <p style={{ fontSize: 14, margin: "0 0 8px" }}>Marketing Studio opens with this exhibition (and its headline) already selected.</p>
            <Link href={`/tools/marketing-studio?exhibitionId=${exhibition.id}${primary ? `&artworkId=${primary.id}` : ""}`} target="_blank" rel="noreferrer" style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>
              Open Marketing Studio →
            </Link>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={data.promotion.poster} onChange={() => togglePromo("poster")} /> Poster exported
            </label>
          </section>

          <section style={{ borderTop: "1px solid #e8e2d4", paddingTop: 16 }}>
            <h3 style={{ fontFamily: "Fraunces, serif", margin: "0 0 8px" }}>Walkthrough video {videoDone ? <span style={{ color: "#2e6b34", fontSize: 13 }}>✓</span> : null}</h3>
            <p style={{ fontSize: 14, margin: "0 0 8px" }}>Video Generator opens with this exhibition already selected — build the shot list and record the real 3D room.</p>
            <Link href={`/tools/video-generator?exhibitionId=${exhibition.id}`} target="_blank" rel="noreferrer" style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>
              Open Video Generator →
            </Link>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={data.promotion.video} onChange={() => togglePromo("video")} /> Video recorded
            </label>
          </section>
        </div>
        <p style={{ fontSize: 13, color: "#6b6558", marginTop: 20 }}>
          Step status: {statusBadge(statuses[9])} — done when the catalogue, the poster and the video are all produced (a saved presentation, marketing asset or video project for this exhibition counts, as does ticking the boxes above).
        </p>
      </div>
    );

    function mockupsForPrimary() {
      return primary ? mockups.some((r) => r.artworkId === primary.id) : false;
    }
  }
}
