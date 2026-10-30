import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccountNav } from "@/components/account/AccountNav";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("channel", "in_app")
    .is("read_at", null);
  return (
    <div className="container-page py-8 sm:py-12">
      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
        <aside className="mb-6 lg:mb-0">
          <p className="mb-4 hidden font-display text-2xl lg:block">My account</p>
          <AccountNav unread={count ?? 0} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
