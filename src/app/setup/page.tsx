import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { integrationStatus } from "@/lib/env";
import { schemaStatus } from "@/lib/setup-status";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { completeSetup, hasAdmin } from "./actions";

export const metadata: Metadata = { title: "Set up your website", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children?: React.ReactNode }) {
  return (
    <section className={`card p-6 ${done ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-white ${done ? "bg-leaf" : "bg-brand-600"}`}>{done ? "✓" : n}</span>
        <h2 className="font-sans text-lg font-bold">{title}</h2>
      </div>
      {children && <div className="mt-4 text-sm text-charcoal-700">{children}</div>}
    </section>
  );
}

export default async function SetupPage() {
  const supabaseOk = integrationStatus().supabase;
  const schema = supabaseOk ? await schemaStatus() : { ready: false, error: null };
  const adminExists = schema.ready ? await hasAdmin() : false;
  if (supabaseOk && schema.ready && adminExists) redirect("/admin");

  return (
    <main className="min-h-dvh bg-cream px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-256.png" alt="Orange Kitchen" className="h-20 w-20" />
          <h1 className="mt-3 text-4xl">Set up your website</h1>
          <p className="mt-2 text-charcoal-700">Two steps, about 5 minutes. Everything else is done from your admin dashboard afterwards.</p>
        </div>

        <Step n={1} title="Connect Supabase (your database)" done={supabaseOk}>
          {!supabaseOk && (
            <ol className="list-decimal space-y-2 pl-5">
              <li>Create a free account at <a className="link" href="https://supabase.com" target="_blank" rel="noopener noreferrer">supabase.com</a> and click <strong>New project</strong> (region: <strong>Mumbai</strong>). Save the database password somewhere safe.</li>
              <li>In <strong>Vercel</strong> → your project → <strong>Integrations</strong> (or Storage) → <strong>Supabase</strong> → <strong>Connect</strong>, and pick that project. This adds the keys for you.</li>
              <li>Vercel → <strong>Deployments</strong> → ⋯ → <strong>Redeploy</strong>, then open this page again.</li>
            </ol>
          )}
          {!supabaseOk && (
            <details className="mt-3">
              <summary className="cursor-pointer text-charcoal-500">Prefer to add the keys by hand?</summary>
              <p className="mt-2">Supabase → Project Settings → API, then add these in Vercel → Settings → Environment Variables and redeploy:</p>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].map((k) => (
                  <li key={k}>{process.env[k] ? "✓" : "○"} {k}</li>
                ))}
              </ul>
            </details>
          )}
        </Step>

        <Step n={2} title="Create your owner account" done={false}>
          {!supabaseOk ? (
            <p className="text-charcoal-500">Finish step 1 first.</p>
          ) : (
            <>
              <p>
                Get a Supabase access token: open{" "}
                <a className="link" href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener noreferrer">supabase.com/dashboard/account/tokens</a>{" "}
                → <strong>Generate new token</strong>. Choose <strong>Project</strong> access → your project, and give it these permissions:{" "}
                <strong>Project: Read</strong>, <strong>Database: Read &amp; Write</strong>, <strong>Application services → Auth: Read &amp; Write</strong>.
                (Or click “Create legacy token”, which also works.) Copy it and paste it below. It proves you own the project; we use it to create your database and set up login emails.
              </p>
              {!schema.ready && <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-brand-800">Your database will be created when you click the button (takes ~30 seconds).</p>}
              <ActionForm action={completeSetup} className="mt-4 grid gap-3">
                <label><span className="label">Supabase access token</span><input name="token" type="password" required autoComplete="off" className="input" placeholder="sbp_..." /></label>
                <label><span className="label">Your name</span><input name="name" required className="input" autoComplete="name" /></label>
                <label><span className="label">Owner email (your login)</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
                <label><span className="label">Password (at least 10 characters)</span><input name="password" type="password" required minLength={10} className="input" autoComplete="new-password" /></label>
                <SubmitButton className="btn-primary mt-2 py-3 text-base" pendingLabel="Setting up your website…">Set up my website</SubmitButton>
              </ActionForm>
            </>
          )}
        </Step>

        <section className="card p-6 text-sm text-charcoal-700">
          <p className="font-bold">After this, in your admin dashboard:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Settings</strong> → your UPI ID for GPay payments, hours, contact details</li>
            <li><strong>Integrations</strong> → connect Gmail for emails (paste an app password)</li>
            <li><strong>Dishes</strong> → import your menu with prices (photos are added automatically)</li>
            <li><strong>Dashboard</strong> → click <strong>Go online</strong></li>
          </ul>
        </section>
      </div>
    </main>
  );
}
