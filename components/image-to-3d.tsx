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
  FAB_LICENSES,
  IMAGE3D_MODES,
  MARKETPLACE_REFERENCES,
  MAX_ASSET_FILE_BYTES,
  PUBLIC_DOMAIN_REFERENCES,
  fabLicenseRequiresAttribution,
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
import {
  DirectUploadFailedError,
  DirectUploadNotConfiguredError,
  uploadFileToR2,
} from "@/lib/direct-upload";

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
  const [form, setForm] = useState({ name: "", creator: "", license: "CC0: Public Domain" as AssetLicense, attribution: "", sourceUrl: "", notes: "" });

  // Fab catalogue form — metadata only, link out. The licence is required
  // and never assumed; paid assets are labelled PAID and never included
  // by default.
  const [fabForm, setFabForm] = useState({
    url: "",
    name: "",
    creator: "",
    license: "" as AssetLicense | "",
    attribution: "",
    price: "free" as "free" | "paid",
    priceAmount: "",
    format: "GLB",
    polyCount: "",
    notes: "",
  });
  const [fabError, setFabError] = useState<string | null>(null);

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

  // The GLB just saved to R2 (its serving URL + name), for "add to an
  // exhibition" below. Cleared when a different model is loaded.
  const [savedSculptureUrl, setSavedSculptureUrl] = useState<string | null>(null);
  const [savedSculptureName, setSavedSculptureName] = useState("");
  const [exhibitions, setExhibitions] = useState<{ id: string; title: string }[]>([]);
  const [selectedExhibitionId, setSelectedExhibitionId] = useState("");
  const [exhibitionsLoading, setExhibitionsLoading] = useState(false);
  const [exhibitionsError, setExhibitionsError] = useState<string | null>(null);

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
    setForm({ name: "", creator: "", license: "CC0: Public Domain", attribution: "", sourceUrl: "", notes: "" });
  }

  async function addFabAsset() {
    setFabError(null);
    const url = fabForm.url.trim();
    if (!url || !/fab\.com/i.test(url)) {
      setFabError("Paste the Fab asset page URL (a fab.com link). Lakisa catalogues the metadata and links out, it never downloads or re-hosts the file.");
      return;
    }
    if (!fabForm.name.trim()) {
      setFabError("Give the asset a title first, copy it from the Fab listing.");
      return;
    }
    if (!fabForm.license) {
      setFabError("Choose the licence exactly as shown on the Fab listing. Never assume an asset is free to use, “free” on Fab does not mean usable for anything.");
      return;
    }
    if (fabForm.price === "paid" && !fabForm.priceAmount.trim()) {
      setFabError("This asset is paid, record its price as shown on the Fab listing.");
      return;
    }
    if (fabForm.license && fabLicenseRequiresAttribution(fabForm.license) && !fabForm.attribution.trim()) {
      setFabError("This licence is CC-BY: attribution is required. Paste the credit text the listing asks for (creator name, link to the licence, note of any changes).");
      return;
    }
    const polyCount = fabForm.polyCount.trim() ? Number(fabForm.polyCount.replace(/[^0-9]/g, "")) : undefined;
    if (fabForm.polyCount.trim() && (!polyCount || Number.isNaN(polyCount))) {
      setFabError("Poly count must be a number (triangles), or leave it blank if the listing does not state one.");
      return;
    }
    const record: Asset3DRecord = {
      kind: "model",
      source: "fab",
      name: fabForm.name.trim(),
      creator: fabForm.creator.trim() || "Unknown",
      license: fabForm.license,
      attribution: fabForm.attribution.trim(),
      downloadDate: new Date().toISOString().slice(0, 10),
      sourceUrl: url,
      price: fabForm.price,
      priceAmount: fabForm.price === "paid" ? fabForm.priceAmount.trim() : undefined,
      format: fabForm.format,
      polyCount,
      notes: fabForm.notes.trim() || undefined,
      mode: "reference",
    };
    await saveAsset(record, record.name);
    setFabForm({ url: "", name: "", creator: "", license: "", attribution: "", price: "free", priceAmount: "", format: "GLB", polyCount: "", notes: "" });
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
    setSavedSculptureUrl(null);
    setSavedSculptureName("");
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
    // The GLB itself is stored server-side now (R2, sculptures/…):
    // upload first, then save the record with its serving URL, so the
    // model can be added to an exhibition from the library without
    // re-attaching the file. A failed upload is an inline error, and
    // nothing is saved without its file.
    setBusy(true);
    setMessage(null);
    try {
      // Small models go through the sculpture proxy; heavy ones go
      // straight to R2 with a presigned PUT URL (see lib/direct-upload.ts).
      const proxyUpload = async (): Promise<string> => {
        const body = new FormData();
        body.set("file", modelFile);
        let response: Response;
        try {
          response = await fetch("/api/uploads/sculpture", { method: "POST", body });
        } catch {
          throw new Error("Could not upload this model. Check your connection and try again.");
        }
        const text = await response.text();
        let result: { error?: string; url?: string } = {};
        try {
          result = text ? (JSON.parse(text) as typeof result) : {};
        } catch {
          result = {};
        }
        if (!response.ok) {
          throw new Error(
            result.error ??
              (response.status === 413
                ? "This model is too large (over 4.5 MB). Try compressing it (Draco or meshopt in Blender, or gltfpack) or a simpler model."
                : "Could not upload this model."),
          );
        }
        if (!result.url) throw new Error("Could not upload this model.");
        return result.url;
      };
      let url: string;
      try {
        url = await uploadFileToR2(modelFile, "sculpture", proxyUpload);
      } catch (error) {
        if (error instanceof DirectUploadFailedError) {
          throw new Error("The direct upload could not reach storage. Check your connection and try again.");
        }
        if (error instanceof DirectUploadNotConfiguredError) {
          throw new Error("Could not upload this model.");
        }
        throw error;
      }
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
        sculptureUrl: url,
        transform: { scale: modelScale, rotationY: modelRotation, tint: modelTint },
        notes: "Stored in R2, add it to an exhibition from here or from the editor's library picker.",
      };
      await saveAsset(record, record.name);
      setSavedSculptureUrl(url);
      setSavedSculptureName(record.name);
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "Could not save this model.");
      setBusy(false);
    }
  }

  // --- Add a saved sculpture to an exhibition ---------------------------
  // The model is already in R2 (sculptureUrl): adding it is one
  // Artwork row (POST /api/artworks) in the exhibition's first room,
  // standing on the floor at the room's centre — the editor moves it
  // from there. Errors are inline, never window.alert.

  async function loadExhibitionsForSculpture() {
    setExhibitionsLoading(true);
    setExhibitionsError(null);
    try {
      const response = await fetch("/api/exhibitions");
      const result = (await response.json().catch(() => ({}))) as { exhibitions?: { id: string; title: string }[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not load your exhibitions.");
      setExhibitions(result.exhibitions ?? []);
      if ((result.exhibitions ?? []).length > 0) setSelectedExhibitionId(result.exhibitions![0].id);
    } catch (error) {
      setExhibitionsError(error instanceof Error ? error.message : "Could not load your exhibitions.");
    } finally {
      setExhibitionsLoading(false);
    }
  }

  async function addSavedSculptureToExhibition() {
    if (!savedSculptureUrl || !selectedExhibitionId) return;
    setBusy(true);
    setMessage(null);
    try {
      const detailResponse = await fetch(`/api/exhibitions/${encodeURIComponent(selectedExhibitionId)}`);
      const detail = (await detailResponse.json().catch(() => ({}))) as { exhibition?: { rooms?: { id: string }[] }; error?: string };
      if (!detailResponse.ok) throw new Error(detail.error ?? "Could not open that exhibition.");
      const roomId = detail.exhibition?.rooms?.[0]?.id ?? "room-main";
      const response = await fetch("/api/artworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exhibitionId: selectedExhibitionId,
          title: savedSculptureName || "Sculpture",
          medium: "Sculpture, GLB",
          dimensions: "60 × 190 cm",
          sculptureUrl: savedSculptureUrl,
          roomId,
          positionX: 0,
          positionY: 0,
          positionZ: 2,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not add this sculpture to the exhibition.");
      setMessage(`Added “${savedSculptureName || "Sculpture"}” to the exhibition, open the editor to move its pedestal.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add this sculpture to the exhibition.");
    } finally {
      setBusy(false);
    }
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
          ? "2D texture: the image applied to a panel. Flat, no geometry reconstructed."
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
                    <img src={asset.data.fileDataUrl} alt={asset.title} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 4, marginBottom: 10 }} loading="lazy" />
                  )}
                  <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{asset.title}</h3>
                  {asset.data.source === "fab" && (
                    <p style={{ margin: "0 0 6px" }}>
                      {asset.data.price === "paid" ? (
                        <span style={{ display: "inline-block", background: "#fbe9e7", color: "#8f1d1d", border: "1px solid #d98a7a", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>
                          PAID{asset.data.priceAmount ? `: ${asset.data.priceAmount}` : ""} · requires purchase, not included by default
                        </span>
                      ) : (
                        <span style={{ display: "inline-block", background: "#e8f3e8", color: "#1e5c1e", border: "1px solid #9cc79c", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>
                          FREE on Fab, check the licence before use
                        </span>
                      )}
                    </p>
                  )}
                  <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
                    {asset.data.kind} · {asset.data.source} · {asset.data.creator}
                    <br />
                    Licence: {asset.data.license}
                    {asset.data.source === "fab" && asset.data.format && (
                      <>
                        <br />
                        Format: {asset.data.format}
                        {asset.data.polyCount ? ` · ${asset.data.polyCount.toLocaleString()} triangles` : ""}
                      </>
                    )}
                    <br />
                    {asset.data.fileName ? `${asset.data.fileName}${asset.data.fileSizeBytes ? ` · ${formatBytes(asset.data.fileSizeBytes)}` : ""}` : "No file attached"}
                    <br />
                    Saved {asset.data.downloadDate}
                  </p>
                  {asset.data.sculptureUrl && (
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--ink)" }}>
                      GLB stored, ready to add to an exhibition (editor&apos;s library picker, or the Import tab).
                    </p>
                  )}
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
              Record the licence exactly as the source states it. Never claim an asset is free to use without its licence, when in doubt, pick “Unknown: do not use commercially”.
            </p>
            <button className="galleries-open-button" disabled={busy} onClick={() => void addManualAsset()}>
              {busy ? "Saving…" : "Add to library"}
            </button>
          </div>

          <div className="property-section">
            <label>CATALOGUE A FAB ASSET: METADATA ONLY, LINK OUT</label>
            <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
              Fab (fab.com) is Epic Games&apos; marketplace for 3D models, textures, materials and environments. Browse
              and acquire each asset on Fab itself, Lakisa records the listing&apos;s metadata and links back to it. It
              never copies, hotlinks or re-hosts Fab files, and there is no public Fab download API. Prefer Fab&apos;s
              FREE assets: use the price filter on fab.com. A paid asset is labelled PAID here and is never included by
              default. &ldquo;Free&rdquo; does not mean usable for anything, the licence on the listing decides.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              <input className="full-input" placeholder="Fab asset URL: fab.com/… *" value={fabForm.url} onChange={(event) => setFabForm({ ...fabForm, url: event.target.value })} aria-label="Fab asset URL" />
              <input className="full-input" placeholder="Asset title (from the listing) *" value={fabForm.name} onChange={(event) => setFabForm({ ...fabForm, name: event.target.value })} aria-label="Fab asset title" />
              <input className="full-input" placeholder="Creator / author" value={fabForm.creator} onChange={(event) => setFabForm({ ...fabForm, creator: event.target.value })} aria-label="Fab asset creator" />
              <select
                className="full-input"
                value={fabForm.license}
                onChange={(event) => setFabForm({ ...fabForm, license: event.target.value as AssetLicense | "" })}
                aria-label="Fab licence: required"
              >
                <option value="">Licence (from the listing): required *</option>
                {FAB_LICENSES.map((license) => (
                  <option key={license} value={license}>
                    {license}
                  </option>
                ))}
              </select>
              <select className="full-input" value={fabForm.price} onChange={(event) => setFabForm({ ...fabForm, price: event.target.value as "free" | "paid" })} aria-label="Price on Fab">
                <option value="free">FREE on Fab</option>
                <option value="paid">PAID: requires purchase</option>
              </select>
              {fabForm.price === "paid" && (
                <input className="full-input" placeholder="Price as listed, e.g. $12.00 *" value={fabForm.priceAmount} onChange={(event) => setFabForm({ ...fabForm, priceAmount: event.target.value })} aria-label="Price as listed" />
              )}
              <select className="full-input" value={fabForm.format} onChange={(event) => setFabForm({ ...fabForm, format: event.target.value })} aria-label="Format">
                {["GLB", "glTF", "FBX", "OBJ", "USD", "Other / varies"].map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
              <input className="full-input" placeholder="Poly count (triangles), if stated" value={fabForm.polyCount} onChange={(event) => setFabForm({ ...fabForm, polyCount: event.target.value })} aria-label="Poly count" inputMode="numeric" />
              <input className="full-input" placeholder="Attribution text (required for CC-BY)" value={fabForm.attribution} onChange={(event) => setFabForm({ ...fabForm, attribution: event.target.value })} aria-label="Attribution" />
              <input className="full-input" placeholder="Notes" value={fabForm.notes} onChange={(event) => setFabForm({ ...fabForm, notes: event.target.value })} aria-label="Fab notes" />
            </div>
            <p style={{ margin: "8px 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
              Licence rules, from Epic&apos;s Fab docs: the Fab Standard License (Personal / Professional tiers: Professional
              once you have generated more than $100,000 USD gross revenue from commercial activity in the last 12
              months) allows commercial use in a work but not reselling or redistributing the asset on its own, and does
              not require attribution. CC-BY is free but requires credit, a link to the licence, and a note of any
              changes. When in doubt, pick &ldquo;Fab Standard: tier not confirmed&rdquo; and check the listing before
              using the asset.
            </p>
            {fabError && (
              <p role="alert" style={{ margin: "0 0 8px", color: "#a33", fontSize: 12 }}>
                {fabError}
              </p>
            )}
            <button className="galleries-open-button" disabled={busy} onClick={() => void addFabAsset()}>
              {busy ? "Saving…" : "Catalogue Fab asset"}
            </button>
          </div>

          <div className="property-section">
            <label>REFERENCE LINKS: LINK OUT, DO NOT RE-HOST</label>
            <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
              Starter sources for free 3D assets, plus marketplaces below. These are links to other sites, Lakisa does not copy or host their files. Always check the licence on the file page itself before using an asset.
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
            <h3 style={{ fontSize: 13, margin: "18px 0 6px" }}>Marketplaces: per-asset licence, link out only</h3>
            <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
              Marketplace assets are not free by default: each one has its own licence and price. Record the asset URL
              and licence in your library like any other source, Lakisa never re-hosts marketplace files.
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
            <label>UPLOAD A .GLB / .GLTF MODEL: MAX {formatBytes(MAX_ASSET_FILE_BYTES)}</label>
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
                    SCALE: {modelScale.toFixed(2)}×
                  </label>
                  <input type="range" min={0.1} max={5} step={0.05} value={modelScale} onChange={(event) => setModelScale(Number(event.target.value))} style={{ width: "100%" }} aria-label="Scale" />
                </div>
                <div className="property-section">
                  <label>
                    ROTATION: {Math.round((modelRotation * 180) / Math.PI)}°
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
                  Saving uploads the .glb itself to your storage (4.5 MB maximum, compress it with Draco or meshopt in Blender if it is
                  larger) and records it in your library, so it can be added to an exhibition without re-attaching the file. A .gltf previews
                  here but cannot be stored, re-export it as .glb first.
                </p>
              </div>

              {savedSculptureUrl && (
                <div className="property-section">
                  <label>ADD TO AN EXHIBITION</label>
                  <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
                    “{savedSculptureName}” is saved. Add it to an exhibition, it stands on its pedestal at the first room&apos;s centre, and
                    you move the pedestal in the editor.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {exhibitions.length === 0 ? (
                      <button className="galleries-open-button" disabled={busy || exhibitionsLoading} onClick={() => void loadExhibitionsForSculpture()}>
                        {exhibitionsLoading ? "Loading…" : "Load my exhibitions"}
                      </button>
                    ) : (
                      <>
                        <select
                          className="full-input"
                          style={{ flex: "1 1 220px", height: 36 }}
                          value={selectedExhibitionId}
                          onChange={(event) => setSelectedExhibitionId(event.target.value)}
                          aria-label="Exhibition"
                        >
                          {exhibitions.map((exhibition) => (
                            <option key={exhibition.id} value={exhibition.id}>
                              {exhibition.title}
                            </option>
                          ))}
                        </select>
                        <button className="galleries-open-button" disabled={busy || !selectedExhibitionId} onClick={() => void addSavedSculptureToExhibition()}>
                          {busy ? "Adding…" : "Add to this exhibition"}
                        </button>
                      </>
                    )}
                  </div>
                  {exhibitionsError && (
                    <p role="alert" style={{ margin: "8px 0 0", color: "#a33", fontSize: 12 }}>
                      {exhibitionsError}
                    </p>
                  )}
                  {exhibitions.length === 0 && !exhibitionsLoading && !exhibitionsError && (
                    <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11 }}>
                      No exhibitions yet. Create one from the dashboard first, or add the sculpture later from the editor&apos;s library picker.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {!modelScene && !modelLoading && (
            <div className={styles.emptyBox}>
              <strong>No model loaded yet.</strong>
              <p>Upload a .glb or .gltf file (up to 50 MB) to preview it here with orbit controls, adjust its scale, rotation and tint, then save it to your library. Saving stores a .glb up to 4.5 MB server-side.</p>
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
              A single image cannot reconstruct hidden geometry: the back of an object, what sits behind it, or its true depth are not in the
              picture. What Lakisa does here, without any external service, is a 2D texture and a depth-from-brightness approximation. True
              reconstruction needs several photos or a hosted AI service (see the provider section below).
            </p>
          </div>

          <div className="property-section">
            <label>PROVIDER</label>
            <select className="full-input" value={providerId} onChange={(event) => setProviderId(event.target.value)} aria-label="Image-to-3D provider">
              {[{ id: "none", label: localApproximationProvider.label }, ...EXTERNAL_PROVIDER_SLOTS.map((slot) => ({ id: slot.id, label: `${slot.label}: not connected` }))].map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
              {selectedSlot ? (
                <>
                  <strong style={{ color: "var(--ink)" }}>Not connected, setup required.</strong> {selectedSlot.setup ?? selectedSlot.note}
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
            <label>MODE: WHAT EACH ONE REALLY DOES</label>
            <div style={{ display: "grid", gap: 8 }}>
              {IMAGE3D_MODES.map((item) => (
                <label key={item.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid var(--border)", borderRadius: 6, padding: 10, opacity: item.available ? 1 : 0.6, cursor: item.available ? "pointer" : "not-allowed" }}>
                  <input type="radio" name="image3d-mode" checked={mode === item.id} disabled={!item.available} onChange={() => setMode(item.id)} style={{ marginTop: 3 }} />
                  <span>
                    <strong style={{ fontSize: 13 }}>
                      {item.label} {!item.available && "Needs an external service"}
                    </strong>
                    <br />
                    <span style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>{item.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="property-section">
            <label>UPLOAD AN IMAGE: JPG, PNG OR WEBP, MAX {formatBytes(MAX_ASSET_FILE_BYTES)}</label>
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
                    RELIEF DEPTH: {Math.round(depthStrength * 100)}%
                  </label>
                  <input type="range" min={0.1} max={1} step={0.05} value={depthStrength} onChange={(event) => setDepthStrength(Number(event.target.value))} style={{ width: "100%", maxWidth: 320 }} aria-label="Relief depth" />
                  <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11 }}>Bright areas rise, dark areas sink. This is an artistic relief, it guesses depth from brightness and cannot know the real shape.</p>
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
                  {imageBusy ? "Working…" : `Generate: ${selectedMode?.label ?? mode}`}
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
              <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
                Saving keeps the image/texture in your library. It is not a GLB sculpture, for a 3D model in an exhibition, use the Import
                tab with a .glb file (Blender export, RealityScan, or a downloaded model).
              </p>
            </div>
          )}

          {imageBusy && !imageUrl && (
            <div className={styles.emptyBox}>
              <strong>Reading your image…</strong>
            </div>
          )}

          <div className="property-section">
            <label>CONNECT AN EXTERNAL SERVICE: DOCUMENTED SLOTS</label>
            <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
              No external provider is connected yet, so the three reconstruction modes stay unavailable rather than pretending to work. To enable
              one, implement the <code>Image3DProvider</code> interface in <code>lib/asset-library.ts</code> and register it in{" "}
              <code>image3DProviders</code>. Cloud services need their own account and API key, billed per generation; RealityCapture /
              RealityScan is different, it is desktop software licensed through an Epic Games account, with no API key at all.
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {EXTERNAL_PROVIDER_SLOTS.map((slot) => (
                <li key={slot.id} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 12 }}>
                  <strong style={{ fontSize: 13 }}>
                    {slot.label}: not connected
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

          <div className="property-section">
            <label>PHOTOGRAMMETRY WORKFLOW: REALITYCAPTURE / REALITYSCAN (FREE)</label>
            <p style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.6, background: "#f6f1ea", border: "1px solid var(--border)", borderRadius: 6, padding: 10 }}>
              <strong>Runs OUTSIDE the browser, on your own computer.</strong> Nothing in this workflow is simulated
              inside Lakisa: you photograph a real space or object, RealityScan (Epic Games&apos; desktop
              photogrammetry app, formerly RealityCapture, renamed at version 2.0, June 2025) rebuilds it into a 3D
              model on your machine, and you import the finished .glb back here. RealityScan is free for students,
              educators and individuals / businesses under $1M USD annual gross revenue; above that it is a paid seat
              per user per year, the licensing page is the price of record. It runs on 64-bit Windows, and on Linux
              for command-line workflows only (no macOS version). Install it from the Epic Games Launcher (Unreal
              Engine section) with an Epic Games account. There is also RealityScan Mobile, a free phone app for iOS
              and Android that captures and processes on the device.
            </p>
            <ol style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 12, lineHeight: 1.8, display: "grid", gap: 12 }}>
              <li>
                <strong>1 · Photograph the space or object.</strong> Walk around the subject and photograph it from
                every angle: front, back, top, sides and diagonals, at several heights. A small object typically takes
                dozens of photos; a whole gallery room takes many more. Every point of the subject should appear in at
                least two photos, and consecutive shots should overlap by about 60–80% (Epic&apos;s Capturing Reality
                team recommends up to 80% overlap in every direction). Light it evenly and diffusely (an overcast day
                outdoors, or soft even light indoors) and keep the light constant while you shoot. Avoid hard shadows,
                reflections, shiny or transparent surfaces, and anything moving. Use sharp, well-exposed photos at low
                ISO with no motion blur; a fixed focal length helps, and the subject should fill most of the frame.
                What to photograph: a real gallery space (walls, floor, openings) or a single artwork / object you want
                as a 3D model.
              </li>
              <li>
                <strong>2 · Process in RealityScan (desktop).</strong> Import the photos, then run <em>Align</em>, the
                software finds where each photo was taken, then reconstruct the mesh and calculate the texture. Check
                the alignment first: if the photos split into separate unaligned groups, add more overlapping shots of
                the gaps and align again. This is the heavy step and it is GPU-accelerated (NVIDIA, and AMD since
                version 2.2), so it runs on a machine with a real graphics card. A headless command-line build exists
                for scripted processing on Windows or Linux.
              </li>
              <li>
                <strong>3 · Simplify the mesh for the web.</strong> A raw scan has millions of triangles, far too
                many for a browser. In RealityScan, go to SCENE 3D / TOOLS → <em>Simplify</em> and set an absolute
                target triangle count; it creates a new simplified model and keeps the original. Then <em>retexture</em>{" "}
                the simplified model: a simplified model must be retextured before its textures can be exported with
                it. Aim for a file well under Lakisa&apos;s 50 MB import limit.
              </li>
              <li>
                <strong>4 · Export mesh + textures as GLB / glTF.</strong> Export → Model &amp; Point Cloud → Binary
                GL Transmission Format (.glb), with &ldquo;Export textures&rdquo; on. GLB is one file with the textures
                embedded, which is why Lakisa imports it directly. (RealityScan also exports OBJ, FBX, USD, PLY, STL
                and more, GLB is the web-ready choice.) RealityScan Mobile exports GLB directly on Android, and USDZ
                / OBJ on iOS.
              </li>
              <li>
                <strong>5 · Import the GLB into Lakisa.</strong> Open the &ldquo;Import .glb / .gltf&rdquo; tab above,
                choose the exported .glb (max 50 MB), preview it with orbit controls, adjust scale, rotation and tint,
                then save it to your asset library. The library keeps the name, file details and transform, keep the
                original .glb file on disk and re-attach it to preview again.
              </li>
            </ol>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
              Sources: Epic&apos;s RealityScan pages,{" "}
              <a href="https://www.realityscan.com" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                realityscan.com ↗
              </a>{" "}
              ·{" "}
              <a href="https://www.realityscan.com/license" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                Licensing (price of record) ↗
              </a>{" "}
              ·{" "}
              <a href="https://rshelp.capturingreality.com/en-US/tools/export.htm" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                Model export help ↗
              </a>
              . Capture guidance (overlap, lighting, coverage) follows Epic&apos;s Capturing Reality team
              recommendations in the Epic Developer Community forums; where Epic gives no exact number (such as how
              many photos a room needs), this guide says so instead of inventing one.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
