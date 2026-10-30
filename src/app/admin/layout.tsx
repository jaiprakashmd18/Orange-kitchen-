import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Orange Kitchen" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, roles } = await requireRole(["admin", "staff"], "/admin");
  const settings = await getSettings();
  return (
    <div className="min-h-dvh bg-[#F7F4F0] lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="bg-charcoal p-4 text-white lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:p-5">
        <div className="mb-4 flex items-center justify-between lg:mb-8">
          <Link href="/admin" className="font-display text-lg font-bold"><span className="text-brand-400">ORANGE</span> KITCHEN <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 font-sans text-[10px] uppercase tracking-wider">{roles.includes("admin") ? "Admin" : "Staff"}</span></Link>
        </div>
        <AdminNav isAdmin={roles.includes("admin")} />
        <div className="mt-8 hidden border-t border-white/10 pt-4 text-xs text-white/50 lg:block">
          <p className="truncate">{user.email}</p>
          <div className="mt-2 flex gap-3">
            <Link href="/" className="hover:text-white">View site</Link>
            <form action="/auth/signout" method="post"><button className="hover:text-white">Logout</button></form>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        {!settings.accepting_orders && (
          <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
            Online ordering is <strong>paused</strong>. {roles.includes("admin") && <Link href="/admin/settings" className="underline">Turn it on in Settings</Link>}
          </div>
        )}
        <main id="main" className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
