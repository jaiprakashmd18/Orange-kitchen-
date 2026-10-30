"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { DishCard } from "./DishCard";
import type { PublicDish } from "./AddToCartButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import type { MenuCategory } from "@/lib/types";

export interface BrowserDish extends PublicDish {
  category_id: string;
  orderable: boolean;
  unavailable_reason?: string;
  badge?: string;
  favourite?: boolean;
}

export function MenuBrowser({ categories, dishes, orderingNotice }: { categories: MenuCategory[]; dishes: BrowserDish[]; orderingNotice: string | null }) {
  const [diet, setDiet] = useState<"all" | "veg" | "nonveg">("all");
  const [query, setQuery] = useState("");
  const top = categories.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dishes.filter(
      (d) =>
        (diet === "all" || (diet === "veg" ? d.is_veg === true : d.is_veg === false)) &&
        (!q || d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q)),
    );
  }, [dishes, diet, query]);

  const sections = top
    .map((cat) => {
      const subs = childrenOf(cat.id);
      const groups = [
        { cat, items: filtered.filter((d) => d.category_id === cat.id) },
        ...subs.map((s) => ({ cat: s, items: filtered.filter((d) => d.category_id === s.id) })),
      ].filter((g) => g.items.length > 0);
      return { cat, groups };
    })
    .filter((s) => s.groups.length > 0);

  return (
    <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
      <aside className="sticky top-16 z-30 -mx-4 mb-6 border-b border-charcoal/10 bg-cream/95 px-4 py-3 backdrop-blur sm:top-20 lg:top-28 lg:mx-0 lg:mb-0 lg:h-fit lg:border-0 lg:bg-transparent lg:p-0">
        <nav aria-label="Menu categories" className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
          {top.map((c) => (
            <a key={c.id} href={`#${c.slug}`} className="whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-charcoal/10 hover:text-brand-700 lg:rounded-xl lg:bg-transparent lg:shadow-none lg:ring-0 lg:hover:bg-white">
              {c.name}
            </a>
          ))}
        </nav>
      </aside>

      <div>
        {orderingNotice && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
            {orderingNotice}
          </div>
        )}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search dishes</span>
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dosa, crab, meals…" className="input pl-10" type="search" />
          </label>
          <div className="inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-charcoal/10" role="group" aria-label="Diet filter">
            {(["all", "veg", "nonveg"] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDiet(d)} aria-pressed={diet === d} className={clsx("rounded-full px-4 py-1.5 text-sm font-semibold transition", diet === d ? "bg-charcoal text-white" : "text-charcoal-500")}>
                {d === "all" ? "All" : d === "veg" ? "Veg" : "Non-veg"}
              </button>
            ))}
          </div>
        </div>

        {sections.length === 0 ? (
          <EmptyState
            title={dishes.length === 0 ? "Our online menu is being prepared" : "No dishes match your filters"}
            description={dishes.length === 0 ? "Dishes and prices will appear here as soon as the restaurant publishes them. Please call us to order in the meantime." : "Try a different search or diet filter."}
          />
        ) : (
          sections.map(({ cat, groups }) => (
            <section key={cat.id} id={cat.slug} className="scroll-mt-40 pb-12 lg:scroll-mt-28">
              <h2 className="text-3xl">{cat.name}</h2>
              {cat.description && <p className="mt-1 text-charcoal-500">{cat.description}</p>}
              {groups.map(({ cat: g, items }) => (
                <div key={g.id} className="mt-6">
                  {g.id !== cat.id && <h3 id={g.slug} className="mb-3 scroll-mt-40 font-sans text-sm font-bold uppercase tracking-widest text-brand-700">{g.name}</h3>}
                  <div className="grid gap-4 md:grid-cols-2">
                    {items.map((d) => (
                      <DishCard key={d.id} dish={d} layout="row" orderable={d.orderable} unavailableReason={d.unavailable_reason} badge={d.badge} favourite={d.favourite} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
