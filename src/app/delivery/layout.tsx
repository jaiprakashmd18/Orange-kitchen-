import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { toggleDuty } from "./actions";

export const metadata: Metadata = { title: { default: "Deliveries", template: "%s · Orange Kitchen Delivery" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole(["delivery"], "/delivery");
  const supabase = await createClient();
  const { data: me } = await supabase.from("delivery_personnel").select("full_name, is_on_duty, is_active").eq("user_id", user.id).maybeSingle();
  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-30 bg-charcoal text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/delivery" className="font-display font-bold"><span className="text-brand-400">OK</span> Delivery</Link>
          <div className="flex items-center gap-2">
            {me?.is_active && (
              <ActionForm action={toggleDuty}>
                <input type="hidden" name="value" value={String(!me.is_on_duty)} />
                <SubmitButton className={`btn btn-sm min-h-9 ${me.is_on_duty ? "bg-leaf text-white" : "bg-white/10 text-white"}`}>{me.is_on_duty ? "● On duty" : "○ Off duty"}</SubmitButton>
              </ActionForm>
            )}
            <form action="/auth/signout" method="post"><button className="btn-ghost btn-sm text-white/70">Logout</button></form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-2xl gap-1 px-4 pb-2 text-sm">
          <Link href="/delivery" className="rounded-full px-3 py-1.5 hover:bg-white/10">Assigned</Link>
          <Link href="/delivery/history" className="rounded-full px-3 py-1.5 hover:bg-white/10">History</Link>
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-2xl px-4 py-6">
        {!me && <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Your rider profile is missing. Ask the admin to add you in the Delivery team page.</p>}
        {me && <p className="mb-4 text-sm text-charcoal-500">Hi {me.full_name.split(" ")[0]} 👋</p>}
        {children}
      </main>
    </div>
  );
}
