import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMenuView } from "@/lib/menu-view";
import { DishCard } from "@/components/menu/DishCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Favourite dishes", robots: { index: false } };

export default async function FavouritesPage() {
  const user = await requireUser("/account/favourites");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("favourite_item_ids").eq("id", user.id).single();
  const ids: string[] = data?.favourite_item_ids ?? [];
  const { dishes } = await getMenuView(ids);
  const favs = dishes.filter((d) => ids.includes(d.id));
  return (
    <div>
      <h1 className="mb-6 text-4xl">Favourite dishes</h1>
      {favs.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {favs.map((d) => <DishCard key={d.id} dish={d} layout="row" orderable={d.orderable} unavailableReason={d.unavailable_reason} favourite />)}
        </div>
      ) : (
        <EmptyState icon="❤️" title="No favourites yet" description="Tap “Save” on any dish in the menu to keep it here." action={{ href: "/menu", label: "Browse the menu" }} />
      )}
    </div>
  );
}
