"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";
import {
  ASSET_LICENSES,
  ASSET_SOURCES,
  EXTERNAL_PROVIDER_SLOTS,
  IMAGE3D_MODES,
  MARKETPLACE_REFERENCES,
  MAX_ASSET_FILE_BYTES,
  PUBLIC_DOMAIN_REFERENCES,
  formatBytes,
  getImage3DProvider,
  localApproximationProvider,
  validateAssetFile,
  type Asset3DRecord,
  type AssetLicense,
  type AssetSource,
  type Image3DMode,
} from "@/lib/asset-library";
import styles from "@/components/tools.module.css";

// ---------------------------------------------------------------------------
// SavedWork rows for kind "asset-3d"
// ---------------------------------------------------------------------------

interface SavedAsset {
  id: string;
  title: string;
  data: Asset3DRecord;
  createdAt: string;
  updatedAt: string;
}

type Tab = "library" | "import" | "image-to-3d";

const TABS: { id: Tab; label: string }[] = [
  { id: "library", label: "Asset library" },
  { id: "import", label: "Import .glb / .gltf" },
  { id: "image-to-3d", label: "Image-to-3D" },
];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image."));
    img.src = url;
  });
}

/** Downscale an image file to at most 1024 px on its long edge and return a
 *  JPEG data URL, so saved textures stay small in the database. */
async function downscaleImage(file: Blob, maxEdge = 1024): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------------
// 3D preview pieces
// ---------------------------------------------------------------------------

/** A parsed GLB/GLTF scene, with scale / rotation / tint applied. */
function ImportedModel({
  scene,
  scale,
  rotationY,
  tint,
}: {
  scene: THREE.Group;
  scale: number;
  rotationY: number;
  tint: string;
}) {
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          const mat = material as THREE.MeshStandardMaterial;
          if (mat.color && tint !== "#ffffff") mat.color.set(tint);
        });
      }
    });
  }, [scene, tint]);
  return <primitive object={scene} scale={scale} rotation={[0, rotationY, 0]} />;
}

