"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { choosePhoto, suggestPhotos } from "@/app/admin/menu/photo-actions";
import { Spinner } from "@/components/ui/Spinner";
import type { PhotoCandidate } from "@/lib/photo-sources";

/** "Find a photo automatically" for one dish: shows candidates to pick from. */
export function PhotoPicker({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<PhotoCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await suggestPhotos(itemId);
            setCandidates(r.candidates);
            setError(r.error);
          })
        }
      >
        {pending ? <Spinner className="h-3 w-3" /> : "✨"} Find photos automatically
      </button>
      {error && <p className="text-xs text-amber-800">{error}</p>}
      {candidates && candidates.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-charcoal-500">Click a photo to use it. It is copied to your storage and credited automatically.</p>
          <div className="grid grid-cols-3 gap-2">
            {candidates.map((c) => (
              <button
                key={c.full}
                type="button"
                title={c.credit}
                disabled={busy !== null}
                className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-charcoal/10 hover:ring-2 hover:ring-brand-500 disabled:opacity-50"
                onClick={async () => {
                  setBusy(c.full);
                  const r = await choosePhoto(itemId, c);
                  setBusy(null);
                  if (r.error) return setError(r.error);
                  setCandidates(null);
                  router.refresh();
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumb} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                {busy === c.full && <span className="absolute inset-0 flex items-center justify-center bg-white/70"><Spinner /></span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
