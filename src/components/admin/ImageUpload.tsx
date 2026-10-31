"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";

const MAX = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"];

/**
 * Uploads to the public-media Supabase Storage bucket (staff-only write via
 * storage RLS) and puts the public URL into a hidden form field.
 */
export function ImageUpload({
  name,
  folder,
  initial,
  label = "Image",
  sourceName,
  initialSource,
}: {
  name: string;
  folder: string;
  initial?: string | null;
  label?: string;
  /** optional hidden field recording where the image came from ("upload" after a manual upload) */
  sourceName?: string;
  initialSource?: string | null;
}) {
  const [url, setUrl] = useState(initial ?? "");
  const [source, setSource] = useState(initialSource ?? "upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    if (!TYPES.includes(file.type)) return setError("Use a JPG, PNG, WebP, AVIF or SVG image.");
    if (file.size > MAX) return setError("Image must be under 5 MB.");
    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("public-media").upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
    setBusy(false);
    if (error) return setError(error.message);
    setUrl(supabase.storage.from("public-media").getPublicUrl(path).data.publicUrl);
    setSource("upload");
  }

  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={url} />
      {sourceName && <input type="hidden" name={sourceName} value={source} />}
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 overflow-hidden rounded-xl bg-cream-200 ring-1 ring-charcoal/10">
          {url ? <Image src={url} alt="" fill sizes="96px" className="object-cover" unoptimized={url.endsWith(".svg")} /> : <span className="flex h-full items-center justify-center text-xs text-charcoal-400">No image</span>}
        </div>
        <div className="space-y-2">
          <label className="btn-secondary btn-sm cursor-pointer">
            {busy ? <Spinner className="h-3 w-3" /> : null} {url ? "Replace" : "Upload"}
            <input type="file" accept={TYPES.join(",")} className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {url && <button type="button" className="btn-ghost btn-sm block text-chilli" onClick={() => { setUrl(""); setSource("upload"); }}>Remove</button>}
        </div>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
