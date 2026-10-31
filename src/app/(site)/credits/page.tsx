import type { Metadata } from "next";
import { getMenu } from "@/lib/data";

export const metadata: Metadata = { title: "Photo credits", alternates: { canonical: "/credits" } };

/** Attribution for representative dish photos (required by CC BY / CC BY-SA). */
export default async function CreditsPage() {
  const { items } = await getMenu();
  const credited = items.filter((i) => i.image_url && i.image_source && i.image_source !== "upload" && i.image_credit);
  return (
    <div className="container-page max-w-3xl py-14">
      <h1 className="text-4xl">Photo credits</h1>
      <p className="mt-3 text-charcoal-500">
        Some dishes show a representative photo until we add our own. These photos are used under their free licences and remain the work of their
        creators. Actual servings may look different.
      </p>
      {credited.length === 0 ? (
        <p className="mt-8 text-sm text-charcoal-500">All dish photos on this site are our own.</p>
      ) : (
        <ul className="mt-8 divide-y divide-charcoal/10">
          {credited.map((i) => (
            <li key={i.id} className="flex flex-col gap-0.5 py-3 text-sm sm:flex-row sm:justify-between sm:gap-6">
              <span className="font-semibold">{i.name}</span>
              <span className="text-charcoal-500">
                {i.image_credit_url ? (
                  <a href={i.image_credit_url} target="_blank" rel="noopener noreferrer" className="underline">{i.image_credit}</a>
                ) : (
                  i.image_credit
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
