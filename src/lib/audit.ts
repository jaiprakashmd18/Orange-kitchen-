import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function audit(entry: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
}) {
  const { error } = await createAdminClient()
    .from("audit_logs")
    .insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      details: entry.details ?? null,
      ip: entry.ip ?? null,
    });
  if (error) console.error("[audit]", error.message);
}
