"use client";

import { useState, useTransition } from "react";
import { toggleFavourite } from "@/app/(site)/account/actions";
import { Icon } from "@/components/ui/Icon";

export function FavouriteButton({ itemId, initial, className = "" }: { itemId: string; initial: boolean; className?: string }) {
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={fav}
      onClick={() =>
        start(async () => {
          setFav((v) => !v);
          const res = await toggleFavourite(itemId);
          if (res.error) setFav((v) => !v);
        })
      }
      className={`inline-flex items-center gap-1 text-xs font-semibold ${fav ? "text-chilli" : "text-charcoal-500 hover:text-chilli"} ${className}`}
    >
      <Icon name="heart" className={`h-4 w-4 ${fav ? "fill-current" : ""}`} /> {fav ? "Favourite" : "Save"}
    </button>
  );
}