/** Flat textured panel (2D-texture mode). */
function TexturedPanel({ imageUrl, shape }: { imageUrl: string; shape: "plane" | "box" }) {
  const texture = useTexture(imageUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (shape === "box") {
    return (
      <mesh rotation={[0, 0.4, 0]}>
        <boxGeometry args={[1.6, 1.6, 0.12]} />
        <meshStandardMaterial map={texture} />
      </mesh>
    );
  }
  return (
    <mesh rotation={[0, 0.2, 0]}>
      <planeGeometry args={[1.8, 1.8]} />
      <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Depth-from-luminance relief: brightness is read as height. Labelled in
 *  the UI as an approximation — it cannot know hidden geometry. */
function DepthRelief({ imageUrl, depthStrength }: { imageUrl: string; depthStrength: number }) {
  const texture = useTexture(imageUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const img = await loadImage(imageUrl);
        const segments = 96;
        const sample = document.createElement("canvas");
        sample.width = segments + 1;
        sample.height = segments + 1;
        const ctx = sample.getContext("2d");
        if (!ctx) throw new Error("Canvas is not available in this browser.");
        ctx.drawImage(img, 0, 0, sample.width, sample.height);
        const data = ctx.getImageData(0, 0, sample.width, sample.height).data;
        const geo = new THREE.PlaneGeometry(1.8, 1.8, segments, segments);
        const position = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < position.count; i++) {
          const x = i % (segments + 1);
          const y = Math.floor(i / (segments + 1));
          const pixel = (y * (segments + 1) + x) * 4;
          // Luminance as height; flip Y so the image is not upside down.
          const luminance = (0.299 * data[pixel] + 0.587 * data[pixel + 1] + 0.114 * data[pixel + 2]) / 255;
          position.setZ(i, (luminance - 0.5) * depthStrength * 0.9);
        }
        geo.computeVertexNormals();
        if (!cancelled) setGeometry(geo);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not build the relief.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageUrl, depthStrength]);

  if (error) return null;
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} rotation={[-0.35, 0.25, 0]}>
      <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Fit the camera to a loaded model: used after a GLB import. */
function FitCamera({ scene }: { scene: THREE.Group | null }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 0.5);
    camera.position.set(radius * 1.4, radius * 0.9, radius * 1.8);
    camera.lookAt(0, 0, 0);
  }, [scene, camera]);
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ImageTo3D() {
  const [tab, setTab] = useState<Tab>("library");

  // Library state
  const [assets, setAssets] = useState<SavedAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [licenseFilter, setLicenseFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Manual add form
  const [form, setForm] = useState({ name: "", creator: "", license: "CC0 — Public Domain" as AssetLicense, attribution: "", sourceUrl: "", notes: "" });

  // GLB import state
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [modelScene, setModelScene] = useState<THREE.Group | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelName, setModelName] = useState("");
  const [modelScale, setModelScale] = useState(1);
  const [modelRotation, setModelRotation] = useState(0);
  const [modelTint, setModelTint] = useState("#ffffff");
  const modelInputRef = useRef<HTMLInputElement | null>(null);

  // Image-to-3D state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [mode, setMode] = useState<Image3DMode>("2d-texture");
  const [depthStrength, setDepthStrength] = useState(0.5);
  const [textureShape, setTextureShape] = useState<"plane" | "box">("plane");
  const [providerId, setProviderId] = useState("none");
  const [resultNote, setResultNote] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    setAssetsError(null);
    try {
      const response = await fetch("/api/saved-work?kind=asset-3d");
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to view your asset library." : "Could not load your asset library.");
      const result = (await response.json()) as { saved: SavedAsset[] };
      setAssets(result.saved ?? []);
    } catch (error) {
      setAssetsError(error instanceof Error ? error.message : "Could not load your asset library.");
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (licenseFilter !== "all" && asset.data.license !== licenseFilter) return false;
      if (sourceFilter !== "all" && asset.data.source !== sourceFilter) return false;
      if (!q) return true;
      return [asset.title, asset.data.name, asset.data.creator, asset.data.notes ?? "", asset.data.sourceUrl ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [assets, query, licenseFilter, sourceFilter]);

  async function saveAsset(record: Asset3DRecord, title: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/saved-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "asset-3d", title, data: record }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to save assets." : "Could not save this asset.");
      setMessage(`Saved “${title}” to your library.`);
      await loadAssets();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this asset.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAsset(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this asset.");
      setDeleteId(null);
      await loadAssets();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this asset.");
    } finally {
      setBusy(false);
    }
  }

  async function addManualAsset() {
    if (!form.name.trim()) {
      setMessage("Give the asset a name first.");
      return;
    }
    const record: Asset3DRecord = {
      kind: "reference",
      source: "manual",
      name: form.name.trim(),
      creator: form.creator.trim() || "Unknown",
      license: form.license,
      attribution: form.attribution.trim(),
      downloadDate: new Date().toISOString().slice(0, 10),
      sourceUrl: form.sourceUrl.trim() || undefined,
      notes: form.notes.trim() || undefined,
      mode: "reference",
    };
    await saveAsset(record, record.name);
    setForm({ name: "", creator: "", license: "CC0 — Public Domain", attribution: "", sourceUrl: "", notes: "" });
  }

  // --- GLB import ----------------------------------------------------------

  async function handleModelFile(file: File) {
    const error = validateAssetFile(file, [".glb", ".gltf"]);
    if (error) {
      setModelError(error);
      return;
    }
    setModelError(null);
    setModelLoading(true);
    setModelFile(file);
    setModelName(file.name.replace(/\.(glb|gltf)$/i, ""));
    try {
      const buffer = await file.arrayBuffer();
      const scene = await new Promise<THREE.Group>((resolve, reject) => {
        new GLTFLoader().parse(buffer, "", (gltf) => resolve(gltf.scene), (err) => reject(err instanceof Error ? err : new Error("Could not parse this file.")));
      });
      setModelScene(scene);
    } catch (err) {
      setModelScene(null);
      setModelError(err instanceof Error ? err.message : "Could not parse this file as .glb/.gltf.");
    } finally {
      setModelLoading(false);
    }
  }

  async function saveImportedModel() {
    if (!modelFile) return;
    const record: Asset3DRecord = {
      kind: "model",
      source: "upload",
      name: modelName.trim() || modelFile.name,
      creator: "You",
      license: "All rights reserved",
      attribution: "",
      downloadDate: new Date().toISOString().slice(0, 10),
      fileName: modelFile.name,
      fileSizeBytes: modelFile.size,
      fileType: modelFile.name.toLowerCase().endsWith(".gltf") ? "model/gltf+json" : "model/gltf-binary",
      mode: "imported-glb",
      transform: { scale: modelScale, rotationY: modelRotation, tint: modelTint },
      notes: "GLB file itself is not stored server-side — keep the original file on disk and re-attach it to preview again.",
    };
    await saveAsset(record, record.name);
  }

  // --- Image-to-3D ---------------------------------------------------------

  async function handleImageFile(file: File) {
    const error = validateAssetFile(file, [".jpg", ".jpeg", ".png", ".webp"]);
    if (error) {
      setImageError(error);
      return;
    }
    setImageError(null);
    setImageBusy(true);
    try {
      const dataUrl = await downscaleImage(file);
      setImageFile(file);
      setImageUrl(dataUrl);
      setResultNote(null);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Could not read this image.");
    } finally {
      setImageBusy(false);
    }
  }

  async function runImageTo3D() {
    if (!imageFile || !imageUrl) return;
    const provider = getImage3DProvider(providerId) ?? localApproximationProvider;
    if (!provider.available()) {
      setImageError(`${provider.label} is not configured. ${provider.setupInstructions()}`);
      return;
    }
    setImageBusy(true);
    setImageError(null);
    try {
      const result = await provider.generateFromImage(imageFile, { mode, depthStrength });
      setResultNote(result.note);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Image-to-3D failed.");
    } finally {
      setImageBusy(false);
    }
  }

  async function saveImageResult() {
    if (!imageFile || !imageUrl) return;
    const record: Asset3DRecord = {
      kind: mode === "2d-texture" ? "texture" : "image",
      source: "image-to-3d",
      name: imageFile.name.replace(/\.(jpe?g|png|webp)$/i, ""),
      creator: "You",
      license: "All rights reserved",
      attribution: "",
      downloadDate: new Date().toISOString().slice(0, 10),
      fileName: imageFile.name,
      fileSizeBytes: imageFile.size,
      fileType: imageFile.type,
      fileDataUrl: imageUrl,
      mode: mode === "2d-texture" ? "2d-texture" : "depth-approximation",
      depthStrength: mode === "depth-approximation" ? depthStrength : undefined,
      notes:
        mode === "2d-texture"
          ? "2D texture: the image applied to a panel. Flat — no geometry reconstructed."
          : "Depth approximation from brightness. An artistic relief, not a true reconstruction.",
    };
    await saveAsset(record, record.name);
  }

  const selectedMode = IMAGE3D_MODES.find((item) => item.id === mode);
  const provider = getImage3DProvider(providerId) ?? localApproximationProvider;
  const selectedSlot = EXTERNAL_PROVIDER_SLOTS.find((slot) => slot.id === providerId);

  return (
    <div>
      {message && (
        <p role="status" style={{ margin: "0 0 12px", color: "var(--ink)", fontSize: "12px" }}>
          {message}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }} role="tablist" aria-label="Image-to-3D sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className="galleries-open-button"
            style={tab === item.id ? undefined : { background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------- LIBRARY */}
      {tab === "library" && (
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <input
              className="full-input"
              style={{ flex: "1 1 220px", height: 36 }}
              placeholder="Search by name, creator or note…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search assets"
            />
            <select className="full-input" style={{ flex: "0 1 200px", height: 36 }} value={licenseFilter} onChange={(event) => setLicenseFilter(event.target.value)} aria-label="Filter by licence">
              <option value="all">All licences</option>
              {ASSET_LICENSES.map((license) => (
                <option key={license} value={license}>
                  {license}
                </option>
              ))}
            </select>
            <select className="full-input" style={{ flex: "0 1 180px", height: 36 }} value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="Filter by source">
              <option value="all">All sources</option>
              {ASSET_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          {assetsLoading ? (
            <div className={styles.emptyBox}>
              <strong>Loading your library…</strong>
            </div>
          ) : assetsError ? (
            <div className={styles.emptyBox}>
              <strong>Could not load your library.</strong>
              <p>{assetsError}</p>
              <button className="galleries-open-button" onClick={() => void loadAssets()}>
                Try again
              </button>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className={styles.emptyBox}>
              <strong>{assets.length === 0 ? "Your asset library is empty." : "No assets match these filters."}</strong>
              <p>
                {assets.length === 0
                  ? "Import a .glb/.gltf model, turn an image into a textured panel or depth relief, or add a reference link below."
                  : "Try a different search or clear the filters."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 24 }}>
              {filteredAssets.map((asset) => (
                <article key={asset.id} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 14, background: "var(--surface-3)" }}>
                  {asset.data.fileDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.data.fileDataUrl} alt={asset.title} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 4, marginBottom: 10 }} />
                  )}
                  <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{asset.title}</h3>
                  <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
                    {asset.data.kind} · {asset.data.source} · {asset.data.creator}
                    <br />
                    Licence: {asset.data.license}
                    <br />
                    {asset.data.fileName ? `${asset.data.fileName}${asset.data.fileSizeBytes ? ` · ${formatBytes(asset.data.fileSizeBytes)}` : ""}` : "No file attached"}
                    <br />
                    Saved {asset.data.downloadDate}
                  </p>
                  {asset.data.attribution && <p style={{ margin: "0 0 8px", fontSize: 11 }}>Attribution: {asset.data.attribution}</p>}
                  {asset.data.notes && <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--muted)" }}>{asset.data.notes}</p>}
                  {asset.data.sourceUrl && (
                    <p style={{ margin: "0 0 8px", fontSize: 11 }}>
                      <a href={asset.data.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                        Source ↗
                      </a>
                    </p>
                  )}
                  {deleteId === asset.id ? (
                    <span style={{ display: "flex", gap: 8 }}>
                      <button className="galleries-open-button" disabled={busy} onClick={() => void deleteAsset(asset.id)}>
                        Delete
                      </button>
                      <button className="galleries-open-button" style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" }} onClick={() => setDeleteId(null)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button className="galleries-open-button" style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" }} onClick={() => setDeleteId(asset.id)}>
                      Delete
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}

          <div className="property-section">
            <label>ADD A REFERENCE ASSET MANUALLY</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              <input className="full-input" placeholder="Asset name *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} aria-label="Asset name" />
              <input className="full-input" placeholder="Creator / author" value={form.creator} onChange={(event) => setForm({ ...form, creator: event.target.value })} aria-label="Creator" />
              <select className="full-input" value={form.license} onChange={(event) => setForm({ ...form, license: event.target.value as AssetLicense })} aria-label="Licence">
                {ASSET_LICENSES.map((license) => (
                  <option key={license} value={license}>
                    {license}
                  </option>
                ))}
              </select>
              <input className="full-input" placeholder="Source URL" value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} aria-label="Source URL" />
              <input className="full-input" placeholder="Attribution text (if required)" value={form.attribution} onChange={(event) => setForm({ ...form, attribution: event.target.value })} aria-label="Attribution" />
              <input className="full-input" placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} aria-label="Notes" />
            </div>
            <p style={{ margin: "8px 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
              Record the licence exactly as the source states it. Never claim an asset is free to use without its licence — when in doubt, pick “Unknown — do not use commercially”.
            </p>
            <button className="galleries-open-button" disabled={busy} onClick={() => void addManualAsset()}>
              {busy ? "Saving…" : "Add to library"}
            </button>
          </div>

          <div className="property-section">
            <label>REFERENCE LINKS — LINK OUT, DO NOT RE-HOST</label>
            <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
              Starter sources for free 3D assets, plus marketplaces below. These are links to other sites — SANAA does not copy or host their files. Always check the licence on the file page itself before using an asset.
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {PUBLIC_DOMAIN_REFERENCES.map((ref) => (
                <li key={ref.name} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 12 }}>
                  <a href={ref.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>
                    {ref.name} ↗
                  </a>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
                    {ref.what}
                    <br />
                    Licence: {ref.license}
                  </p>
                </li>
              ))}
            </ul>
            <h3 style={{ fontSize: 13, margin: "18px 0 6px" }}>Marketplaces — per-asset licence, link out only</h3>
            <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
              Marketplace assets are not free by default: each one has its own licence and price. Record the asset URL
              and licence in your library like any other source — SANAA never re-hosts marketplace files.
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {MARKETPLACE_REFERENCES.map((ref) => (
                <li key={ref.name} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 12 }}>
                  <a href={ref.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>
                    {ref.name} ↗
                  </a>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
                    {ref.what}
                    <br />
                    Licence: {ref.license}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ IMPORT */}
      {tab === "import" && (
        <div>
          <div className="property-section">
            <label>UPLOAD A .GLB / .GLTF MODEL — MAX {formatBytes(MAX_ASSET_FILE_BYTES)}</label>
            <input
              ref={modelInputRef}
              type="file"
              accept=".glb,.gltf"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleModelFile(file);
                event.target.value = "";
              }}
            />
            <button className="galleries-open-button" onClick={() => modelInputRef.current?.click()}>
              Choose a model file
            </button>
            {modelFile && (
              <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11 }}>
                {modelFile.name} · {formatBytes(modelFile.size)}
              </p>
            )}
            {modelError && (
              <p role="alert" style={{ margin: "8px 0 0", color: "#a33", fontSize: 12 }}>
                {modelError}
              </p>
            )}
          </div>

          {modelLoading && (
            <div className={styles.emptyBox}>
              <strong>Parsing your model…</strong>
            </div>
          )}

          {modelScene && (
            <div>
              <div style={{ height: 380, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", background: "#111" }}>
                <Canvas camera={{ position: [2.5, 1.6, 3.2], fov: 45 }} dpr={[1, 2]}>
                  <ambientLight intensity={0.7} />
                  <directionalLight position={[4, 6, 4]} intensity={1.2} />
                  <FitCamera scene={modelScene} />
                  <ImportedModel scene={modelScene} scale={modelScale} rotationY={modelRotation} tint={modelTint} />
                  <OrbitControls makeDefault />
                </Canvas>
              </div>
              <p style={{ margin: "8px 0", color: "var(--muted)", fontSize: 11 }}>Drag to orbit, scroll to zoom. The preview runs entirely in your browser.</p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div className="property-section">
                  <label>
                    SCALE — {modelScale.toFixed(2)}×
                  </label>
                  <input type="range" min={0.1} max={5} step={0.05} value={modelScale} onChange={(event) => setModelScale(Number(event.target.value))} style={{ width: "100%" }} aria-label="Scale" />
                </div>
                <div className="property-section">
                  <label>
                    ROTATION — {Math.round((modelRotation * 180) / Math.PI)}°
                  </label>
                  <input type="range" min={0} max={6.283} step={0.05} value={modelRotation} onChange={(event) => setModelRotation(Number(event.target.value))} style={{ width: "100%" }} aria-label="Rotation" />
                </div>
                <div className="property-section">
                  <label>MATERIAL TINT</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={modelTint} onChange={(event) => setModelTint(event.target.value)} aria-label="Material tint" />
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{modelTint === "#ffffff" ? "Original colours" : modelTint}</span>
                    {modelTint !== "#ffffff" && (
                      <button className="galleries-open-button" style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" }} onClick={() => setModelTint("#ffffff")}>
                        Reset
                      </button>
                    )}
                  </div>
                  <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11 }}>Tint multiplies the model’s material colours. White keeps the original colours.</p>
                </div>
              </div>

              <div className="property-section">
                <label>SAVE TO LIBRARY</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input className="full-input" style={{ flex: "1 1 220px", height: 36 }} value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="Asset name" aria-label="Asset name" />
                  <button className="galleries-open-button" disabled={busy} onClick={() => void saveImportedModel()}>
                    {busy ? "Saving…" : "Save to library"}
                  </button>
                </div>
                <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
                  Only the name, file details and transform are saved. The .glb file itself is not stored server-side — keep the original file and re-attach it to preview again.
                </p>
              </div>
            </div>
          )}

          {!modelScene && !modelLoading && (
            <div className={styles.emptyBox}>
              <strong>No model loaded yet.</strong>
              <p>Upload a .glb or .gltf file (up to 50 MB) to preview it here with orbit controls, adjust its scale, rotation and tint, then save it to your library.</p>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------- IMAGE-TO-3D */}
      {tab === "image-to-3d" && (
        <div>
          <div className={styles.emptyBox} style={{ marginBottom: 16 }}>
            <strong>One honest limit, up front.</strong>
            <p>
              A single image cannot reconstruct hidden geometry — the back of an object, what sits behind it, or its true depth are not in the
              picture. What SANAA does here, without any external service, is a 2D texture and a depth-from-brightness approximation. True
              reconstruction needs several photos or a hosted AI service (see the provider section below).
            </p>
          </div>

          <div className="property-section">
            <label>PROVIDER</label>
            <select className="full-input" value={providerId} onChange={(event) => setProviderId(event.target.value)} aria-label="Image-to-3D provider">
              {[{ id: "none", label: localApproximationProvider.label }, ...EXTERNAL_PROVIDER_SLOTS.map((slot) => ({ id: slot.id, label: `${slot.label} — not connected` }))].map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
              {selectedSlot ? (
                <>
                  <strong style={{ color: "var(--ink)" }}>Not connected — setup required.</strong> {selectedSlot.setup ?? selectedSlot.note}
                  <br />
                  <a href={selectedSlot.docs} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                    {selectedSlot.docs} ↗
                  </a>
                </>
              ) : (
                provider.setupInstructions()
              )}
            </p>
          </div>

          <div className="property-section">
            <label>MODE — WHAT EACH ONE REALLY DOES</label>
            <div style={{ display: "grid", gap: 8 }}>
              {IMAGE3D_MODES.map((item) => (
                <label key={item.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid var(--border)", borderRadius: 6, padding: 10, opacity: item.available ? 1 : 0.6, cursor: item.available ? "pointer" : "not-allowed" }}>
                  <input type="radio" name="image3d-mode" checked={mode === item.id} disabled={!item.available} onChange={() => setMode(item.id)} style={{ marginTop: 3 }} />
                  <span>
                    <strong style={{ fontSize: 13 }}>
                      {item.label} {!item.available && "— needs an external service"}
                    </strong>
                    <br />
                    <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>{item.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="property-section">
            <label>UPLOAD AN IMAGE — JPG, PNG OR WEBP, MAX {formatBytes(MAX_ASSET_FILE_BYTES)}</label>
            <input
              ref={imageInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImageFile(file);
                event.target.value = "";
              }}
            />
            <button className="galleries-open-button" onClick={() => imageInputRef.current?.click()}>
              Choose an image
            </button>
            {imageFile && (
              <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11 }}>
                {imageFile.name} · {formatBytes(imageFile.size)} (downscaled to at most 1024 px for storage)
              </p>
            )}
            {imageError && (
              <p role="alert" style={{ margin: "8px 0 0", color: "#a33", fontSize: 12 }}>
                {imageError}
              </p>
            )}
          </div>

          {imageUrl && (
            <div>
              {mode === "2d-texture" && (
                <div className="property-section">
                  <label>SHAPE</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["plane", "box"] as const).map((shape) => (
                      <button
                        key={shape}
                        className="galleries-open-button"
                        style={textureShape === shape ? undefined : { background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" }}
                        onClick={() => setTextureShape(shape)}
                      >
                        {shape === "plane" ? "Flat panel" : "Box"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {mode === "depth-approximation" && (
                <div className="property-section">
                  <label>
                    RELIEF DEPTH — {Math.round(depthStrength * 100)}%
                  </label>
                  <input type="range" min={0.1} max={1} step={0.05} value={depthStrength} onChange={(event) => setDepthStrength(Number(event.target.value))} style={{ width: "100%", maxWidth: 320 }} aria-label="Relief depth" />
                  <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11 }}>Bright areas rise, dark areas sink. This is an artistic relief — it guesses depth from brightness and cannot know the real shape.</p>
                </div>
              )}

              <div style={{ height: 380, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", background: "#111" }}>
                <Canvas camera={{ position: [0, 0.4, 3.4], fov: 45 }} dpr={[1, 2]}>
                  <ambientLight intensity={0.8} />
                  <directionalLight position={[4, 6, 4]} intensity={1.2} />
                  {mode === "2d-texture" ? <TexturedPanel imageUrl={imageUrl} shape={textureShape} /> : <DepthRelief imageUrl={imageUrl} depthStrength={depthStrength} />}
                  <OrbitControls makeDefault />
                </Canvas>
              </div>
              <p style={{ margin: "8px 0", color: "var(--muted)", fontSize: 11 }}>Drag to orbit, scroll to zoom.</p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="galleries-open-button" disabled={imageBusy} onClick={() => void runImageTo3D()}>
                  {imageBusy ? "Working…" : `Generate — ${selectedMode?.label ?? mode}`}
                </button>
                <button className="galleries-open-button" style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" }} disabled={busy} onClick={() => void saveImageResult()}>
                  {busy ? "Saving…" : "Save result to library"}
                </button>
              </div>
              {resultNote && (
                <p role="status" style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.6 }}>
                  {resultNote}
                </p>
              )}
            </div>
          )}

          {imageBusy && !imageUrl && (
            <div className={styles.emptyBox}>
              <strong>Reading your image…</strong>
            </div>
          )}

          <div className="property-section">
            <label>CONNECT AN EXTERNAL SERVICE — DOCUMENTED SLOTS</label>
            <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
              No external provider is connected yet, so the three reconstruction modes stay unavailable rather than pretending to work. To enable
              one, implement the <code>Image3DProvider</code> interface in <code>lib/asset-library.ts</code> and register it in{" "}
              <code>image3DProviders</code>. Cloud services need their own account and API key, billed per generation; RealityCapture /
              RealityScan is different — it is desktop software licensed through an Epic Games account, with no API key at all.
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {EXTERNAL_PROVIDER_SLOTS.map((slot) => (
                <li key={slot.id} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 12 }}>
                  <strong style={{ fontSize: 13 }}>
                    {slot.label} — not connected
                  </strong>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
                    {slot.setup ?? slot.note}
                    <br />
                    {slot.envVars.length > 0 && (
                      <>
                        Environment: <code>{slot.envVars.join(" · ")}</code>
                        <br />
                      </>
                    )}
                    <a href={slot.docs} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                      {slot.docs} ↗
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
