import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { importMenu } from "./actions";

export const metadata = { title: "Import menu" };

const SAMPLE = `category,subcategory,name,price,veg,description,image_url,published,available,popular
Breakfast,Dosa,Masala Dosa,,veg,,,yes,yes,no
Special Gravies,,Crab Gravy,,non-veg,,,yes,yes,yes`;

export default function ImportMenuPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Import menu from CSV" description={<Link href="/admin/menu" className="link">← Back to dishes</Link>} />
      <section className="card space-y-3 p-5 text-sm">
        <p>Type your menu in Excel / Google Sheets with these columns, then <strong>File → Download → CSV</strong> and upload it here (or paste it).</p>
        <ul className="list-disc space-y-1 pl-5 text-charcoal-700">
          <li><strong>category</strong> (required) — e.g. Breakfast, Lunch, Special Gravies. Created automatically if new.</li>
          <li><strong>subcategory</strong> — e.g. Dosa, Seafood (optional).</li>
          <li><strong>name</strong> (required) — dishes with the same name are updated, not duplicated.</li>
          <li><strong>price</strong> — in rupees. Leave empty and the dish is saved as a draft (not shown to customers).</li>
          <li><strong>veg</strong> — veg / non-veg. Required to publish.</li>
          <li>description, image_url (https link), published / available / popular (yes/no) — optional.</li>
        </ul>
        <p className="text-charcoal-500">Example (prices left blank on purpose — fill in your real prices):</p>
        <pre className="overflow-x-auto rounded-xl bg-cream p-3 text-xs">{SAMPLE}</pre>
        <p className="text-charcoal-500">Tip: <a href="/api/admin/reports/export?type=menu" className="link">download your current menu as CSV</a>, edit it, and upload it back.</p>
      </section>
      <ActionForm action={importMenu} className="card space-y-4 p-5">
        <div>
          <label htmlFor="file" className="label">Upload CSV file</label>
          <input id="file" name="file" type="file" accept=".csv,text/csv" className="block text-sm" />
        </div>
        <div>
          <label htmlFor="csv" className="label">…or paste CSV</label>
          <textarea id="csv" name="csv" rows={12} className="input font-mono text-xs" placeholder={SAMPLE} />
        </div>
        <SubmitButton pendingLabel="Importing…">Import dishes</SubmitButton>
      </ActionForm>
    </div>
  );
}
