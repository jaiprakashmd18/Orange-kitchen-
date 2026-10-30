import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getSettings, fullAddress } from "@/lib/data";
import { Reveal } from "@/components/home/Reveal";
import { Icon } from "@/components/ui/Icon";
import { VegMark } from "@/components/ui/VegMark";

export const metadata: Metadata = {
  title: "About Us",
  description: "Orange Kitchen is a South Indian restaurant in Surapet, Chennai serving freshly prepared vegetarian and non-vegetarian food.",
  alternates: { canonical: "/about" },
};

const PILLARS = [
  { title: "Our food philosophy", body: "Food should taste like it was made for you — because it was. We keep our menu focused on South Indian favourites we can cook well, every single day." },
  { title: "Quality & freshness", body: "Every order is prepared after you place it. Dishes that run out are marked sold out on the menu rather than substituted." },
  { title: "Our cooking approach", body: "Traditional South Indian cooking: freshly ground masalas, slow-simmered kuzhambu and gravies, and breakfast staples made the way they should be." },
];

export default async function AboutPage() {
  const settings = await getSettings();
  return (
    <>
      <section className="container-page py-14 sm:py-20">
        <Reveal className="max-w-3xl">
          <p className="eyebrow">About us</p>
          <h1 className="mt-3 text-5xl sm:text-6xl">{settings.name}</h1>
          <p className="mt-4 font-display text-2xl italic text-brand-700">{settings.tagline}</p>
          <p className="mt-6 text-lg leading-relaxed text-charcoal-700">
            {settings.name} is a modern, welcoming restaurant at {fullAddress(settings)}, serving delicious South Indian vegetarian and
            non-vegetarian food — for dine-in guests, takeaway and home delivery.
          </p>
        </Reveal>
      </section>

      {settings.about_story && (
        <section className="bg-white py-14 sm:py-20" aria-labelledby="story">
          <div className="container-page max-w-3xl">
            <h2 id="story" className="text-4xl">Our story</h2>
            <div className="mt-6 space-y-4 text-lg leading-relaxed text-charcoal-700">
              {settings.about_story.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="container-page grid gap-6 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <div className="card h-full p-7">
                <h2 className="font-sans text-lg font-bold">{p.title}</h2>
                <p className="mt-3 leading-relaxed text-charcoal-500">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section bg-brand-50/60" aria-labelledby="offer">
        <div className="container-page grid gap-8 md:grid-cols-2">
          <div>
            <h2 id="offer" className="text-4xl">Vegetarian &amp; non-vegetarian</h2>
            <p className="mt-4 text-charcoal-700">
              Our menu clearly marks every dish so you can choose with confidence. Use the Veg / Non-veg filter on the menu to see only what you want.
            </p>
            <Link href="/menu" className="btn-primary mt-6">
              Explore the menu <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
          <ul className="grid gap-4">
            <li className="card flex items-start gap-4 p-5">
              <VegMark veg className="mt-1" />
              <div>
                <p className="font-bold">Vegetarian</p>
                <p className="text-sm text-charcoal-500">Idly, dosa, vada, poori, pongal, full meals, variety rice and kuzhambu.</p>
              </div>
            </li>
            <li className="card flex items-start gap-4 p-5">
              <VegMark veg={false} className="mt-1" />
              <div>
                <p className="font-bold">Non-vegetarian</p>
                <p className="text-sm text-charcoal-500">Seafood, chicken specials and our special gravies like crab gravy and sura puttu.</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {settings.gallery_urls.length > 0 && (
        <section className="section" aria-labelledby="gallery">
          <div className="container-page">
            <h2 id="gallery" className="text-4xl">Inside {settings.name}</h2>
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
              {settings.gallery_urls.map((url, i) => (
                <div key={url} className={`relative overflow-hidden rounded-2xl bg-cream-200 ${i === 0 ? "col-span-2 row-span-2 aspect-square md:aspect-auto" : "aspect-square"}`}>
                  <Image src={url} alt={`${settings.name} photo ${i + 1}`} fill sizes="(min-width: 768px) 33vw, 50vw" className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
