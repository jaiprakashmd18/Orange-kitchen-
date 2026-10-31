import { DishImage } from "./DishImage";
import { AddToCartButton, type PublicDish } from "./AddToCartButton";
import { FavouriteButton } from "./FavouriteButton";
import { VegMark } from "@/components/ui/VegMark";
import { Badge } from "@/components/ui/Badge";
import { formatINR } from "@/lib/format";

export function DishCard({
  dish,
  orderable,
  unavailableReason,
  badge,
  favourite,
  layout = "grid",
}: {
  dish: PublicDish;
  orderable: boolean;
  unavailableReason?: string;
  badge?: string;
  favourite?: boolean;
  layout?: "grid" | "row";
}) {
  if (layout === "row") {
    return (
      <article className="group flex gap-4 rounded-2xl border border-charcoal/5 bg-white p-3 shadow-card sm:p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {dish.is_veg !== null && <VegMark veg={dish.is_veg} />}
            {badge && <Badge tone="info">{badge}</Badge>}
          </div>
          <h3 className="mt-1.5 font-sans text-base font-bold leading-snug">{dish.name}</h3>
          {dish.price !== null && <p className="mt-0.5 text-sm font-semibold">{formatINR(dish.price, { whole: true })}</p>}
          {dish.description && <p className="mt-1.5 line-clamp-2 text-sm text-charcoal-500">{dish.description}</p>}
          {favourite !== undefined && <FavouriteButton itemId={dish.id} initial={favourite} className="mt-2" />}
        </div>
        <div className="flex w-28 shrink-0 flex-col items-center sm:w-36">
          <DishImage src={dish.image_url} alt={dish.name} className="aspect-square w-full rounded-xl" sizes="144px" representative={Boolean(dish.image_source && dish.image_source !== "upload")} />
          <div className="-mt-5 drop-shadow">
            <AddToCartButton dish={dish} disabled={!orderable} disabledLabel={unavailableReason} />
          </div>
        </div>
      </article>
    );
  }
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-charcoal/5 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative">
        <DishImage src={dish.image_url} alt={dish.name} className="aspect-[4/3] w-full" representative={Boolean(dish.image_source && dish.image_source !== "upload")} />
        {badge && <Badge tone="info" className="absolute left-3 top-3 bg-white/95">{badge}</Badge>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-2">
          {dish.is_veg !== null && <VegMark veg={dish.is_veg} className="mt-1" />}
          <h3 className="font-sans text-base font-bold leading-snug">{dish.name}</h3>
        </div>
        {dish.description && <p className="mt-1.5 line-clamp-2 text-sm text-charcoal-500">{dish.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-base font-bold">{dish.price !== null ? formatINR(dish.price, { whole: true }) : ""}</span>
          <AddToCartButton dish={dish} disabled={!orderable} disabledLabel={unavailableReason} />
        </div>
      </div>
    </article>
  );
}
