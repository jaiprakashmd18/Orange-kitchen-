import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { setAcceptingOrders } from "@/app/admin/settings/actions";

/** Big online/offline switch for online ordering. */
export function OrderingSwitch({ on, compact = false }: { on: boolean; compact?: boolean }) {
  return (
    <ActionForm action={setAcceptingOrders} className="inline-flex">
      <input type="hidden" name="value" value={String(!on)} />
      <SubmitButton className={compact ? `btn btn-sm ${on ? "bg-white text-chilli ring-1 ring-chilli/30" : "bg-leaf text-white"}` : `btn px-6 ${on ? "bg-white text-chilli ring-1 ring-chilli/30 hover:bg-chilli-50" : "bg-leaf text-white hover:brightness-110"}`}>
        {on ? "Pause online orders" : "▶ Go online — start taking orders"}
      </SubmitButton>
    </ActionForm>
  );
}
