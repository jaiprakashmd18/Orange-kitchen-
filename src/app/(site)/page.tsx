import Link from "next/link";
import { DishCard } from "@/components/menu/DishCard";
import { DishImage } from "@/components/menu/DishImage";
import { Reveal } from "@/components/home/Reveal";
import { LocationSection } from "@/components/home/LocationSection";
import { Icon, type IconName } from "@/components/ui/Icon";
import { getHours, getPublicReviews } from "@/lib/data";
import { getMenuView } from "@/lib/menu-view";
import { isSpecialToday } from "@/lib/schedule";

export const revalidate = 0;

const WHY: { icon: IconName; title: string; body: string }[] = [
  { icon: "clock", title: "Freshly prepared", body: "Every order is cooked when you place it — never pre-packed or reheated." },
  { icon: "heart", title: "South Indian at heart", body: "Breakfast classics, full meals, seafood and our special gravies, veg and non-veg." },
  { icon: "bike", title: "Delivery or takeaway", body: "Get it delivered across our service areas, or pick a convenient time and collect it yourself." },
  { icon: "check", title: "Secure online payment", body: "Pay safely with UPI, cards or net banking through Razorpay, and track your order live." },
];

export default async function HomePage() {
  const [{ settings, categories, items, dishes, notice }, { hours, holidays }, reviews] = await Promise.all([
    getMenuView(),
    getHours(),
    getPublicReviews(6),
  ]);
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const popular = items.filter((i) => i.is_popular).slice(0, 6).map((i) => byId.get(i.id)!);
  const specials = items.filter((i) => isSpecialToday(i)).slice(0, 6).map((i) => byId.get(i.id)!);
  const heroDish = items.find((i) => i.image_url && (i.is_popular || i.is_special)) ?? items.find((i) => i.image_url);
  const topCategories = categories.filter((c) => !c.parent_id);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-200/50 blur-3xl" aria-hidden />
        <div className="container-page relative grid items-center gap-12 py-12 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <Reveal>
            <p className="eyebrow">{settings.tagline}</p>
            <h1 className="mt-4 text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
              Good Food. Great Taste. <span className="text-brand-600">Delivered Fresh.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-charcoal-500">
              Discover delicious South Indian favourites, freshly prepared and served with love.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/menu" className="btn-primary px-7 text-base">
                ORDER NOW <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
              <Link href="/menu" className="btn-secondary px-7 text-base">
                EXPLORE MENU
              </Link>
            </div>
            {notice && <p className="mt-6 max-w-lg text-sm text-charcoal-500">{notice}</p>}
            <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div className="flex items-center gap-2"><Icon name="bike" className="h-5 w-5 text-brand-600" /><dt className="sr-only">Delivery</dt><dd>Home delivery</dd></div>
              <div className="flex items-center gap-2"><Icon name="bag" className="h-5 w-5 text-brand-600" /><dt className="sr-only">Takeaway</dt><dd>Takeaway &amp; self-pickup</dd></div>
              <div className="flex items-center gap-2"><Icon name="pin" className="h-5 w-5 text-brand-600" /><dt className="sr-only">Location</dt><dd>Surapet, Chennai</dd></div>
            </dl>
          </Reveal>

          <Reveal delay={0.1} className="relative">
            <div className="relative mx-auto aspect-square max-w-md overflow-hidden rounded-[2.5rem] shadow-lift ring-8 ring-white lg:max-w-none">
              {heroDish ? (
                <DishImage src={heroDish.image_url} alt={heroDish.name} className="absolute inset-0" priority sizes="(min-width: 1024px) 45vw, 90vw" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-brand-500 via-brand-400 to-brand-300 p-10 text-center text-white">
                  <span className="font-display text-6xl font-bold drop-shadow-sm sm:text-7xl">Orange</span>
                  <span className="font-display text-6xl font-bold drop-shadow-sm sm:text-7xl">Kitchen</span>
                  <span className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-white/90">Surapet · Chennai</span>
                </div>
              )}
            </div>
            {heroDish && (
              <div className="absolute -bottom-4 left-4 rounded-2xl bg-white px-4 py-3 shadow-card sm:left-8">
                <p className="text-xs text-charcoal-500">Featured</p>
                <p className="font-bold">{heroDish.name}</p>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* Categories */}
      {topCategories.length > 0 && (
        <section className="section pt-4" aria-labelledby="cat-title">
          <div className="container-page">
            <Reveal>
              <p className="eyebrow">Food categories</p>
              <h2 id="cat-title" className="mt-2 text-4xl">What are you craving?</h2>
            </Reveal>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {topCategories.map((c, idx) => {
                const subs = categories.filter((s) => s.parent_id === c.id);
                return (
                  <Reveal key={c.id} delay={idx * 0.05}>
                    <Link href={`/menu#${c.slug}`} className="group block h-full overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-charcoal/5 transition hover:-translate-y-0.5 hover:shadow-lift">
                      <DishImage src={c.image_url} alt={c.name} className="aspect-[16/10] w-full" />
                      <div className="p-4 sm:p-5">
                        <h3 className="font-display text-2xl">{c.name}</h3>
                        {subs.length > 0 && <p className="mt-1 line-clamp-2 text-sm text-charcoal-500">{subs.map((s) => s.name).join(" · ")}</p>}
                        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                          View dishes <Icon name="arrowRight" className="h-4 w-4 transition group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Today's specials */}
      {specials.length > 0 && (
        <section className="section bg-charcoal text-white" aria-labelledby="special-title">
          <div className="container-page">
            <p className="eyebrow text-brand-300">Today&apos;s specials</p>
            <h2 id="special-title" className="mt-2 text-4xl text-white">Made special for today</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {specials.map((d) => (
                <DishCard key={d.id} dish={d} orderable={d.orderable} unavailableReason={d.unavailable_reason} badge="Special" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Popular dishes */}
      <section className="section" aria-labelledby="popular-title">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Popular dishes</p>
              <h2 id="popular-title" className="mt-2 text-4xl">Our guests&apos; favourites</h2>
            </div>
            <Link href="/menu" className="link inline-flex items-center gap-1">Full menu <Icon name="arrowRight" className="h-4 w-4" /></Link>
          </div>
          {popular.length > 0 ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {popular.map((d) => (
                <DishCard key={d.id} dish={d} orderable={d.orderable} unavailableReason={d.unavailable_reason} />
              ))}
            </div>
          ) : (
            <p className="mt-6 max-w-xl text-charcoal-500">
              Our most-loved dishes will be highlighted here. In the meantime, <Link href="/menu" className="link">browse the full menu</Link>.
            </p>
          )}
        </div>
      </section>

      {/* Why choose */}
      <section className="section bg-brand-50/60" aria-labelledby="why-title">
        <div className="container-page">
          <p className="eyebrow">Why choose Orange Kitchen?</p>
          <h2 id="why-title" className="mt-2 max-w-2xl text-4xl">Honest food, cooked fresh, brought to you with care</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map((w, idx) => (
              <Reveal key={w.title} delay={idx * 0.05}>
                <div className="h-full rounded-2xl bg-white p-6 shadow-card">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                    <Icon name={w.icon} className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 font-sans text-lg font-bold">{w.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal-500">{w.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials — only genuine, approved reviews from verified orders */}
      <section className="section" aria-labelledby="reviews-title">
        <div className="container-page">
          <p className="eyebrow">Customer testimonials</p>
          <h2 id="reviews-title" className="mt-2 text-4xl">What our customers say</h2>
          {reviews.length > 0 ? (
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {reviews.map((r) => (
                <figure key={r.id} className="card flex h-full flex-col p-6">
                  <div className="flex gap-0.5 text-brand-500" aria-label={`${r.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Icon key={i} name="star" className={`h-4 w-4 ${i < r.rating ? "fill-current" : "opacity-30"}`} />
                    ))}
                  </div>
                  {r.comment && <blockquote className="mt-4 flex-1 text-charcoal-700">“{r.comment}”</blockquote>}
                  <figcaption className="mt-4 text-sm font-semibold">{r.display_name || "Verified customer"} <span className="font-normal text-charcoal-500">· verified order</span></figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="mt-6 max-w-xl text-charcoal-500">
              Reviews from verified orders will appear here. Ordered from us? You can leave a review from your order page once it&apos;s delivered.
            </p>
          )}
        </div>
      </section>

      <LocationSection settings={settings} hours={hours} holidays={holidays} />
    </>
  );
}
