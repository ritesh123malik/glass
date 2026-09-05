/**
 * analyze-skin.tsx
 * ----------------
 * Photo skin analysis page. Two-state UX:
 *
 *   1. Upload  — drag/drop or file picker (or "Use camera"), client-side
 *                compression to max 1024px @ 0.85 quality, then POST to
 *                /api/analyze-skin (which proxies to FastAPI).
 *   2. Results — SkinAnalysis summary, a recommended-routine card list
 *                built from the recommended_handles, and a CTA into the
 *                product catalog.
 *
 * Privacy: images never persist anywhere. They go browser → Hydrogen
 * resource route → FastAPI `/ai/analyze-skin` → discarded. The browser
 * preview lives only in component state until the user closes the page.
 *
 * Styling: iOS glassmorphism (default theme). The drop zone uses a
 * dashed sand border that lifts to tan on hover. Progress bar is a
 * thin glass-tan bar (iOS-style). Results render in `glass-card-lg`
 * panels, mirroring the skin-quiz results view.
 */

import { useRef, useState } from "react";
import type { MetaFunction } from "@remix-run/node";
import {
  type AnalyzeSkinResult,
  type SkinAnalysis,
} from "~/lib/types";

// ─── Page meta ───────────────────────────────────────────────────────────

export const meta: MetaFunction = () => [
  { title: "Photo Skin Analysis — Glass Skincare" },
  {
    name: "description",
    content:
      "Upload a selfie and get an AI-powered skin analysis with personalized product recommendations.",
  },
];

// ─── Constants ───────────────────────────────────────────────────────────

/** Max dimension for client-side compression (longest edge). */
const MAX_DIMENSION = 1024;
/** toDataURL quality (0..1). */
const JPEG_QUALITY = 0.85;
/** Soft cap on raw file size before compression — reject early. */
const RAW_MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const SKIN_TYPE_LABELS: Record<string, string> = {
  oily: "Oily",
  dry: "Dry",
  combination: "Combination",
  normal: "Normal",
  sensitive: "Sensitive",
};

// ─── Component ───────────────────────────────────────────────────────────

