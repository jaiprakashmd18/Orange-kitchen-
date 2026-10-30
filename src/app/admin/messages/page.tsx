import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, telHref } from "@/lib/format";
import { resolveMessage } from "../team-actions";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("contact_messages").select("*").order("is_resolved").order("created_at", { ascending: false }).limit(200);
  return (
    <div className="space-y-4">
      <PageHeader title="Contact messages" description="Messages sent from the Contact page." />
      {(data ?? []).length === 0 ? <EmptyState icon="✉️" title="No messages" /> : (data ?? []).map((m) => (
        <article key={m.id} className={`card p-5 ${m.is_resolved ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{m.name} <span className="text-sm font-normal text-charcoal-500">· <a href={`mailto:${m.email}`} className="link">{m.email}</a>{m.phone && <> · <a href={telHref(m.phone)} className="link">{m.phone}</a></>} · {formatDateTime(m.created_at)}</span></p>
            <ActionForm action={resolveMessage}>
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="value" value={String(!m.is_resolved)} />
              <SubmitButton className="btn-secondary btn-sm">{m.is_resolved ? "Reopen" : "Mark resolved"}</SubmitButton>
            </ActionForm>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm">{m.message}</p>
        </article>
      ))}
    </div>
  );
}
