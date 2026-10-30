import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Profile & settings", robots: { index: false } };

export default async function SettingsPage() {
  const user = await requireUser("/account/settings");
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("full_name, phone, whatsapp_opt_in, marketing_opt_in").eq("id", user.id).single();
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">Profile &amp; settings</h1>
      <ProfileForm email={user.email ?? ""} initial={{ full_name: p?.full_name ?? "", phone: p?.phone ?? "", whatsapp_opt_in: p?.whatsapp_opt_in ?? false, marketing_opt_in: p?.marketing_opt_in ?? false }} />
      <form action="/auth/signout" method="post" className="card flex items-center justify-between p-6">
        <div>
          <p className="font-semibold">Log out</p>
          <p className="text-sm text-charcoal-500">Sign out of Orange Kitchen on this device.</p>
        </div>
        <button className="btn-secondary">Logout</button>
      </form>
    </div>
  );
}