export default function AnalyzeSkinRoute() {
  const [phase, setPhase] = useState<"upload" | "results">("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0); // 0..100
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnalyzeSkinResult | null>(null);

  function reset() {
    setPhase("upload");
    setPreview(null);
    setError(null);
    setProgress(0);
    setSubmitting(false);
    setResult(null);
  }

  function handleFile(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG, or WebP).");
      return;
    }
    if (file.size > RAW_MAX_BYTES) {
      setError("Image must be 8 MB or smaller before compression.");
      return;
    }

    compressImage(file)
      .then(({ dataUrl }) => {
        setPreview(dataUrl);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Could not read image.";
        setError(msg);
      });
  }

  async function submit() {
    if (!preview) return;
    setSubmitting(true);
    setError(null);
    setProgress(15); // immediate feedback

    try {
      // Convert the data URL preview back to a Blob for multipart upload.
      const blob = await dataUrlToBlob(preview);
      const file = new File([blob], "selfie.jpg", {
        type: blob.type || "image/jpeg",
      });

      const form = new FormData();
      form.append("image", file);

      // Use XHR (not fetch) so we can show real upload progress.
      const resp = await xhrUpload("/api/analyze-skin", form, (pct) => {
        setProgress(15 + Math.round(pct * 0.7)); // 15..85% = upload
      });

      if (!resp.ok) {
        let detail = resp.statusText;
        try {
          const body = (await resp.json()) as { error?: string };
          if (body?.error) detail = body.error;
        } catch {
          // fall through
        }
        throw new Error(detail || `Upload failed (${resp.status})`);
      }

      setProgress(100);
      const data = (await resp.json()) as AnalyzeSkinResult;
      setResult(data);
      setPhase("results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Results view ───────────────────────────────────────────────────
  if (phase === "results" && result) {
    return (
      <ResultsView analysis={result.analysis} handles={result.recommended_handles} onRestart={reset} />
    );
  }

  // ─── Upload view ────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-glass-cream">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-glass-sand">
        <a href="/" className="font-serif text-2xl text-glass-charcoal">
          Glass Skincare
        </a>
        <nav className="flex gap-6 text-sm text-glass-brown">
          <a href="/skin-quiz" className="hover:text-glass-charcoal transition-colors">
            Prefer a quiz?
          </a>
        </nav>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <div className="text-center mb-10">
          <span className="inline-block bg-glass-tan/30 text-glass-brown text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full font-sans font-medium border border-glass-tan/40">
            Photo Analysis
          </span>
          <h1 className="font-serif text-4xl md:text-5xl text-glass-charcoal mt-4 leading-tight">
            Let AI read your skin
          </h1>
          <p className="font-sans text-glass-brown mt-3 max-w-xl mx-auto">
            Upload a clear, well-lit selfie. Our AI analyzes skin type,
            concerns, and hydration — then suggests products for you.
          </p>
        </div>

        <div className="glass-card-lg rounded-3xl px-6 md:px-10 py-10 md:py-12 shadow-glass-lg">
          <UploadZone
            preview={preview}
            onFile={handleFile}
            disabled={submitting}
          />

          {/* Progress bar (iOS-style) — visible only while submitting */}
          {submitting && (
            <div className="mt-6" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="h-1 w-full rounded-full bg-glass-sand/60 overflow-hidden">
                <div
                  className="h-full bg-glass-tan transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-glass-brown font-sans text-center uppercase tracking-widest">
                {progress < 85
                  ? "Uploading…"
                  : progress < 100
                    ? "Analyzing your skin…"
                    : "Done"}
              </p>
            </div>
          )}

          {/* Privacy notice */}
          <p className="mt-6 text-xs text-glass-brown/80 font-sans text-center">
            <span className="font-medium">Privacy:</span> Your image is
            analyzed by AI, then discarded. We never store or share your photo.
          </p>

          {error && (
            <div className="mt-6 glass-card border border-red-300/60 text-sm text-red-700 px-4 py-3 rounded-xl font-sans">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="mt-8 flex items-center justify-end gap-4">
            {preview && !submitting && (
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setError(null);
                  setProgress(0);
                }}
                className="glass-button px-5 py-3 text-sm text-glass-charcoal font-sans font-medium active:scale-95 transition-transform"
              >
                Choose another
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!preview || submitting}
              className="glass-button px-6 py-3 text-sm text-glass-charcoal font-sans font-medium disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Spinner /> Analyzing…
                </>
              ) : (
                "Analyze my skin"
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-glass-brown/70 font-sans mt-6">
          For best results: natural light, no makeup, face the camera straight-on.
        </p>
      </div>
    </main>
  );
}

// ─── Upload zone (drag/drop + file + camera) ─────────────────────────────

function UploadZone({
  preview,
  onFile,
  disabled,
}: {
  preview: string | null;
  onFile: (f: File) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function pickFile() {
    inputRef.current?.click();
  }

  function pickCamera() {
    cameraRef.current?.click();
  }

  // Preview mode — show compressed image with a "Replace" affordance.
  if (preview) {
    return (
      <div className="relative rounded-2xl overflow-hidden border-2 border-glass-tan/40 bg-glass-blur backdrop-blur-glass shadow-glass">
        <img
          src={preview}
          alt="Selected selfie preview"
          className="w-full max-h-[480px] object-contain bg-glass-sand/30"
        />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={pickFile}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        disabled={disabled}
        className={`w-full rounded-2xl border-2 border-dashed px-6 py-12 md:py-16 text-center transition-colors duration-200 backdrop-blur-glass ${
          dragActive
            ? "bg-glass-tan/15 border-glass-tan"
            : "bg-glass-blur border-glass-sand hover:border-glass-tan"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        aria-label="Upload a selfie"
      >
        <UploadGlyph />
        <div className="mt-4 font-serif text-xl text-glass-charcoal">
          Drop a selfie here
        </div>
        <div className="mt-1 font-sans text-sm text-glass-brown">
          or tap to choose a file
        </div>
        <div className="mt-1 font-sans text-xs text-glass-brown/70">
          JPG, PNG, or WebP — up to 8 MB
        </div>
      </button>

      {/* Hidden file inputs — one for gallery, one with capture for camera */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = ""; // allow re-picking the same file
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={pickCamera}
          disabled={disabled}
          className="glass-button px-5 py-2.5 text-sm text-glass-charcoal font-sans font-medium active:scale-95 transition-transform disabled:opacity-40 flex items-center gap-2"
        >
          <CameraGlyph />
          Use camera
        </button>
      </div>
    </div>
  );
}

// ─── Results view ───────────────────────────────────────────────────────

function ResultsView({
  analysis,
  handles,
  onRestart,
}: {
  analysis: SkinAnalysis;
  handles: string[];
  onRestart: () => void;
}) {
  return (
    <main className="min-h-screen bg-glass-cream">
      <header className="flex items-center justify-between px-8 py-6 border-b border-glass-sand">
        <a href="/" className="font-serif text-2xl text-glass-charcoal">
          Glass Skincare
        </a>
        <nav className="flex gap-6 text-sm text-glass-brown">
          <button
            type="button"
            onClick={onRestart}
            className="hover:text-glass-charcoal transition-colors font-sans"
          >
            Analyze another photo
          </button>
        </nav>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12 md:py-20">
        <div className="text-center mb-10">
          <span className="inline-block bg-glass-tan/30 text-glass-brown text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full font-sans font-medium border border-glass-tan/40">
            Your Skin Analysis
          </span>
          <h1 className="font-serif text-4xl md:text-5xl text-glass-charcoal mt-4 leading-tight">
            Here's what we saw
          </h1>
        </div>

        {/* Analysis summary */}
        <div className="glass-card-lg rounded-3xl p-8 md:p-10 shadow-glass-lg mb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Stat
              label="Skin type"
              value={SKIN_TYPE_LABELS[analysis.skin_type] ?? prettify(analysis.skin_type)}
            />
            <Stat
              label="Confidence"
              value={
                typeof analysis.confidence === "number"
                  ? `${Math.round(analysis.confidence * 100)}%`
                  : "—"
              }
            />
            <Stat
              label="Overall health"
              value={prettify(analysis.overall_skin_health)}
              small
            />
          </div>

          {analysis.concerns.length > 0 && (
            <div className="mt-8 pt-6 border-t border-glass-sand/40">
              <div className="text-[10px] uppercase tracking-widest text-glass-brown/70 font-sans mb-3">
                Concerns detected
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.concerns.map((c) => (
                  <span
                    key={c}
                    className="glass-pill text-sm text-glass-charcoal font-sans px-3 py-1.5"
                  >
                    {prettify(c)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Routine cards (recommended products) */}
        <div className="glass-card-lg rounded-3xl p-8 md:p-10 shadow-glass-lg mb-10">
          <div className="flex items-center gap-3 mb-6">
            <SparkleIcon />
            <h2 className="font-serif text-2xl text-glass-charcoal">
              Recommended for you
            </h2>
          </div>
          {handles.length === 0 ? (
            <p className="font-sans text-sm text-glass-brown/80">
              No specific product matches yet. Try the skin quiz for a tailored
              routine.
            </p>
          ) : (
            <ol className="space-y-3">
              {handles.map((handle, i) => (
                <li
                  key={handle}
                  className="flex gap-4 p-4 rounded-2xl glass-card border-glass-sand/50"
                >
                  <div className="flex-shrink-0 h-9 w-9 rounded-full bg-glass-tan text-glass-white font-serif font-medium flex items-center justify-center">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-glass-brown/70 font-sans">
                        Step {i + 1}
                      </span>
                      <h3 className="font-serif text-lg text-glass-charcoal">
                        {prettify(handle.replace(/-/g, " "))}
                      </h3>
                    </div>
                    <a
                      href={`/products/${handle}`}
                      className="font-sans text-sm text-glass-brown underline underline-offset-2 hover:text-glass-charcoal transition-colors"
                    >
                      View product →
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* CTA */}
        <div className="text-center">
          <a
            href="/products"
            className="inline-block glass-button px-8 py-4 font-sans font-medium text-sm text-glass-charcoal shadow-glass hover:shadow-glass-lg transition-all active:scale-95"
          >
            Find more products for me
          </a>
          <p className="text-xs text-glass-brown/70 font-sans mt-4">
            Browse the full catalog or retake the photo to refine suggestions.
          </p>
        </div>
      </div>
    </main>
  );
}

// ─── Tiny presentational pieces ──────────────────────────────────────────

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-glass-brown/70 font-sans mb-2">
        {label}
      </div>
      <div
        className={`font-serif text-glass-charcoal leading-snug ${
          small ? "text-base md:text-lg" : "text-2xl md:text-3xl"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Compresses an image File to max-dim JPEG via canvas. */
async function compressImage(file: File): Promise<{ dataUrl: string; type: string }> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  // Compute target dimensions — preserve aspect, cap longest edge.
  const ratio = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const targetW = Math.max(1, Math.round(img.width * ratio));
  const targetH = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available in this browser.");
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Always re-encode as JPEG for consistent upstream handling & smaller size.
  const jpeg = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { dataUrl: jpeg, type: "image/jpeg" };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image."));
    img.src = src;
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Uploads via XHR so we can report progress. Returns the XHR Response-like. */
function xhrUpload(
  url: string,
  form: FormData,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress((e.loaded / e.total) * 100);
      }
    };
    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
        json: async () => {
          try {
            return JSON.parse(xhr.responseText);
          } catch {
            return null;
          }
        },
      });
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(form);
  });
}

function prettify(input: string): string {
  if (!input) return "";
  return input
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Icons ───────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function UploadGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto h-10 w-10 text-glass-tan"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CameraGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 text-glass-tan"
      aria-hidden="true"
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  );
}