import type { Metadata } from "next";
import { MenuBrowser } from "@/components/menu/MenuBrowser";
import { getMenuView } from "@/lib/menu-view";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Menu — Breakfast, Meals, Seafood & Special Gravies",
  description:
    "Orange Kitchen menu: idly, dosa, vada, poori, pongal, full meals, variety rice, seafood, chicken specials and special gravies. Order online in Surapet, Chennai.",
  alternates: { canonical: "/menu" },
};

export const revalidate = 0;

export default async function MenuPage() {
  const user = await getSessionUser();
  let favourites: string[] = [];
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("favourite_item_ids").eq("id", user.id).single();
    favourites = data?.favourite_item_ids ?? [];
  }
  const { categories, dishes, notice } = await getMenuView(favourites);
  const shown = user ? dishes : dishes.map((d) => ({ ...d, favourite: undefined }));

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="mb-10 max-w-2xl">
        <p className="eyebrow">Our menu</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Freshly prepared, every day</h1>
        <p className="mt-3 text-charcoal-500">South Indian breakfasts, hearty lunches and our special gravies. Prices are in INR.</p>
      </header>
      <MenuBrowser categories={categories} dishes={shown} orderingNotice={notice} />
    </div>
  );
}
